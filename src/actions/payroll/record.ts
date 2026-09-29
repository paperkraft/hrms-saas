"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccountantDashboardStats } from "../dashboard/accountant";
import { hasMenuAccess } from "@/lib/permissions";
import { getPayrollEligibleUserWhere } from "@/lib/payroll-helper";
import { appConfig } from "@/lib/app-config";


export async function updatePayrollRecord(recordId: string, updates: { reimbursement?: number, advance?: number, allowance?: number }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/accountant", "/dashboard/admin")) {
    throw new Error("Unauthorized");
  }

  const record = await prisma.payrollRecord.findUnique({ where: { id: recordId } });
  if (!record) throw new Error("Record not found");

  const newReimbursement = updates.reimbursement !== undefined ? updates.reimbursement : record.reimbursement;
  const newAdvance = updates.advance !== undefined ? updates.advance : record.advance;
  const newAllowance = updates.allowance !== undefined ? updates.allowance : record.allowance;

  const basic = record.basic;
  const hra = record.hra;
  const conveyance = record.conveyance;
  const consolidated = record.consolidated;
  const medical = record.medical;
  const childrenEducation = record.childrenEducation;
  const childrenHostel = record.childrenHostel;

  const gross_salary = basic + hra + conveyance + consolidated + medical + childrenEducation + childrenHostel;

  // subtotalAdditions uses newReimbursement, which already includes overtimePay if unedited.
  // We DO NOT add record.overtimePay again to avoid double counting!
  const subtotalAdditions = gross_salary + newReimbursement + newAllowance + record.bonus;

  // Recalculate PF, ESIC, PT based on the new basic and gross_salary
  const pf = Math.round(Math.min(basic, 15000) * 0.12);

  const user = await prisma.user.findUnique({ where: { id: record.userId }, include: { salaryStructure: true } });
  const isFemale = user?.gender === "FEMALE";
  const ptAmount = record.month === 2 ? 300 : 200;
  const pt = isFemale ? (record.grossSalary >= 26000 ? ptAmount : 0) : (record.grossSalary >= 10000 ? ptAmount : 0);

  const esicApplicable = user?.salaryStructure?.esic ? user.salaryStructure.esic > 0 : false;
  const esic = (esicApplicable && basic <= 21000) ? Math.round(basic * 0.0075) : 0;
  const tds = record.tds;
  const subtotalDeductions = pf + pt + tds + esic + newAdvance + record.unpaidLeaveDeduction;

  let netSalary = subtotalAdditions - subtotalDeductions;
  if (netSalary < 0) netSalary = 0;

  const updated = await prisma.payrollRecord.update({
    where: { id: recordId },
    data: {
      reimbursement: newReimbursement,
      advance: newAdvance,
      allowance: newAllowance,
      grossSalary: record.grossSalary,
      basic,
      hra,
      conveyance,
      consolidated,
      medical,
      childrenEducation,
      childrenHostel,
      subtotalAdditions,
      providentFund: pf,
      professionalTax: pt,
      esic,
      subtotalDeductions,
      netSalary
    }
  });

  return { success: true, message: "Payroll updated successfully", data: updated };
}

export async function deletePayrollRecord(recordId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/accountant", "/dashboard/admin")) {
    throw new Error("Unauthorized");
  }

  await prisma.payrollRecord.delete({ where: { id: recordId } });
  return { success: true, message: "Payroll record deleted successfully" };
}

export async function getPayrollRecords(month: number, year: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/accountant", "/dashboard/admin")) {
    throw new Error("Unauthorized");
  }

  const records = await prisma.payrollRecord.findMany({
    where: {
      month,
      year,
      user: {
        role: { not: "SYSTEM_ADMIN" },
        NOT: [
          { role: "SYSTEM_ADMIN" },
          { email: { in: [appConfig.devAdminEmail, "dev@sigma.com"] } },
          { roleDefinition: { code: "SYSTEM_ADMIN" } }
        ]
      }
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          designation: true,
          employeeCode: true,
          department: { select: { name: true } },
          salaryStructure: {
            select: {
              pfAccountNumber: true,
              basic: true,
              bankName: true,
              accountNumber: true,
              panNumber: true
            }
          }
        }
      }
    },
    orderBy: { user: { name: "asc" } }
  });

  return { success: true, data: records };
}

export async function generateMonthlyPayroll(month: number, year: number, forceRegenerate: boolean = false, targetUserId?: string, payAnnualBonus: boolean = false) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/accountant", "/dashboard/admin")) {
    throw new Error("Unauthorized");
  }

  const dashboardStats = await getAccountantDashboardStats(month, year);
  if (!dashboardStats.success || !dashboardStats.data) {
    throw new Error("Failed to fetch dashboard stats");
  }

  const { reportData } = dashboardStats.data;

  const startOfRange = new Date(Date.UTC(year, month - 1, 1));
  const endOfRange = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const users = await prisma.user.findMany({
    where: getPayrollEligibleUserWhere(
      targetUserId ? { id: targetUserId } : undefined,
      { includePastPersonnel: true, dateRange: { start: startOfRange, end: endOfRange } }
    ),
    include: {
      salaryStructure: true,
      attendances: {
        where: {
          date: {
            gte: startOfRange,
            lte: endOfRange
          }
        }
      }
    }
  });

  // Calculate the actual number of working days in the month (Total Days - Sundays)
  // This dynamic value replaces the old hardcoded "26" to ensure mathematically precise prorating.
  const monthDays = new Date(year, month, 0).getDate();
  let workingDaysInMonth = 0;
  for (let d = 1; d <= monthDays; d++) {
    if (new Date(year, month - 1, d).getDay() !== 0) workingDaysInMonth++;
  }
  // Fallback in case workingDaysInMonth is 0 to avoid division by zero
  if (workingDaysInMonth === 0) workingDaysInMonth = 26;

  const existingRecords = await prisma.payrollRecord.findMany({
    where: { month, year }
  });

  const yearRecords = await prisma.payrollRecord.findMany({
    where: { year }
  });

  const payrollsToUpsert = [];

  for (const user of users) {
    const struct = user.salaryStructure;
    if (!struct || struct.excludeFromPayroll) continue;

    const reportRow = reportData.find(r => r.id === user.id);
    if (!reportRow) continue;

    // For inactive, resigned, or terminated personnel:
    // Only generate payroll if the employee was actually present/worked within this evaluated month.
    // If they were completely inactive with 0 presence during this month, exclude them.
    const isNonActive = user.status !== "ACTIVE";
    const hasPresenceInMonth = user.attendances.length > 0 || (reportRow.totalPresent || 0) > 0 || (reportRow.allowanceDays || 0) > 0;
    if (isNonActive && !hasPresenceInMonth) {
      continue;
    }

    let totalWorkingHours = 0;
    let actualPresentDaysForAvg = 0;

    for (const att of user.attendances) {
      if (att.punchIn && att.punchOut && !att.isOutsideOffice) {
        const diff = new Date(att.punchOut).getTime() - new Date(att.punchIn).getTime();
        totalWorkingHours += diff / (1000 * 60 * 60);
        actualPresentDaysForAvg++;
      }
    }

    const averageWorkingHours = actualPresentDaysForAvg > 0 ? (totalWorkingHours / actualPresentDaysForAvg) : 0;

    const publicHolidays = reportRow.publicHolidays || 0;
    const paidLeave = reportRow.paidLeaves || 0;
    // For payroll, we deduct penalties (lwpDays) plus undocumented missing days
    const unpaidLeave = (reportRow.lwpDays || 0) + (reportRow.missingDays || 0);

    // By default, present days is the total working days in the month (e.g., 26 days).
    // Paid leaves do not reduce this. Only unpaid leaves/deductions reduce present days.
    const presentDays = Math.max(0, workingDaysInMonth - unpaidLeave);
    const allowanceDays = reportRow.allowanceDays;
    const overtimeHours = reportRow.overtimeHours;
    const extraDays = reportRow.extraDaysWorked || 0;

    // If an inactive employee has 0 payable days, skip generation
    if (isNonActive && presentDays <= 0) {
      continue;
    }

    const existingRecord = existingRecords.find(r => r.userId === user.id);

    const CMS = struct.grossSalary > 0 ? struct.grossSalary : struct.basic;
    // Payable Days is strictly the evaluated presentDays (which is Working Days - Unpaid Leaves)
    const payableDays = presentDays;

    // Prorate the Gross Salary upfront based on Payable Days vs Working Days in the Month
    const derivedGross = Math.round((CMS / workingDaysInMonth) * payableDays);

    // Calculate components based on the PRORATED Gross Salary
    const basic = Math.round(derivedGross * 0.50);
    const hra = Math.round(basic * 0.50);

    // Dynamically deduct children allowances based on derivedGross (5% each if applicable)
    const childrenEducation = struct.childrenEducation > 0 ? Math.round(derivedGross * 0.05) : 0;
    const childrenHostel = struct.childrenHostel > 0 ? Math.round(derivedGross * 0.05) : 0;

    // Remaining pool for Conveyance, Consolidated, and Medical
    const totalRemaining = Math.max(0, derivedGross - (basic + hra) - childrenEducation - childrenHostel);

    // Proportions: Conveyance (10%), Consolidated (10%), Medical (5%) -> 40%, 40%, 20% of the 25% pool
    const conveyance = Math.round(totalRemaining * 0.40);
    const consolidated = Math.round(totalRemaining * 0.40);
    const medical = Math.round(totalRemaining) - conveyance - consolidated; // Remainder to ensure exact match

    const gross_salary = basic + hra + conveyance + consolidated + medical + childrenEducation + childrenHostel;

    // Overtime pay is based on the base daily rate
    const overtimePay = Math.round((CMS / workingDaysInMonth / 8) * overtimeHours);

    // Auto-reimbursement cashes out encashable days PLUS extra days worked (e.g., Sundays)
    const extraDaysPay = Math.round((CMS / workingDaysInMonth) * extraDays);
    const autoReimbursement = Math.round((CMS / workingDaysInMonth) * (reportRow.encashableDays || 0)) + extraDaysPay;

    // If forceRegenerate is true, we ignore the existing record for manual additions
    const safeExistingRecord = forceRegenerate ? null : existingRecord;

    // Preserve manually entered allowance and reimbursement ONLY if not force regenerating
    const computedAllowance = safeExistingRecord
      ? safeExistingRecord.allowance
      : (struct.allowance > 0 ? struct.allowance : (allowanceDays * 350));
    const manualReimbursement = 0;
    const reimbursement = safeExistingRecord
      ? safeExistingRecord.reimbursement
      : (manualReimbursement + autoReimbursement + overtimePay);

    let bonus = 0;
    if (payAnnualBonus) {
      // Check if bonus already paid in a DIFFERENT month this year
      const alreadyPaid = yearRecords.some(r => r.userId === user.id && r.bonus > 0 && r.month !== month);
      if (!alreadyPaid) {
        bonus = struct.annualBonus || 0;
      } else {
        // Fallback to existing manual bonus if any, or 0
        bonus = safeExistingRecord ? safeExistingRecord.bonus : 0;
      }
    } else {
      bonus = safeExistingRecord ? safeExistingRecord.bonus : 0;
    }

    const subtotalAdditions = gross_salary + reimbursement + computedAllowance + bonus;

    const pf = Math.round(Math.min(basic, 15000) * 0.12);

    const isFemale = user.gender === "FEMALE";
    const ptAmount = month === 2 ? 300 : 200;
    const pt = isFemale ? (CMS >= 26000 ? ptAmount : 0) : (CMS >= 10000 ? ptAmount : 0);
    const fullBasic = Math.round(CMS * 0.50);
    const esicApplicable = struct.esic > 0;
    const esic = (esicApplicable && basic <= 21000) ? Math.round(basic * 0.0075) : 0;

    // TDS is permanently disabled as per configuration
    const tds = 0;
    // Preserve manually entered advance if a record already exists (and not force regenerating)
    const advance = safeExistingRecord
      ? safeExistingRecord.advance
      : 0;

    // Unpaid leaves are already accounted for by prorating the Gross Salary upfront,
    // so we set the explicit deduction step to 0 to avoid double-deduction.
    const unpaidLeaveDeduction = 0;

    const subtotalDeductions = pf + pt + tds + esic + advance;

    let netSalary = subtotalAdditions - subtotalDeductions;
    if (netSalary < 0) netSalary = 0;

    payrollsToUpsert.push({
      userId: user.id,
      month,
      year,
      presentDays,
      paidLeave,
      unpaidLeave,
      extraDays,
      averageWorkingHours,
      grossSalary: CMS,
      basic,
      hra,
      conveyance,
      consolidated,
      medical,
      childrenEducation,
      childrenHostel,
      allowance: computedAllowance,
      reimbursement,
      bonus,
      subtotalAdditions,
      professionalTax: pt,
      providentFund: pf,
      advance,
      tds,
      esic,
      unpaidLeaveDeduction,
      subtotalDeductions,
      netSalary,
      overtimePay,
      status: "FINALIZED"
    });
  }

  await prisma.$transaction(
    payrollsToUpsert.map(p =>
      prisma.payrollRecord.upsert({
        where: {
          userId_month_year: {
            userId: p.userId,
            month: p.month,
            year: p.year
          }
        },
        update: {
          presentDays: p.presentDays,
          paidLeave: p.paidLeave,
          unpaidLeave: p.unpaidLeave,
          extraDays: p.extraDays,
          averageWorkingHours: p.averageWorkingHours,
          grossSalary: p.grossSalary,
          basic: p.basic,
          hra: p.hra,
          conveyance: p.conveyance,
          consolidated: p.consolidated,
          medical: p.medical,
          childrenEducation: p.childrenEducation,
          childrenHostel: p.childrenHostel,
          allowance: p.allowance,
          reimbursement: p.reimbursement,
          bonus: p.bonus,
          subtotalAdditions: p.subtotalAdditions,
          professionalTax: p.professionalTax,
          providentFund: p.providentFund,
          advance: p.advance,
          tds: p.tds,
          esic: p.esic,
          unpaidLeaveDeduction: p.unpaidLeaveDeduction,
          subtotalDeductions: p.subtotalDeductions,
          netSalary: p.netSalary,
          overtimePay: p.overtimePay,
          status: "FINALIZED"
        },
        create: p as any
      })
    )
  );

  return { success: true, message: `Generated ${payrollsToUpsert.length} payroll records.` };
}
