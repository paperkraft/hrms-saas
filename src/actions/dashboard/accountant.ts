"use server"

import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ensureBalance } from "../leave/core"
import { getAllAnnouncementsForAdmin } from "../announcement"
import { getNotifications } from "../notification"
import { hasMenuAccess } from "@/lib/permissions"
import { getPayrollEligibleUserWhere } from "@/lib/payroll-helper"
import { appConfig } from "@/lib/app-config"

const nonDeveloperUserFilter = {
  NOT: [
    { email: { in: [appConfig.devAdminEmail, "dev@sigma.com"] } },
    { roleDefinition: { code: "SYSTEM_ADMIN" } }
  ]
};

// --- Helper: Shared Recent Approvals Logic ---
async function fetchRecentApprovals(take: number = 20, startDate?: Date) {
  const requests = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      user: nonDeveloperUserFilter,
      ...(startDate ? { updatedAt: { gte: startDate } } : {})
    },
    include: { user: { include: { department: true } } },
    orderBy: { updatedAt: "desc" },
    take
  });

  return requests.map((req: any) => ({
    id: req.id,
    employeeName: req.user.name || req.user.email,
    department: req.user.department?.name || "Team Member",
    avatarUrl: req.user.avatarUrl || null,
    startDate: new Date(req.startDate).toISOString().split('T')[0],
    endDate: new Date(req.endDate).toISOString().split('T')[0],
    category: req.category,
    duration: req.duration,
    halfDayType: req.halfDayType,
    leaveType: req.leaveType,
    reason: req.reason,
    systemNote: req.systemNote,
    updatedAt: req.updatedAt
  }));
}

async function fetchRecentAllowances(take: number = 50, startDate?: Date) {
  const allowances = await prisma.allowance.findMany({
    where: {
      user: nonDeveloperUserFilter,
      ...(startDate ? { createdAt: { gte: startDate } } : {})
    },
    include: { user: { include: { department: true } } },
    orderBy: { createdAt: "desc" },
    take
  });

  return allowances.map((allw: any) => ({
    id: allw.id,
    employeeName: allw.user.name || allw.user.email,
    department: allw.user.department?.name || "Team Member",
    avatarUrl: allw.user.avatarUrl || null,
    fromDate: new Date(allw.fromDate).toISOString().split('T')[0],
    toDate: new Date(allw.toDate).toISOString().split('T')[0],
    location: allw.location,
    status: allw.status,
    createdAt: allw.createdAt
  }));
}

async function fetchRecentOvertimeRequests(take: number = 50, startDate?: Date) {
  const overtimes = await prisma.overtimeRequest.findMany({
    where: {
      user: nonDeveloperUserFilter,
      ...(startDate ? { createdAt: { gte: startDate } } : {})
    },
    include: { user: { include: { department: true } } },
    orderBy: { createdAt: "desc" },
    take
  });

  return overtimes.map((ot: any) => ({
    id: ot.id,
    employeeName: ot.user.name || ot.user.email,
    department: ot.user.department?.name || "Team Member",
    avatarUrl: ot.user.avatarUrl || null,
    date: new Date(ot.date).toISOString().split('T')[0],
    hours: ot.hours,
    reason: ot.reason,
    status: ot.status,
    createdAt: ot.createdAt
  }));
}

async function fetchRecentGrievances(take: number = 50, startDate?: Date) {
  const grievances = await prisma.attendanceGrievance.findMany({
    where: {
      user: nonDeveloperUserFilter,
      ...(startDate ? { createdAt: { gte: startDate } } : {})
    },
    include: { user: { select: { name: true, email: true, employeeCode: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
    take
  });
  return grievances;
}

// --- Accountant Dashboard Stats ---
export async function getAccountantDashboardStats(reqMonth?: number, reqYear?: number, reqDate?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/accountant")) {
    throw new Error(`Unauthorized access for role: ${session?.user?.role || 'UNKNOWN'}`);
  }

  const now = new Date();
  let currentYear = reqYear || now.getUTCFullYear();
  let currentMonth = reqMonth || now.getUTCMonth() + 1;

  let startOfRange: Date;
  let endOfRange: Date;

  if (reqDate) {
    const [y, m, d] = reqDate.split('-').map(Number);
    currentYear = y;
    currentMonth = m;
    startOfRange = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    endOfRange = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  } else {
    // Whole Month range in UTC
    startOfRange = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0, 0));
    endOfRange = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999));
  }

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const tenantId = session.user.tenantId;

  const existingBalances = await prisma.leaveBalance.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      month: currentMonth,
      year: currentYear
    },
    select: { userId: true }
  });
  const existingUserIds = new Set(existingBalances.map(b => b.userId));

  const usersMissingBalance = await prisma.user.findMany({
    where: getPayrollEligibleUserWhere(
      {
        ...(tenantId ? { tenantId } : {}),
        createdAt: { lte: endOfRange },
        id: { notIn: Array.from(existingUserIds) },
      },
      { includePastPersonnel: true, dateRange: { start: startOfRange, end: endOfRange } }
    ),
    select: { id: true }
  });

  if (usersMissingBalance.length > 0) {
    await Promise.all(usersMissingBalance.map(u => ensureBalance(u.id, currentMonth, currentYear, undefined, tenantId)));
  }

  const users = await prisma.user.findMany({
    where: getPayrollEligibleUserWhere(
      {
        ...(tenantId ? { tenantId } : {}),
        createdAt: { lte: endOfRange },
      },
      { includePastPersonnel: true, dateRange: { start: startOfRange, end: endOfRange } }
    ),
    include: {
      department: true,
      attendances: {
        where: {
          date: { gte: startOfRange, lte: endOfRange }
        }
      },
      leaveBalances: {
        where: {
          OR: [
            { month: currentMonth, year: currentYear },
            { month: prevMonth, year: prevYear }
          ]
        }
      },
      leaveRequests: {
        where: {
          status: "APPROVED",
          startDate: { gte: startOfRange, lte: endOfRange }
        }
      },
      allowances: {
        where: {
          date: { gte: startOfRange, lte: endOfRange }
        }
      },
      overtimeRequests: {
        where: {
          date: { gte: startOfRange, lte: endOfRange },
          status: "APPROVED"
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  let totalLatesSystemWide = 0;
  let totalEncashments = 0;
  let totalLwpSystemWide = 0;
  let totalAllowancesSystemWide = 0;
  let totalOvertimeHoursSystemWide = 0;

  const config = session.user.tenantId
    ? await prisma.systemConfig.findUnique({ where: { tenantId: session.user.tenantId } })
    : null;
  const lateAllowed = config?.lateMarkAllowedCount ?? 0;
  const earlyAllowed = (config as any)?.earlyLogoffAllowedCount ?? 0;

  // Calculate the actual number of working days in the current month by excluding Sundays.
  // This dynamic value ensures accurate salary prorating regardless of the month's length (28, 29, 30, 31).
  const monthDaysCount = new Date(currentYear, currentMonth, 0).getDate();
  let workingDaysInMonth = 0;
  for (let d = 1; d <= monthDaysCount; d++) {
    if (new Date(currentYear, currentMonth - 1, d).getDay() !== 0) workingDaysInMonth++;
  }

  // Fetch public holidays in the current month
  const publicHolidays = await prisma.publicHoliday.findMany({
    where: {
      tenantId: session.user.tenantId,
      date: { gte: startOfRange, lte: endOfRange }
    }
  });
  // Only count holidays that don't fall on a Sunday, as Sundays are already excluded from workingDaysInMonth
  const validHolidaysCount = publicHolidays.filter(h => h.date.getDay() !== 0).length;

  const reportData = (users as any[]).map(user => {
    const attendances = user.attendances;
    const currentBalance = user.leaveBalances.find((lb: any) => lb.month === currentMonth && lb.year === currentYear);

    let allowanceDays = 0;
    let allowanceDaysWithoutAttendance = 0;
    const allowanceDateStrings = new Set<string>();

    user.allowances.forEach((allw: any) => {
      allowanceDateStrings.add(new Date(allw.date).toISOString().split('T')[0]);
    });

    allowanceDays = allowanceDateStrings.size;

    const attendanceDateStrings = new Set(attendances.map((a: any) => new Date(a.date).toISOString().split('T')[0]));
    allowanceDateStrings.forEach(dateStr => {
      const dateObj = new Date(dateStr);
      // Only protect working days (skip Sundays)
      if (!attendanceDateStrings.has(dateStr) && dateObj.getDay() !== 0) {
        allowanceDaysWithoutAttendance++;
      }
    });

    let paidLeaveOverlap = 0;
    user.leaveRequests.forEach((lr: any) => {
      if (lr.status === "APPROVED" && (lr.category === "MONTHLY_POLICY_1" || lr.category === "SEMI_ANNUAL_POLICY_2")) {
        // Half-day leaves do NOT count as overlap because the employee is expected to punch in for the working half of the shift.
        // Only FULL-day leaves count as overlap if the user also punched in on a full leave day.
        if (lr.duration !== "FULL") return;
        const leaveValue = 1.0;
        const start = lr.startDate > startOfRange ? lr.startDate : startOfRange;
        const end = lr.endDate < endOfRange ? lr.endDate : endOfRange;

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          if (attendanceDateStrings.has(dateStr)) {
            paidLeaveOverlap += leaveValue;
          }
        }
      }
    });

    const policy1FullUsed = currentBalance?.fullTaken ?? 0;
    const policy1ShortUsed = currentBalance?.shortTaken ?? 0;
    const policy2Used = currentBalance?.semiAnnualTaken ?? 0;
    const unpaidTaken = currentBalance?.unpaidTaken ?? 0;

    const totalLate = attendances.filter((a: any) => a.isLate).length;
    const specialCaseLate = attendances.filter((a: any) => a.isLate && a.isLateSpecialCase).length;

    // actualLate is total late minus waived special cases
    const actualLate = totalLate - specialCaseLate;

    // Excess lates beyond the allowed limit
    const excessLates = Math.max(0, actualLate - lateAllowed);

    // punishableLate is calculated based on total valid lates (actualLate) 
    // It groups lates by 3 and subtracts the allowance (lateAllowed) groups
    // If lateAllowed=3: 0-5 lates = 0 penalty, 6-8 lates = 1 penalty, 9-11 lates = 2 penalty
    const punishableLate = Math.max(0, Math.floor(actualLate / 3) - Math.floor(lateAllowed / 3));

    // Effective strictly from August 2026 onwards: 1.0 day per penalty tier.
    // Past months (July 2026 and earlier): 0.5 day per penalty tier.
    const isNewPolicyEffective = currentYear > 2026 || (currentYear === 2026 && currentMonth >= 8);
    const lateDeductionMultiplier = isNewPolicyEffective ? 1.0 : 0.5;
    const lateDeduction = punishableLate * lateDeductionMultiplier;

    const earlyEnabled = (config as any)?.earlyLogoffEnabled ?? false;
    const totalEarlyLogoff = earlyEnabled ? attendances.filter((a: any) => (a as any).isEarlyLogoff).length : 0;
    const earlyLogoffDeduction = (earlyEnabled && earlyAllowed > 0)
      ? (Math.floor(totalEarlyLogoff / earlyAllowed) * 0.5)
      : 0;

    // Calculate total present count considering technical half days (isHalfDay = 0.5)
    let presentCount = 0;
    attendances.forEach((a: any) => {
      const aDateStr = new Date(a.date).toISOString().split('T')[0];
      const hasHalfLeave = user.leaveRequests.some((lr: any) => {
        if (lr.duration !== "HALF") return false;
        const lStart = new Date(lr.startDate).toISOString().split('T')[0];
        const lEnd = new Date(lr.endDate).toISOString().split('T')[0];
        return aDateStr >= lStart && aDateStr <= lEnd;
      });
      const hasShortLeave = user.leaveRequests.some((lr: any) => {
        if (lr.duration !== "SHORT") return false;
        const lStart = new Date(lr.startDate).toISOString().split('T')[0];
        const lEnd = new Date(lr.endDate).toISOString().split('T')[0];
        return aDateStr >= lStart && aDateStr <= lEnd;
      });

      const isTechnicalHalfDay = a.isHalfDay && !hasHalfLeave && !hasShortLeave;

      if (isTechnicalHalfDay || hasHalfLeave) {
        presentCount += 0.5;
      } else {
        presentCount += 1.0;
      }
    });

    // Include valid public holidays and FULL/HALF day leaves as paid days,
    // BUT we subtract the exact overlap if they actually punched in on those leave days to prevent extra days.
    const totalPaidLeaves = policy1FullUsed + policy2Used + validHolidaysCount - paidLeaveOverlap;

    const totalPresentEquivalent = presentCount + allowanceDaysWithoutAttendance;

    // Calculate actual extra days worked (Sundays and valid public holidays where the employee punched in)
    let extraDaysCount = 0; // Number of extra punches (to offset missing days logic)
    let extraDaysWorked = 0; // Fractional value for payout (0.5 or 1.0 based on hours)

    const holidayDateStrings = new Set(publicHolidays.filter(h => h.date.getDay() !== 0).map(h => h.date.toISOString().split('T')[0]));

    attendances.forEach((a: any) => {
      const isSunday = new Date(a.date).getDay() === 0;
      const isHoliday = holidayDateStrings.has(new Date(a.date).toISOString().split('T')[0]);

      if (isSunday || isHoliday) {
        extraDaysCount++;
        let dayValue = 1.0;

        if (a.punchIn && a.punchOut) {
          const durationHours = (new Date(a.punchOut).getTime() - new Date(a.punchIn).getTime()) / (1000 * 60 * 60);
          if (durationHours < 4) {
            dayValue = 0.5;
          }
        } else if (!a.punchOut) {
          dayValue = 0.5; // If forgot to punch out, give half day
        }

        extraDaysWorked += dayValue;
      }
    });

    // Missing Days: If the user is present for fewer days than the expected working days (and hasn't taken paid leave),
    // these are considered undocumented absent days. They are added to LWP in payroll to ensure salary is correctly deducted.
    // By adding extraDaysCount to workingDaysInMonth, we prevent extra punches from hiding missing days.
    const missingDays = Math.max(0, workingDaysInMonth + extraDaysCount - (totalPresentEquivalent + totalPaidLeaves + unpaidTaken));

    // Total LWP includes approved unpaid leaves, late/early deductions.
    const lwpDays = unpaidTaken + lateDeduction + earlyLogoffDeduction;
    totalLwpSystemWide += lwpDays;

    // Extra days are now accounted for in the prorated Gross Salary, so we don't double-pay them here
    const totalEncashable = currentBalance?.encashed ?? 0;
    totalEncashments += totalEncashable;
    totalAllowancesSystemWide += allowanceDays;

    const overtimeHours = user.overtimeRequests?.reduce((sum: number, ot: any) => sum + ot.hours, 0) || 0;
    totalOvertimeHoursSystemWide += overtimeHours;

    let isProbation = false;
    if (user.joiningDate) {
      const probationEndDate = new Date(user.joiningDate);
      probationEndDate.setDate(probationEndDate.getDate() + 90);
      const targetMonthDate = new Date(currentYear, currentMonth - 1, 1);
      if (targetMonthDate < probationEndDate) {
        isProbation = true;
      }
    }

    return {
      id: user.id,
      name: user.name || user.email,
      role: user.role,
      department: (user as any).department?.name || "Team Member",
      avatarUrl: user.avatarUrl || null,
      totalPresent: presentCount,
      leavesTaken: policy1FullUsed + policy2Used + unpaidTaken,
      paidLeaves: policy1FullUsed + policy2Used,
      unpaidLeaves: unpaidTaken,
      publicHolidays: validHolidaysCount,
      totalLate,
      specialCaseLate,
      actualLate,
      punishableLate,
      lateDeduction,
      totalEarlyLogoff,
      lwpDays,
      missingDays,
      encashableDays: isProbation ? 0 : totalEncashable,
      extraDaysWorked,
      allowanceDays,
      overtimeHours,
      balances: {
        full: currentBalance?.remainingFull ?? 0,
        short: currentBalance?.remainingShort ?? 0,
        semiAnnual: isProbation ? 0 : (currentBalance?.semiAnnualRemaining ?? 0),
      },
      offSiteCount: (attendances as any[]).filter((a: any) => a.isOutsideOffice).length,
      isProbation
    };
  });

  const [
    recentApprovals,
    recentAllowances,
    recentOvertimes,
    recentGrievances,
    announcementsRes,
    notificationsRes,
    policies
  ] = await Promise.all([
    fetchRecentApprovals(20, startOfRange),
    fetchRecentAllowances(50, startOfRange),
    fetchRecentOvertimeRequests(50, startOfRange),
    fetchRecentGrievances(50, startOfRange),
    getAllAnnouncementsForAdmin(),
    getNotifications(20),
    prisma.policy.findMany({ take: 5, orderBy: { order: 'asc' } })
  ]);

  return {
    success: true,
    data: {
      reportData,
      recentApprovals,
      recentAllowances,
      recentOvertimes,
      recentGrievances,
      announcements: announcementsRes.data || [],
      notifications: notificationsRes.data || [],
      policies,
      userRole: session.user.role,
      stats: {
        totalStaff: users.length,
        totalLates: totalLatesSystemWide,
        totalEncashments: totalEncashments,
        totalLwp: totalLwpSystemWide,
        totalAllowances: totalAllowancesSystemWide,
        totalOvertimeHours: totalOvertimeHoursSystemWide,
        currentMonthName: new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' }),
        currentYear,
        currentMonth,
        date: reqDate || null,
        earlyLogoffEnabled: (config as any)?.earlyLogoffEnabled ?? false
      }
    }
  };
}

