import { Clock, FileText, IndianRupee, MapPin, Calendar, Calculator, CheckCircle2, Timer } from "lucide-react";
import { RecentApprovalsTable } from "@/components/features/dashboard/recent-approvals-table";
import { AllowanceRequestsTable } from "@/components/features/accountant/allowance-requests-table";
import { OvertimeRequestsTable } from "@/components/features/accountant/overtime-requests-table";
import { MasterReportTable } from "@/components/features/accountant/master-report-table";
import { AttendanceLedgerTable } from "@/components/features/accountant/attendance-ledger-table";
import { MonthFilter } from "@/components/features/accountant/month-filter";
import { FinancialSyncButton } from "@/components/features/accountant/financial-sync-button";
import { PageContainer } from "@/components/ui";
import { AccountantTabs } from "@/components/features/accountant/accountant-tabs";
import { getAccountantDashboardStats } from "@/actions/dashboard/accountant";
import { getAttendanceLedgerData } from "@/actions/attendance-ledger";
import { getSalaryStructures } from "@/actions/payroll/structure";
import { getPayrollRecords } from "@/actions/payroll/record";
import { PayrollSettingsTable } from "@/components/features/accountant/payroll-settings-table";
import { PayrollMasterTable } from "@/components/features/accountant/payroll-master-table";
import { QuickSlipForm } from "@/components/features/accountant/quick-slip-form";
import { GrievanceReviewTable } from "@/components/features/admin/grievance-review-table";
import { PayrollPinGate } from "@/components/features/accountant/PayrollPinGate";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasMenuAccess } from "@/lib/permissions";

export const dynamic = 'force-dynamic';

export default async function AccountantDashboard({
  searchParams
}: {
  searchParams: Promise<{ m?: string; y?: string; tab?: string; d?: string }>
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/accountant")) {
    redirect("/dashboard/employee");
  }

  const params = await searchParams;
  const m = params.m ? parseInt(params.m) : undefined;
  const y = params.y ? parseInt(params.y) : undefined;
  const d = params.d; // Date string yyyy-MM-dd
  const tab = params.tab || "report";

  const now = new Date();
  const targetMonth = m || now.getUTCMonth() + 1;
  const targetYear = y || now.getUTCFullYear();

  // Parallelize the primary fetch and conditional data fetches
  const [result, tabResult] = await Promise.all([
    getAccountantDashboardStats(m, y, d),
    tab === "ledger"
      ? getAttendanceLedgerData(targetMonth, targetYear)
      : (tab === "payroll-settings" || tab === "quick-slip")
      ? getSalaryStructures()
      : tab === "payroll-generation"
      ? getPayrollRecords(targetMonth, targetYear)
      : Promise.resolve(null)
  ]);

  if (!result.success || !result.data) return null;
  const { reportData, stats, recentApprovals, recentAllowances, recentOvertimes, recentGrievances } = result.data;

  let ledgerData: any = null;
  let salaryStructures: any = null;
  let payrollRecords: any = null;

  if (tab === "ledger" && tabResult?.success) {
    ledgerData = tabResult.data;
  } else if ((tab === "payroll-settings" || tab === "quick-slip") && tabResult?.success) {
    salaryStructures = tabResult.data;
  } else if (tab === "payroll-generation" && tabResult?.success) {
    payrollRecords = tabResult.data;
  }

  const monthDays = new Date(stats.currentYear, stats.currentMonth, 0).getDate();
  let workingDaysInMonth = 0;
  for (let day = 1; day <= monthDays; day++) {
    if (new Date(stats.currentYear, stats.currentMonth - 1, day).getDay() !== 0) workingDaysInMonth++;
  }
  if (workingDaysInMonth === 0) workingDaysInMonth = 26;

  return (
    <PageContainer maxWidth="full" className="py-6 animate-fade-in space-y-4">
      {/* Page Header Banner */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="size-8 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <IndianRupee className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none mb-0.5 sm:mb-1">
              Accountant Dashboard
            </h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1 sm:line-clamp-none">
              {d 
                ? `Daily attendance details and compliance audit for ${d}`
                : `Monthly payroll ledgers, salary structures, deductions, and financial sync for ${stats.currentMonthName} ${stats.currentYear}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <MonthFilter baseUrl="/dashboard/accountant" minDate="2026-05" />
          <FinancialSyncButton />
        </div>
      </div>

      <AccountantTabs />

      {tab === "report" ? (
        <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs animate-fade-in">
          <div className="px-4 py-3.5 border-b border-border/70 bg-card flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <FileText className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Master Report</h3>
                <p className="text-xs text-muted-foreground font-medium">End-of-month salary calculations and payroll register</p>
              </div>
            </div>
          </div>
          <div className="p-0">
            <MasterReportTable
              data={reportData}
              stats={stats}
              month={stats.currentMonth}
              monthName={stats.currentMonthName}
              year={stats.currentYear}
              earlyLogoffEnabled={stats.earlyLogoffEnabled}
              workingDays={workingDaysInMonth}
            />
          </div>
        </div>
      ) : tab === "ledger" ? (
        <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs animate-fade-in">
          <div className="px-4 py-3.5 border-b border-border/70 bg-card flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <Calendar className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Attendance Ledger</h3>
                <p className="text-xs text-muted-foreground font-medium">Monthly employee attendance register with datewise in/out times</p>
              </div>
            </div>
          </div>
          <div className="p-0">
            {ledgerData && (
              <AttendanceLedgerTable
                ledgerData={ledgerData.ledgerData}
                monthName={ledgerData.stats.monthName}
                year={ledgerData.stats.currentYear}
                month={ledgerData.stats.currentMonth}
                totalDaysInMonth={ledgerData.stats.totalDaysInMonth}
              />
            )}
          </div>
        </div>
      ) : tab === "allowances" ? (
        <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs animate-fade-in">
          <div className="px-4 py-3.5 border-b border-border/70 bg-card flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <MapPin className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Allowance Requests</h3>
                <p className="text-xs text-muted-foreground font-medium">Manage off-site business meeting allowances</p>
              </div>
            </div>
          </div>
          <div className="p-0">
            <AllowanceRequestsTable data={recentAllowances} />
          </div>
        </div>
      ) : tab === "overtime" ? (
        <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs animate-fade-in">
          <div className="px-4 py-3.5 border-b border-border/70 bg-card flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <Timer className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Overtime Requests</h3>
                <p className="text-xs text-muted-foreground font-medium">Manage employee overtime applications and approvals</p>
              </div>
            </div>
          </div>
          <div className="p-0">
            <OvertimeRequestsTable data={recentOvertimes} />
          </div>
        </div>
      ) : tab === "grievances" ? (
        <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs animate-fade-in">
          <div className="px-4 py-3.5 border-b border-border/70 bg-card flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <Clock className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Attendance Grievances</h3>
                <p className="text-xs text-muted-foreground font-medium">Review and approve missed punch requests</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-md">
              {recentGrievances.filter((d: any) => d.status === 'PENDING').length} Pending
            </span>
          </div>
          <div className="p-0">
            <GrievanceReviewTable data={recentGrievances} />
          </div>
        </div>
      ) : tab === "payroll-settings" ? (
        <PayrollPinGate
          title="Payroll Settings Vault"
          description="Enter Security PIN to manage fixed salary structures, allowances, and employee deductions."
        >
          <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs animate-fade-in">
            <div className="px-4 py-3.5 border-b border-border/70 bg-card flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                  <IndianRupee className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Payroll Settings</h3>
                  <p className="text-xs text-muted-foreground font-medium">Manage fixed salary structures and components for employees</p>
                </div>
              </div>
            </div>
            <div className="p-0">
              {salaryStructures && <PayrollSettingsTable data={salaryStructures} reportData={reportData} workingDaysInMonth={workingDaysInMonth} currentMonth={stats.currentMonth} />}
            </div>
          </div>
        </PayrollPinGate>
      ) : tab === "payroll-generation" ? (
        <PayrollPinGate
          title="Salary Slips & Payroll Vault"
          description="Enter Security PIN to generate, review, and download monthly salary slips."
        >
          <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs animate-fade-in">
            <div className="px-4 py-3.5 border-b border-border/70 bg-card flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                  <FileText className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Salary Slips & Payroll</h3>
                  <p className="text-xs text-muted-foreground font-medium">Generate, review, and download monthly salary slips</p>
                </div>
              </div>
            </div>
            <div className="p-0">
              <PayrollMasterTable
                data={payrollRecords || []}
                month={stats.currentMonth}
                monthName={stats.currentMonthName}
                year={stats.currentYear}
              />
            </div>
          </div>
        </PayrollPinGate>
      ) : tab === "quick-slip" ? (
        <PayrollPinGate
          title="Quick Payslip Generator"
          description="Enter Security PIN to generate on-demand prorated salary slips."
        >
          <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs animate-fade-in">
            <div className="px-4 py-3.5 border-b border-border/70 bg-card flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                  <Calculator className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Quick Payslip Generator</h3>
                  <p className="text-xs text-muted-foreground font-medium">Generate an instant, on-demand prorated salary slip</p>
                </div>
              </div>
            </div>
            <div className="p-0">
              {salaryStructures && <QuickSlipForm employees={salaryStructures} currentMonthName={stats.currentMonthName} currentYear={stats.currentYear} />}
            </div>
          </div>
        </PayrollPinGate>
      ) : (
        <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs animate-fade-in">
          <div className="px-4 py-3.5 border-b border-border/70 bg-card flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">History & Recent Approvals</h3>
                <p className="text-xs text-muted-foreground font-medium">Audit log for current monthly cycle</p>
              </div>
            </div>
          </div>
          <div className="p-0">
            <RecentApprovalsTable data={recentApprovals} />
          </div>
        </div>
      )}
    </PageContainer>
  );
}