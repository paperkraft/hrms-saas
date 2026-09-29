"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { leaveApplicationSchema } from "@/lib/validations/leave";
import { createNotification } from "@/actions/notification";
import { getDaysDifference } from "@/lib/utils";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendLeaveApplicationEmail, sendLeaveStatusUpdateEmail } from "@/lib/mail";

import { getCyclePendingDays, ensureBalance, processLeaveRequestStatus } from "./core";
import { syncAttendanceWithApprovedLeaves } from "@/actions/attendance/sync";
import { getCycleRange, splitLeaveIntoMonths, round, MAX_CARRY_FORWARD, MAX_TOTAL_CASUAL } from "./utils";
export async function submitLeaveRequest(formData: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false as const, error: "You must be logged in to submit a leave request." };
  }

  const userId = session.user.id;
  const parsed = leaveApplicationSchema.safeParse(formData);

  if (!parsed.success) {
    return { success: false as const, error: "Invalid form data: " + parsed.error.message };
  }

  const data = parsed.data;
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  const month = startDate.getMonth() + 1;
  const year = startDate.getFullYear();

  try {
    const config = await prisma.systemConfig.findUnique({ where: { id: "GLOBAL_CONFIG" } });

    // Policy Toggle: Semi-Annual
    if (data.category === "SEMI_ANNUAL_POLICY_2" && !config?.semiAnnualPolicyEnabled) {
      return { success: false as const, error: "Semi-annual leave policy is currently disabled by administrator." };
    }

    // Fetch public holidays in the leave date range
    const holidays = await prisma.publicHoliday.findMany({
      where: {
        date: {
          gte: new Date(startDate.getFullYear(), startDate.getMonth(), 1),
          lte: new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0, 23, 59, 59)
        }
      }
    });
    const holidayDates = holidays.map(h => h.date);

    const diffDays = getDaysDifference(startDate, endDate, holidayDates);
    const balance = await ensureBalance(userId, month, year, config?.semiAnnualCycleStartMonth);

    // Policy 2 Enforcement
    if (data.category === "SEMI_ANNUAL_POLICY_2") {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { joiningDate: true } });
      if (user?.joiningDate) {
        const probationEndDate = new Date(user.joiningDate);
        probationEndDate.setDate(probationEndDate.getDate() + 90);
        if (startDate < probationEndDate) {
          return {
            success: false as const,
            error: "Employees in 90-day probation period are not eligible for Policy 2 (Semi-Annual Medical) leaves."
          };
        }
      }

      if (diffDays < 3) {
        return {
          success: false as const,
          error: "Earned Leave (Policy 2) requires a minimum of 3 consecutive working leave days."
        };
      }

      const cycle = getCycleRange(month, year, config?.semiAnnualCycleStartMonth);
      const pendingDays = await getCyclePendingDays(userId, cycle.start, cycle.end);
      const available = balance.semiAnnualRemaining - pendingDays;

      if (diffDays > available) {
        return {
          success: false as const,
          error: `Policy 2 quota exceeded. Remaining quota: ${available} days. You are trying to apply for ${diffDays} working days.`
        };
      }
    }

    // Overlap Check
    const existingOverlap = await prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: { in: ["PENDING", "APPROVED"] },
        AND: [
          { startDate: { lte: endDate } },
          { endDate: { gte: startDate } },
        ],
      },
    });

    if (existingOverlap) {
      return { success: false as const, error: "You already have a leave request for the selected dates." };
    }

    // --- BUSINESS LOGIC: CATEGORY CONVERSION & AUTO-APPROVAL ---
    let effectiveCategory = data.category;

    const start = new Date(data.startDate);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = start.getTime() - today.getTime();
    const daysInAdvance = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const isBackdated = daysInAdvance < 0;
    const isSameDay = daysInAdvance === 0;

    let isAutoApproved = false;
    let approvalNote = "";

    if (data.category === "SEMI_ANNUAL_POLICY_2") {
      // Semi-annual (Earned Leave): approved if applied 7+ days in advance, else admin approval required
      if (daysInAdvance >= 7) {
        isAutoApproved = true;
        approvalNote = "Semi-Annual Leave (Policy 2): Approved (Applied >= 7 days in advance).";
      } else {
        isAutoApproved = false;
        approvalNote = "Semi-Annual Leave (Policy 2): Pending Admin review (Applied with < 7 days notice).";
      }
    } else {
      // Monthly Policy 1 or Unpaid
      if (daysInAdvance > 0) {
        // Strictly future-dated (1+ days in advance): approved
        isAutoApproved = true;
        const typeLabel = data.category === "UNPAID" ? "Unpaid" : (data?.leaveType?.toLowerCase() || "standard");
        approvalNote = `Future ${typeLabel} leave: Approved.`;
      } else {
        // Same-day or backdated: Admin approval required
        isAutoApproved = false;
        const timingLabel = isSameDay ? "Same-day" : "Backdated";
        const typeLabel = data.category === "UNPAID" ? "Unpaid" : (data?.leaveType?.toLowerCase() || "standard");
        approvalNote = `${timingLabel} ${typeLabel} leave: Pending Admin review.`;
      }
    }

    // Ensure leaveType is null for non-monthly policies
    let finalLeaveType = data.leaveType;
    if (effectiveCategory !== "MONTHLY_POLICY_1") {
      finalLeaveType = null as any;
    }

    const newRequest = await prisma.leaveRequest.create({
      data: {
        userId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        duration: data.duration,
        category: effectiveCategory as any,
        leaveType: finalLeaveType as any,
        reason: data.reason,
        startTime: data.startTime,
        endTime: data.endTime,
        halfDayType: data.halfDayType,
        managerNote: approvalNote,
      }
    });

    // Trigger notifications to Admin, Accountant, Reporting Manager, and Team Leader
    try {
      const applicant = await prisma.user.findUnique({
        where: { id: userId },
        select: { tenantId: true, name: true, managerId: true, email: true, departmentId: true }
      });
      const applicantName = applicant?.name || "An employee";
      const applicantEmail = applicant?.email;

      let teamLeaderId: string | undefined;
      let teamLeaderEmail: string | undefined;
      if (applicant?.departmentId) {
        const dept = await prisma.department.findUnique({
          where: { id: applicant.departmentId },
          select: { teamLeaderId: true, teamLeader: { select: { email: true } } }
        });
        if (dept?.teamLeaderId && dept.teamLeaderId !== userId) {
          teamLeaderId = dept.teamLeaderId;
          teamLeaderEmail = dept.teamLeader?.email || undefined;
        }
      }

      const usersToNotify = await prisma.user.findMany({
        where: {
          AND: [
            { id: { not: userId } },
            {
              OR: [
                { role: { in: ["ADMIN", "SYSTEM_ADMIN", "ACCOUNTANT"] } },
                { id: applicant?.managerId || undefined },
                { id: teamLeaderId || undefined }
              ]
            }
          ]
        },
        select: { id: true, role: true, email: true }
      });

      const managerEmail = usersToNotify
        .find(u => u.id === applicant?.managerId)
        ?.email;

      const tlEmail = usersToNotify
        .find(u => u.id === teamLeaderId)
        ?.email || teamLeaderEmail;

      const accountantEmails = usersToNotify
        .filter(u => u.role === "ACCOUNTANT")
        .map(u => u.email)
        .filter(Boolean);

      const recipientEmails = Array.from(new Set([
        process.env.ADMIN_EMAIL, 
        managerEmail, 
        tlEmail,
        ...accountantEmails
      ].filter(email => email && email !== applicantEmail) as string[]));

      if (usersToNotify.length > 0) {
        const startStr = new Date(data.startDate).toLocaleDateString();
        const endStr = new Date(data.endDate).toLocaleDateString();
        const dateRange = startStr === endStr ? `on ${startStr}` : `from ${startStr} to ${endStr}`;

        let leaveCategoryName = "";
        if (data.category === "MONTHLY_POLICY_1") {
          leaveCategoryName = data.leaveType === "CASUAL" ? "Casual Leave" : "Medical Leave";
        } else if (data.category === "SEMI_ANNUAL_POLICY_2") {
          leaveCategoryName = "Semi-Annual Leave";
        } else if (data.category === "UNPAID") {
          leaveCategoryName = "Unpaid Leave";
        } else {
          leaveCategoryName = "Leave";
        }

        let leaveDurationDetails = "";
        if (data.duration === "FULL") {
          leaveDurationDetails = "Full Day";
        } else if (data.duration === "HALF") {
          const session = data.halfDayType === "FIRST_HALF" ? "1st Half" : "2nd Half";
          leaveDurationDetails = `Half Day (${session})`;
        } else if (data.duration === "SHORT") {
          leaveDurationDetails = `Short Leave (${data.startTime} - ${data.endTime})`;
        }

        const statusSubtitle = isAutoApproved ? "(Approved)" : "(Pending Admin Approval)";
        const notificationTitle = `${leaveDurationDetails} Leave Applied ${statusSubtitle} - ${applicantName}`;
        const notificationContent = isAutoApproved
          ? `${applicantName}'s request for ${leaveCategoryName} (${leaveDurationDetails.toLowerCase()}) ${dateRange} was approved.`
          : `${applicantName} has applied for ${leaveCategoryName} (${leaveDurationDetails.toLowerCase()}) ${dateRange}. Requires Admin approval.`;

        await prisma.notification.createMany({
          data: usersToNotify.map(u => {
            let link = "/dashboard";
            if (["ADMIN", "SYSTEM_ADMIN"].includes(u.role)) {
              link = "/dashboard/leaves/manage";
            } else if (u.role === "ACCOUNTANT") {
              link = "/dashboard/accountant?tab=approvals";
            }
            
            return {
              tenantId: applicant?.tenantId || u.tenantId,
              userId: u.id,
              title: notificationTitle,
              message: notificationContent,
              type: isAutoApproved ? "INFO" : "WARNING",
              link
            };
          })
        });
      }

      // Trigger the email to the admin, manager, and accountants
      await sendLeaveApplicationEmail({
        tenantId: applicant?.tenantId,
        applicantName,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        duration: data.duration,
        halfDayType: data.halfDayType,
        startTime: data.startTime,
        endTime: data.endTime,
        reason: data.reason,
        leaveType: data.category === "MONTHLY_POLICY_1" ? data.leaveType : undefined,
        toEmail: recipientEmails,
      });

      // Send confirmation email to applicant
      if (applicantEmail) {
        await sendLeaveApplicationEmail({
          tenantId: applicant?.tenantId,
          applicantName: "You",
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          duration: data.duration,
          halfDayType: data.halfDayType,
          startTime: data.startTime,
          endTime: data.endTime,
          reason: data.reason,
          leaveType: data.category === "MONTHLY_POLICY_1" ? data.leaveType : undefined,
          toEmail: applicantEmail,
        });
      }
      
    } catch (error) {
      console.error("Failed to send leave notifications or email:", error);
    }


    if (isAutoApproved) {
      await processLeaveRequestStatus(newRequest.id, "APPROVED", approvalNote);
    } else {
      // In case we ever disable auto-approval, notify that it's pending
      let leaveCategoryName = "";
      if (data.category === "MONTHLY_POLICY_1") {
        leaveCategoryName = data.leaveType === "CASUAL" ? "Casual Leave" : "Medical Leave";
      } else if (data.category === "SEMI_ANNUAL_POLICY_2") {
        leaveCategoryName = "Semi-Annual Leave";
      } else if (data.category === "UNPAID") {
        leaveCategoryName = "Unpaid Leave";
      } else {
        leaveCategoryName = "Leave";
      }

      let leaveDurationDetails = "";
      if (data.duration === "FULL") {
        leaveDurationDetails = "Full Day";
      } else if (data.duration === "HALF") {
        const session = data.halfDayType === "FIRST_HALF" ? "1st Half" : "2nd Half";
        leaveDurationDetails = `Half Day (${session})`;
      } else if (data.duration === "SHORT") {
        leaveDurationDetails = `Short Leave (${data.startTime} - ${data.endTime})`;
      }

      const startStr = new Date(data.startDate).toLocaleDateString();
      const endStr = new Date(data.endDate).toLocaleDateString();
      const dateRange = startStr === endStr ? `on ${startStr}` : `from ${startStr} to ${endStr}`;

      await createNotification({
        userId,
        title: `${leaveDurationDetails} Leave Submitted`,
        content: `Your request for ${leaveCategoryName} (${leaveDurationDetails.toLowerCase()}) ${dateRange} is pending review.`,
        type: "INFO",
        link: "/dashboard/employee/leaves"
      });
    }

    revalidatePath("/dashboard/employee");
    revalidatePath("/dashboard/employee/leaves");
    return { success: true as const };
  } catch (error) {
    console.error("Leave submission error:", error);
    return { success: false as const, error: "An unexpected error occurred." };
  }
}
export async function cancelApprovedLeave(requestId: string, note?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false as const, error: "Login required." };

  const { role } = session.user as any;
  const isAdminOrAccountant = ["ADMIN", "SYSTEM_ADMIN", "ACCOUNTANT"].includes(role);

  if (!isAdminOrAccountant) {
    return { success: false, error: "Unauthorized. Only Accountants or Admins can cancel approved leaves." };
  }

  try {
    const request = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: { user: true }
    });

    if (!request) return { success: false, error: "Request not found." };
    if (request.status !== "APPROVED") return { success: false, error: "Only approved requests can be cancelled." };

    const result = await prisma.$transaction(async (tx) => {
      const holidays = await tx.publicHoliday.findMany({
        where: {
          date: {
            gte: new Date(request.startDate.getFullYear(), request.startDate.getMonth(), 1),
            lte: new Date(request.endDate.getFullYear(), request.endDate.getMonth() + 1, 0, 23, 59, 59)
          }
        }
      });
      const holidayDates = holidays.map(h => h.date);
      const monthParts = splitLeaveIntoMonths(request.startDate, request.endDate, holidayDates);

      for (const part of monthParts) {
        const balance = await tx.leaveBalance.findUnique({
          where: { userId_month_year: { userId: request.userId, month: part.month, year: part.year } }
        });

        if (!balance) continue;

        let amountToRevert = 0;
        let balanceField: "remainingFull" | "remainingShort" | "semiAnnualRemaining" | null = null;
        let takenField: "fullTaken" | "shortTaken" | "semiAnnualTaken" | "unpaidTaken" | null = null;

        if (request.category === "MONTHLY_POLICY_1") {
          if (request.duration === "FULL") {
            amountToRevert = part.days;
            balanceField = "remainingFull";
            takenField = "fullTaken";
          } else if (request.duration === "HALF") {
            amountToRevert = 0.5 * part.days;
            balanceField = "remainingFull";
            takenField = "fullTaken";
          } else if (request.duration === "SHORT") {
            amountToRevert = 1;
            balanceField = "remainingShort";
            takenField = "shortTaken";
          }
        } else if (request.category === "SEMI_ANNUAL_POLICY_2") {
          amountToRevert = part.days;
          balanceField = "semiAnnualRemaining";
          takenField = "semiAnnualTaken";
        } else if (request.category === "UNPAID") {
          amountToRevert = request.duration === "HALF" ? 0.5 * part.days : part.days;
          takenField = "unpaidTaken";
        }

        if (balanceField && takenField) {
          let overflowRevert = 0;
          if (request.managerNote?.includes("[Auto-LWP:")) {
            const match = request.managerNote.match(/\[Auto-LWP: ([\d.]+)\]/);
            if (match) overflowRevert = parseFloat(match[1]);
          }

          const deductedFromBalance = amountToRevert - overflowRevert;

          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              [balanceField]: { increment: deductedFromBalance },
              [takenField]: { decrement: deductedFromBalance },
              unpaidTaken: { decrement: overflowRevert }
            }
          });
        } else if (takenField === "unpaidTaken") {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: { unpaidTaken: { decrement: amountToRevert } }
          });
        }
      }

      await tx.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: "REJECTED",
          managerNote: `CANCELLED by ${session.user.name || "Administration"}: ${note || "No reason provided."}`
        }
      });

      // Revert any auto-punch-outs that happened during this leave
      // BUT only for today onwards. Reverting past auto-punch-outs to null 
      // would cause the cron job to penalize them tonight!
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const startRevertDate = request.startDate < todayStart ? todayStart : request.startDate;

      if (startRevertDate <= request.endDate) {
        await tx.attendance.updateMany({
          where: {
            userId: request.userId,
            date: { gte: startRevertDate, lte: request.endDate },
            isAutoPunchOut: true
          },
          data: {
            punchOut: null,
            isAutoPunchOut: false
          }
        });
      }

      const config = await tx.systemConfig.findUnique({ where: { id: "GLOBAL_CONFIG" } });
      const startMonthConfig = (config as any)?.semiAnnualCycleStartMonth ?? 0;

      // Final Step: Cascade updates throughout the rest of the year
      let m = monthParts[0].month;
      let y = monthParts[0].year;

      while (true) {
        const current = await tx.leaveBalance.findUnique({
          where: { userId_month_year: { userId: request.userId, month: m, year: y } }
        });
        if (!current) break;

        let nextM = m + 1;
        let nextY = y;
        if (nextM > 12) {
          nextM = 1;
          nextY++;
        }

        const next = await tx.leaveBalance.findUnique({
          where: { userId_month_year: { userId: request.userId, month: nextM, year: nextY } }
        });
        if (!next) break;

        // 1. Recalculate split for CURRENT
        const oldCFFromCurrent = Number(current.carriedForward);
        const rem = round(current.remainingFull);
        const expectedCF = Math.min(rem, MAX_CARRY_FORWARD);
        const expectedEncash = round(rem - expectedCF);

        if (oldCFFromCurrent !== expectedCF || current.encashed !== expectedEncash) {
          await tx.leaveBalance.update({
            where: { id: current.id },
            data: { carriedForward: expectedCF, encashed: expectedEncash }
          });
        }

        // 2. Adjust NEXT's starting balance based on the NEW CF
        // Rule: Start_of_Next = ACCRUAL (1.0) + CF_From_Current
        // Since 'remainingFull' also includes 'used' leaves in that month, we adjust it relatively
        const cfDiff = round(expectedCF - oldCFFromCurrent);

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

        // 3. Sync Semi-Annual Sick pool if still in the same cycle
        const isSameCycle = getCycleKey(m, y, startMonthConfig) === getCycleKey(nextM, nextY, startMonthConfig);
        if (isSameCycle && next.semiAnnualRemaining !== current.semiAnnualRemaining) {
          await tx.leaveBalance.update({
            where: { id: next.id },
            data: { semiAnnualRemaining: current.semiAnnualRemaining }
          });
        }

        m = nextM;
        y = nextY;
        if (y > monthParts[0].year + 1) break; // Limit cascade to 1 year
      }

      return { success: true as const };
    });

    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/accountant");
    revalidatePath("/dashboard/employee/leaves");

    if (result.success) {
      const startStr = new Date(request.startDate).toLocaleDateString();
      const endStr = new Date(request.endDate).toLocaleDateString();
      const dateRange = startStr === endStr ? `on ${startStr}` : `from ${startStr} to ${endStr}`;

      await createNotification({
        userId: request.userId,
        title: "Leave Cancelled",
        content: `Your approved leave ${dateRange} has been cancelled by ${session.user.name || "Administration"}. Note: ${note || "No reason provided."}`,
        type: "WARNING",
        link: "/dashboard/employee/leaves"
      });

      // Send cancellation email to employee
      if (request.user.email) {
        await sendLeaveStatusUpdateEmail({
          tenantId: request.tenantId,
          applicantName: request.user.name || "Employee",
          startDate: request.startDate,
          endDate: request.endDate,
          duration: request.duration,
          halfDayType: request.halfDayType,
          startTime: request.startTime,
          endTime: request.endTime,
          status: 'CANCELLED',
          managerNote: note || "No reason provided.",
          toEmail: request.user.email,
        });
      }

      // Re-evaluate attendance records now that approved leave is cancelled
      await syncAttendanceWithApprovedLeaves(
        request.userId,
        request.startDate,
        request.endDate
      );
    }

    return result;

  } catch (error: any) {
    console.error("Cancellation error:", error);
    return { error: "Failed to cancel leave: " + error.message };
  }
}

// Helper needed by processLeaveRequestStatus (duplicated/moved here for scope)
function getCycleKey(month: number, year: number, sM: number) {
  const rel = (month - sM + 12) % 12;
  const isH1 = rel < 6;
  return `${year}-${isH1 ? "H1" : "H2"}`;
}

export async function getEmployeeLeaveBalance(targetMonth?: number, targetYear?: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const now = new Date();
  const month = targetMonth || (now.getMonth() + 1);
  const year = targetYear || now.getFullYear();

  try {
    const config = await prisma.systemConfig.findUnique({ where: { id: "GLOBAL_CONFIG" } });
    const balance = await ensureBalance(session.user.id, month, year, config?.semiAnnualCycleStartMonth);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
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

    const cycle = getCycleRange(month, year, config?.semiAnnualCycleStartMonth);
    const pendingSemiAnnualDays = await getCyclePendingDays(session.user.id, cycle.start, cycle.end);
    const availableSemiAnnual = Math.max(0, (balance.semiAnnualRemaining || 0) - pendingSemiAnnualDays);

    return {
      remainingFull: Number(balance.remainingFull || 0),
      remainingShort: Number(balance.remainingShort || 0),
      semiAnnualRemaining: availableSemiAnnual,
      isProbation,
      semiAnnualPolicyEnabled: config?.semiAnnualPolicyEnabled ?? true,
      month,
      year,
    };
  } catch (err) {
    console.error("Failed to fetch employee leave balance:", err);
    return null;
  }
}