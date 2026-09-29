import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { RequestLeaveButton } from "@/components/features/leave/request-leave-button";
import { AllowanceRequestDialog } from "@/components/features/leave/allowance-request-dialog";
import { OvertimeRequestDialog } from "@/components/features/leave/overtime-request-dialog";
import { LeaveHistoryTable } from "@/components/features/leave/leave-history-table";
import { EmployeeOvertimeTable } from "@/components/features/leave/employee-overtime-table";
import { EmployeeAllowanceTable } from "@/components/features/leave/employee-allowance-table";
import { DashboardTabs } from "@/components/features/dashboard/dashboard-tabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PageContainer,
  StatCard,
} from "@/components/ui";
import { CalendarRange, History, Clock4, AlertCircle } from "lucide-react";
import { ensureBalance } from "@/actions/leave/core";

export const dynamic = 'force-dynamic';

async function getLeaveData() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const balances = await ensureBalance(session.user.id, currentMonth, currentYear);

  const leaves = await prisma.leaveRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' }
  });

  const overtimes = await prisma.overtimeRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { date: 'desc' }
  });

  const allowances = await prisma.allowance.findMany({
    where: { userId: session.user.id },
    orderBy: { fromDate: 'desc' }
  });

  // Calculate annual stats
  const approvedThisYear = leaves.filter(
    (r) => r.status === "APPROVED" && new Date(r.startDate).getFullYear() === currentYear
  );

  const casualTaken = approvedThisYear
    .filter((r) => r.leaveType === "CASUAL")
    .reduce((acc, r) => {
      let days = Math.ceil((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (r.duration === "HALF") days = 0.5 * days;
      if (r.duration === "SHORT") days = 0;
      return acc + days;
    }, 0);

  const medicalTaken = approvedThisYear
    .filter((r) => r.leaveType === "MEDICAL")
    .reduce((acc, r) => {
      let days = Math.ceil((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (r.duration === "HALF") days = 0.5 * days;
      return acc + days;
    }, 0);

  const unpaidTaken = approvedThisYear
    .filter((r) => r.category === "UNPAID")
    .reduce((acc, r) => {
      let days = Math.ceil((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (r.duration === "HALF") days = 0.5 * days;
      return acc + days;
    }, 0);

  return {
    leaves: leaves.map(l => ({
      ...l,
      startDate: l.startDate.toISOString(),
      endDate: l.endDate.toISOString(),
      createdAt: l.createdAt.toISOString()
    })),
    overtimes: overtimes.map(o => ({
      ...o,
      date: o.date.toISOString().split('T')[0],
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    })),
    allowances: allowances.map((a: typeof allowances[number]) => ({
      ...a,
      fromDate: a.fromDate.toISOString().split('T')[0],
      toDate: a.toDate.toISOString().split('T')[0],
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
    stats: {
      casualTaken,
      medicalTaken,
      unpaidTaken,
      casualRemaining: Math.max(0, 12 - casualTaken),
      medicalRemaining: Math.max(0, 12 - medicalTaken),
      totalRequests: leaves.length,
      pendingCount: leaves.filter(l => l.status === "PENDING").length
    }
  };
}

export default async function EmployeeLeavesPage() {
  const data = await getLeaveData();
  if (!data) return null;

  return (
    <PageContainer maxWidth="full" className="py-8 space-y-4 animate-fade-in">
      {/* Executive Header Banner */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="size-8 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <CalendarRange className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none mb-0.5 sm:mb-1">
              My Leaves & Requests
            </h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1 sm:line-clamp-none">
              Manage leave applications, overtime tracking, and offsite allowance claims
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <OvertimeRequestDialog />
          <AllowanceRequestDialog />
          <RequestLeaveButton />
        </div>
      </div>

      <DashboardTabs />

      <div className="flex-1 space-y-4">
        {/* Stats Summary - High Density Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Casual Leave"
            value={`${data.stats.casualRemaining} days`}
            subValue={`${data.stats.casualTaken} days consumed`}
            icon={<CalendarRange className="size-4" />}
            progress={Math.round((data.stats.casualTaken / 12) * 100)}
            progressColor="bg-primary"
          />
          <StatCard
            label="Sick Leave"
            value={`${data.stats.medicalRemaining} days`}
            subValue={`${data.stats.medicalTaken} days consumed`}
            icon={<AlertCircle className="size-4" />}
            progress={Math.round((data.stats.medicalTaken / 12) * 100)}
            progressColor="bg-rose-500"
          />
          <StatCard
            label="Unpaid Leave"
            value={`${data.stats.unpaidTaken} days`}
            subValue="Deducted from salary"
            icon={<Clock4 className="size-4" />}
            progress={data.stats.unpaidTaken > 0 ? 100 : 0}
            progressColor="bg-amber-500"
          />
          <StatCard
            label="Total History"
            value={data.stats.totalRequests}
            subValue="Life-time requests"
            icon={<History className="size-4" />}
            progress={100}
            progressColor="bg-blue-500"
          />
        </div>

        {/* Main Data Section with Tabs */}
        <Tabs defaultValue="leaves" className="space-y-2">
          <TabsList className="bg-muted/40 p-1 h-9 rounded-md border border-border/70 grid grid-cols-3 max-w-xs sm:max-w-md">
            <TabsTrigger value="leaves" className="text-xs font-semibold rounded-md data-[state=active]:bg-card data-[state=active]:shadow-xs transition-all cursor-pointer">
              Leaves
            </TabsTrigger>
            <TabsTrigger value="overtime" className="text-xs font-semibold rounded-md data-[state=active]:bg-card data-[state=active]:shadow-xs transition-all cursor-pointer">
              Overtime
            </TabsTrigger>
            <TabsTrigger value="allowances" className="text-xs font-semibold rounded-md data-[state=active]:bg-card data-[state=active]:shadow-xs transition-all cursor-pointer">
              Allowances
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leaves" className="m-0">
            <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs animate-fade-in">
              <div className="px-5 py-4 border-b border-border/70 bg-muted/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                    <CalendarRange className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Leave History</h3>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Complete record of applications</p>
                  </div>
                </div>
              </div>
              <div className="p-0">
                <LeaveHistoryTable leaves={data.leaves as any} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="overtime" className="m-0">
            <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs animate-fade-in">
              <div className="px-5 py-4 border-b border-border/70 bg-muted/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                    <Clock4 className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Overtime Requests</h3>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Logged extra working hours</p>
                  </div>
                </div>
              </div>
              <div className="p-0">
                <EmployeeOvertimeTable data={data.overtimes as any} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="allowances" className="m-0">
            <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs animate-fade-in">
              <div className="px-5 py-4 border-b border-border/70 bg-muted/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                    <History className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Allowance Claims</h3>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Client meetings & offsite duty claims</p>
                  </div>
                </div>
              </div>
              <div className="p-0">
                <EmployeeAllowanceTable data={data.allowances as any} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
