import { AttendanceCard } from "@/components/features/attendance/punch-card";
import { DashboardTabs } from "@/components/features/dashboard/dashboard-tabs";
import { UpcomingLeave } from "@/components/features/dashboard/upcoming-leave";
import { LeaveBalanceOverview } from "@/components/features/dashboard/leave-balance-overview";
import { PageContainer } from "@/components/ui";
import { UpcomingMilestones } from "@/components/features/dashboard/upcoming-milestones";
import { CommunicationHub } from "@/components/features/dashboard/communication-hub";
import { getEmployeeDashboardStats } from "@/actions/dashboard/employee";
import { ProfileReminder } from "@/components/features/dashboard/profile-reminder";
import { HybridCompliance } from "@/components/features/dashboard/hybrid-compliance";
import { Sun, Moon, CloudSun } from "lucide-react";
import { TeamAvailability } from "@/components/features/dashboard/team-availability";
import { TodoList } from "@/components/features/dashboard/todo-list";
import { TaskInbox } from "@/components/features/projects/task-inbox";
import { getMyPendingTasks } from "@/actions/commitments/queries";
import { DepartmentLatePunchChart } from "@/components/features/dashboard/department-late-punch-chart";
import { getDaysDifference } from "@/lib/utils";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function EmployeeDashboard() {
  const [result, pendingResult] = await Promise.all([
    getEmployeeDashboardStats(),
    getMyPendingTasks()
  ]);
  if (!result.success || !result.data) return null;
  const data = result.data;
  const pendingTasks = (pendingResult.success ? pendingResult.data : []) ?? [];
  const workload = (pendingResult as any).workload ?? { activeTasks: 0, committedTasks: 0, estimatedHours: 0, capacityPct: 0, overdueTasks: 0 };

  const activeUpcomingLeaves = data.leaveRequests
    .filter(r => (r.status === "PENDING" || r.status === "APPROVED") && new Date(r.endDate).getTime() >= new Date().setHours(0, 0, 0, 0))
    .map(r => ({
      ...r,
      days: getDaysDifference(r.startDate, r.endDate)
    }));

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";

  const isExternal = (data as any).userRole === "EXTERNAL_USER";
  if (isExternal) {
    redirect("/dashboard/external");
  }

  return (
    <PageContainer maxWidth="full" className="py-8 animate-fade-in space-y-4">

      {/* Profile Update Reminder */}
      {data.isProfileIncomplete && (
        <ProfileReminder
          user={{ id: '', name: data.userName, email: '' }}
          missingFields={data.incompleteFields}
        />
      )}

      {/* Executive Header Banner */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="size-8 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            {greeting === "Good morning" ? <CloudSun className="size-4 sm:size-5" /> : greeting === "Good afternoon" ? <Sun className="size-4 sm:size-5" /> : <Moon className="size-4 sm:size-5" />}
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none mb-0.5 sm:mb-1">
              {greeting}, {data.userName.split(' ')[0]}
            </h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1 sm:line-clamp-none">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Employee Self-Service Workspace
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Hidden for External Users) */}
      {!isExternal && <DashboardTabs />}

      {/* TOP PRIORITY ROW: Check In/Out + Leave Stat Cards (Hidden for External Users) */}
      {!isExternal && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Check In/Out — Primary daily action */}
          <div className="lg:col-span-5">
            <AttendanceCard
              initialStatus={data.sessionStatus}
              punchInTime={data.punchInTime}
              autoPunchOutCount={data.autoPunchOutCount}
              warningThreshold={3}
              officeLocation={(data as any).officeLocation ?? null}
              officeLocations={(data as any).officeLocations ?? []}
            />
          </div>
          {/* Leave Balance — 2×2 stat grid alongside attendance */}
          <div className="lg:col-span-7 space-y-4">
            <LeaveBalanceOverview
              casual={{
                remaining: data.balances.casualRemaining
              }}
              casualYearly={{
                taken: data.balances.casualYearlyTaken,
                total: data.balances.casualYearlyTotal
              }}
              sickYearly={{
                taken: data.balances.sickYearlyTaken,
                total: data.balances.sickYearlyTotal
              }}
              earned={{
                remaining: data.balances.earnedRemaining,
                total: data.balances.earnedYearlyTotal
              }}
            />
            {(data as any).hybridStats && (
              <HybridCompliance stats={(data as any).hybridStats} />
            )}
          </div>
        </div>
      )}

      {/* SECONDARY ROW: Balanced Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* TASK INBOX — Rendered inside Bento Grid when employee has pending tasks */}
        {pendingTasks.length > 0 && (
          <div className="flex flex-col">
            <TaskInbox pendingTasks={pendingTasks as any} workload={workload} />
          </div>
        )}

        {/* 1. Upcoming Events */}
        <div className="flex flex-col">
          <UpcomingMilestones
            holidays={data.holidays}
            upcomingBirthdays={data.stats.upcomingBirthdays}
            upcomingAnniversaries={data.stats.upcomingAnniversaries}
          />
        </div>

        {/* 2. My Upcoming Leaves */}
        {!isExternal && activeUpcomingLeaves.length > 0 && (
          <div className="flex flex-col">
            <UpcomingLeave requests={activeUpcomingLeaves} />
          </div>
        )}

        {/* 3. Broadcast & Feed Hub */}
        <div className="flex flex-col">
          <CommunicationHub
            announcements={data.announcements}
            notifications={data.notifications}
            policies={data.policies}
            role={data.userRole}
            userAllowedMenus={(data as any).userAllowedMenus}
          />
        </div>

        {/* 4. Team Activity */}
        {((data.teamPresenceGroups && (data.teamPresenceGroups as any[]).length > 0) || (data.teamAvailability && (data.teamAvailability as any[]).length > 0)) && (
          <div className="flex flex-col">
            <TeamAvailability
              groups={data.teamPresenceGroups as any}
              members={data.teamAvailability as any}
            />
          </div>
        )}

        {/* 5. Personal To-Do Workspace */}
        <div className="flex flex-col">
          <TodoList initialTodos={data.todos as any} />
        </div>

        {/* 6. Department Late Punch Rate */}
        {!isExternal && (
          <div className="flex flex-col">
            {data.departmentLatePatterns && (
              <DepartmentLatePunchChart data={data.departmentLatePatterns} />
            )}
          </div>
        )}

      </div>
    </PageContainer>
  );
}