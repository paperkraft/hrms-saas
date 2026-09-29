"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/actions/notification";
import { getDaysDifference } from "@/lib/utils";
import { sendLeaveStatusUpdateEmail } from "@/lib/mail";
import { syncAttendanceWithApprovedLeaves } from "@/actions/attendance/sync";
import { getCycleKey, CASUAL_ACCRUAL, SICK_ACCRUAL_SEMI, MAX_CARRY_FORWARD, MAX_TOTAL_CASUAL, round, splitLeaveIntoMonths } from "./utils";


export async function getCyclePendingDays(userId: string, cycleStart: Date, cycleEnd: Date) {
  const pendingRequests = await prisma.leaveRequest.findMany({
    where: {
      userId,
      status: "PENDING",
      category: "SEMI_ANNUAL_POLICY_2",
      startDate: { gte: cycleStart },
      endDate: { lte: cycleEnd }
    }
  });

  const holidays = await prisma.publicHoliday.findMany({
    where: {
      date: { gte: cycleStart, lte: cycleEnd }
    }
  });
  const holidayDates = holidays.map(h => h.date);

  return pendingRequests.reduce((acc, req) => acc + getDaysDifference(req.startDate, req.endDate, holidayDates), 0);
}

export async function ensureBalance(userId: string, month: number, year: number, configStartMonth?: number): Promise<any> {
  const existing = await prisma.leaveBalance.findUnique({
    where: { userId_month_year: { userId, month, year } }
  });
  if (existing) return existing;

  let startMonth = configStartMonth;
  if (startMonth === undefined) {
    const config = await prisma.systemConfig.findUnique({ where: { id: "GLOBAL_CONFIG" } });
    startMonth = config?.semiAnnualCycleStartMonth ?? 0;
  }

  // Find the predecessor
  const lastRecord = await prisma.leaveBalance.findFirst({
    where: {
      userId,
      OR: [
        { year: { lt: year } },
        { AND: [{ year: year }, { month: { lt: month } }] }
      ]
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }]
  });

  let carryForwardToNew = 0.0;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { joiningDate: true }
  });

  let isProbation = false;
  if (user?.joiningDate) {
    const probationEndDate = new Date(user.joiningDate);
    probationEndDate.setDate(probationEndDate.getDate() + 90);
    const targetMonthDate = new Date(year, month - 1, 1);
    if (targetMonthDate < probationEndDate) {
      isProbation = true;
    }
  }

  let semiAnnualToNew = isProbation ? 0.0 : SICK_ACCRUAL_SEMI;

  if (lastRecord) {
    const isConsecutive = (lastRecord.year === year && lastRecord.month === month - 1) ||
      (lastRecord.year === year - 1 && lastRecord.month === 12 && month === 1);

    if (isConsecutive) {
      // Roll over Casual leaves with the 1.0 CF limit
      if (lastRecord.carriedForward === 0 && lastRecord.encashed === 0 && lastRecord.remainingFull > 0) {
        let encash = 0;
        let carry = 0;
        if (!isProbation) {
          const rem = round(lastRecord.remainingFull);
          carry = Math.min(rem, MAX_CARRY_FORWARD);
          encash = round(rem - carry);
        }
        carryForwardToNew = carry;

        await prisma.leaveBalance.update({
          where: { id: lastRecord.id },
          data: { carriedForward: carryForwardToNew, encashed: encash }
        });
      } else {
        carryForwardToNew = isProbation ? 0 : Number(lastRecord.carriedForward);
      }

      // Roll over Medical pool if still in cycle
      const getCycleString = (m: number, y: number, sM: number) => {
        const rel = (m - sM + 12) % 12;
        const h = rel < 6 ? "H1" : "H2";
        const sy = (m < sM && (sM + 5) % 12 >= m) ? y - 1 : y;
        return `${sy}-${h}`;
      };

      if (getCycleString(month, year, startMonth) === getCycleString(lastRecord.month, lastRecord.year, startMonth)) {
        semiAnnualToNew = isProbation ? 0.0 : Number(lastRecord.semiAnnualRemaining);
      } else {
        semiAnnualToNew = isProbation ? 0.0 : SICK_ACCRUAL_SEMI;
      }
    } else {
      // Fill the timeline gap recursively
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const gapPrev = await ensureBalance(userId, prevMonth, prevYear, startMonth);
      carryForwardToNew = isProbation ? 0.0 : Number(gapPrev.carriedForward);
    }
  }

  try {
    return await prisma.leaveBalance.create({
      data: {
        userId, month, year,
        remainingFull: Math.min(MAX_TOTAL_CASUAL, round(CASUAL_ACCRUAL + (isProbation ? 0.0 : carryForwardToNew))),
        remainingShort: 1,
        semiAnnualRemaining: isProbation ? 0.0 : semiAnnualToNew,
        carriedForward: 0.0,
        encashed: 0.0,
        fullTaken: 0.0,
        shortTaken: 0,
        semiAnnualTaken: 0.0,
        unpaidTaken: 0.0,
      }
    });
  } catch (e) {
    return await prisma.leaveBalance.findUniqueOrThrow({
      where: { userId_month_year: { userId, month, year } }
    });
  }
}

/**
 * Counts the leave "cost" already reserved by PENDING requests
 * for a given user, month, and year.
 */
export async function getPendingCost(userId: string, month: number, year: number) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const pendingRequests = await prisma.leaveRequest.findMany({
    where: {
      userId,
      status: "PENDING",
      OR: [
        { startDate: { lte: endOfMonth }, endDate: { gte: startOfMonth } }
      ]
    },
  });

  let pendingFull = 0;
  let pendingShort = 0;
  let pendingSemiAnnual = 0;

  for (const req of pendingRequests) {
    const monthParts = splitLeaveIntoMonths(req.startDate, req.endDate);
    const part = monthParts.find(p => p.month === month && p.year === year);
    if (!part) continue;

    if (req.category === "MONTHLY_POLICY_1") {
      if (req.duration === "FULL") {
        pendingFull += part.days;
      } else if (req.duration === "HALF") {
        pendingFull += 0.5 * part.days;
      } else if (req.duration === "SHORT") {
        // Short leaves are typically 1 day only, but handle consistently
        pendingShort += 1;
      }
    } else if (req.category === "SEMI_ANNUAL_POLICY_2") {
      pendingSemiAnnual += part.days;
    }
  }

  return { pendingFull, pendingShort, pendingSemiAnnual };
}

/**
 * Internal helper to perform the actual database changes for approval/rejection.
 * Does NOT check permissions.
 */
export async function processLeaveRequestStatus(requestId: string, status: "APPROVED" | "REJECTED", note?: string) {
  const requestMeta = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: { user: { select: { id: true, email: true, name: true, joiningDate: true } } }
  });

  if (!requestMeta) throw new Error("Request not found.");
  if (requestMeta.status !== "PENDING") return { success: true as const };

  // Fetch public holidays in range
  const holidays = await prisma.publicHoliday.findMany({
    where: {
      date: {
        gte: new Date(requestMeta.startDate.getFullYear(), requestMeta.startDate.getMonth(), 1),
        lte: new Date(requestMeta.endDate.getFullYear(), requestMeta.endDate.getMonth() + 1, 0, 23, 59, 59)
      }
    }
  });
  const holidayDates = holidays.map(h => h.date);

  // Ensure balance record exists for all months covered by the leave
  const leaveMonths = splitLeaveIntoMonths(requestMeta.startDate, requestMeta.endDate, holidayDates);
  for (const m of leaveMonths) {
    await ensureBalance(requestMeta.userId, m.month, m.year);
  }

  const result = await prisma.$transaction(async (tx) => {
    const txRequest = await tx.leaveRequest.findUnique({
      where: { id: requestId }
    });

    if (!txRequest || txRequest.status !== "PENDING") return { success: true as const };

    if (status === "REJECTED") {
      await tx.leaveRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED", managerNote: note || null }
      });
      return { success: true as const };
    }

    let totalOverflowLwp = 0;
    const monthParts = splitLeaveIntoMonths(txRequest.startDate, txRequest.endDate, holidayDates);

    for (const part of monthParts) {
      const balance = await tx.leaveBalance.findUnique({
        where: { userId_month_year: { userId: txRequest.userId, month: part.month, year: part.year } }
      });
      if (!balance) throw new Error(`BALANCE_NOT_FOUND_FOR_${part.month}_${part.year}`);

      let requestedNeeded = 0;
      let balanceField: "remainingFull" | "remainingShort" | "semiAnnualRemaining" | null = null;
      let takenField: "fullTaken" | "shortTaken" | "semiAnnualTaken" | "unpaidTaken" | null = null;

      if (txRequest.category === "MONTHLY_POLICY_1") {
        if (txRequest.duration === "FULL") {
          requestedNeeded = part.days;
          balanceField = "remainingFull";
          takenField = "fullTaken";
        } else if (txRequest.duration === "HALF") {
          requestedNeeded = 0.5 * part.days;
          balanceField = "remainingFull";
          takenField = "fullTaken";
        } else if (txRequest.duration === "SHORT") {
          requestedNeeded = 1;
          balanceField = "remainingShort";
          takenField = "shortTaken";
        }
      } else if (txRequest.category === "SEMI_ANNUAL_POLICY_2") {
        requestedNeeded = part.days;
        balanceField = "semiAnnualRemaining";
        takenField = "semiAnnualTaken";
      } else if (txRequest.category === "UNPAID") {
        requestedNeeded = txRequest.duration === "HALF" ? 0.5 * part.days : part.days;
        takenField = "unpaidTaken";
      }

      if (balanceField && takenField) {
        const available = Number(balance[balanceField]);
        const deductAmount = Math.min(available, requestedNeeded);
        const overflow = requestedNeeded - deductAmount;
        totalOverflowLwp += overflow;

        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            [balanceField]: { decrement: deductAmount },
            [takenField]: { increment: deductAmount },
            unpaidTaken: { increment: overflow }
          }
        });
      } else if (takenField === "unpaidTaken") {
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { unpaidTaken: { increment: requestedNeeded } }
        });
      }
    }

    let newManagerNote = note || "";
    if (totalOverflowLwp > 0) {
      const sep = newManagerNote ? " | " : "";
      newManagerNote += `${sep}[Auto-LWP: ${totalOverflowLwp}]`;
    }

    await tx.leaveRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED", managerNote: newManagerNote || null }
    });

    // Cascade updates for all subsequent months
    const config = await tx.systemConfig.findUnique({ where: { id: "GLOBAL_CONFIG" } });
    const startMonthConfig = (config as any)?.semiAnnualCycleStartMonth ?? 0;

    const firstMonth = monthParts[0];
    let m = firstMonth.month;
    let y = firstMonth.year;

    while (true) {
      const current = await tx.leaveBalance.findFirst({
        where: { userId: txRequest.userId, month: m, year: y }
      });
      if (!current) break;

      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;

      const next = await tx.leaveBalance.findFirst({
        where: { userId: txRequest.userId, month: nextM, year: nextY }
      });
      if (!next) break;

      let isProbation = false;
      if (requestMeta.user?.joiningDate) {
        const probationEndDate = new Date(requestMeta.user.joiningDate);
        probationEndDate.setDate(probationEndDate.getDate() + 90);
        const targetMonthDate = new Date(current.year, current.month - 1, 1);
        if (targetMonthDate < probationEndDate) {
          isProbation = true;
        }
      }

      const newCFFromCurrent = isProbation ? 0 : Math.min(Number(current.remainingFull.toFixed(2)), 1.0);
      const oldCFFromCurrent = Number(current.carriedForward);
      const cfDiff = Number((newCFFromCurrent - oldCFFromCurrent).toFixed(2));
      const currentEncashed = isProbation ? 0 : Number(Math.max(0, current.remainingFull - newCFFromCurrent).toFixed(2));

      if (oldCFFromCurrent !== newCFFromCurrent || current.encashed !== currentEncashed) {
        await tx.leaveBalance.update({
          where: { id: current.id },
          data: {
            carriedForward: newCFFromCurrent,
            encashed: currentEncashed
          }
        });
      }

      if (cfDiff !== 0) {
        const nextBalance = await tx.leaveBalance.findUnique({ where: { id: next.id } });
        if (nextBalance) {
          const newTotal = Math.min(MAX_TOTAL_CASUAL, Number((nextBalance.remainingFull + cfDiff).toFixed(2)));
          await tx.leaveBalance.update({
            where: { id: next.id },
            data: {
              remainingFull: newTotal
            }
          });
        }
      }

      if (getCycleKey(m, y, startMonthConfig) === getCycleKey(nextM, nextY, startMonthConfig)) {
        await tx.leaveBalance.update({
          where: { id: next.id },
          data: { semiAnnualRemaining: current.semiAnnualRemaining }
        });
      }

      m = nextM;
      y = nextY;
    }

    return { success: true as const };
  }, {
    isolationLevel: "Serializable"
  });

  if (result.success) {
    const isApproved = status === "APPROVED";
    const startStr = new Date(requestMeta.startDate).toLocaleDateString();
    const endStr = new Date(requestMeta.endDate).toLocaleDateString();
    const dateRange = startStr === endStr ? `on ${startStr}` : `from ${startStr} to ${endStr}`;

    let leaveCategoryName = "";
    if (requestMeta.category === "MONTHLY_POLICY_1") {
      leaveCategoryName = requestMeta.leaveType === "CASUAL" ? "Casual Leave" : "Medical Leave";
    } else if (requestMeta.category === "SEMI_ANNUAL_POLICY_2") {
      leaveCategoryName = "Semi-Annual Leave";
    } else if (requestMeta.category === "UNPAID") {
      leaveCategoryName = "Unpaid Leave";
    } else {
      leaveCategoryName = "Leave";
    }

    let leaveDurationDetails = "";
    if (requestMeta.duration === "FULL") {
      leaveDurationDetails = "Full Day";
    } else if (requestMeta.duration === "HALF") {
      const session = requestMeta.halfDayType === "FIRST_HALF" ? "1st Half" : "2nd Half";
      leaveDurationDetails = `Half Day (${session})`;
    } else if (requestMeta.duration === "SHORT") {
      leaveDurationDetails = `Short Leave (${requestMeta.startTime} - ${requestMeta.endTime})`;
    }

    const notificationTitle = `${leaveDurationDetails} Leave ${isApproved ? "Approved" : "Rejected"}`;
    const notificationContent = isApproved
      ? `Your request for ${leaveCategoryName} (${leaveDurationDetails.toLowerCase()}) ${dateRange} has been approved.`
      : `Your request for ${leaveCategoryName} (${leaveDurationDetails.toLowerCase()}) ${dateRange} was rejected. Note: ${note || "No reason provided."}`;

    await createNotification({
      userId: requestMeta.userId,
      title: notificationTitle,
      content: notificationContent,
      type: isApproved ? "SUCCESS" : "ERROR",
      link: "/dashboard/employee/leaves"
    });

    // Send email notification to the employee
    if (requestMeta.user.email) {
      await sendLeaveStatusUpdateEmail({
        tenantId: requestMeta.tenantId,
        applicantName: requestMeta.user.name || "Employee",
        startDate: requestMeta.startDate,
        endDate: requestMeta.endDate,
        duration: requestMeta.duration,
        halfDayType: requestMeta.halfDayType,
        startTime: requestMeta.startTime,
        endTime: requestMeta.endTime,
        status: status,
        managerNote: note,
        toEmail: requestMeta.user.email,
      });
    }

    // Synchronize attendance records for these leave dates to clear/update half-day or late marks
    await syncAttendanceWithApprovedLeaves(
      requestMeta.userId,
      requestMeta.startDate,
      requestMeta.endDate
    );
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/employee");
  revalidatePath("/dashboard/manager");

  return result;
}
