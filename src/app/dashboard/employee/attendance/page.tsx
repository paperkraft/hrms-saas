import {
  History,
  Clock,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  PageContainer,
  StatCard,
} from "@/components/ui";
import { AttendanceHistoryTable } from "@/components/features/dashboard/attendance-history-table";
import { DashboardTabs } from "@/components/features/dashboard/dashboard-tabs";
import { AttendanceCalendar } from "@/components/features/attendance/attendance-calendar";
import { MonthFilter } from "@/components/features/accountant/month-filter";
import { GrievanceDialog } from "@/components/features/employee/grievance-dialog";
import { EmployeeGrievanceList } from "@/components/features/employee/employee-grievance-list";

export const dynamic = 'force-dynamic';

async function getAttendanceHistory(month: number, year: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { createdAt: true }
  });

  const startDate = new Date(year, month - 1, -7);
  const endDate = new Date(year, month, 14);

  const logs = await prisma.attendance.findMany({
    where: {
      userId: session.user.id,
      date: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: { date: 'desc' }
  });

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      userId: session.user.id,
      status: "APPROVED"
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      category: true,
      reason: true
    }
  });

  const holidays = await prisma.publicHoliday.findMany({
    orderBy: { date: 'asc' }
  });

  const currentMonthLogs = logs.filter(l => {
    const d = new Date(l.date);
    return d.getMonth() === (month - 1) && d.getFullYear() === year;
  });

  const grievances = await prisma.attendanceGrievance.findMany({
    where: {
      userId: session.user.id,
      date: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: { date: 'desc' }
  });

  const currentMonthGrievances = grievances.filter(g => {
    const d = new Date(g.date);
    return d.getMonth() === (month - 1) && d.getFullYear() === year;
  });

  const stats = {
    totalPunches: currentMonthLogs.length,
    onTime: currentMonthLogs.filter(l => (!l.isLate || l.isLateSpecialCase) && l.punchIn).length,
    late: currentMonthLogs.filter(l => l.isLate && !l.isLateSpecialCase).length,
    autoPunchOuts: currentMonthLogs.filter(l => l.isAutoPunchOut).length,
  };

  return { logs, currentMonthLogs, currentMonthGrievances, leaves, holidays, stats, createdAt: user?.createdAt };
}

export default async function AttendanceHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const now = new Date();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const monthStr = resolvedSearchParams.m as string;
  const yearStr = resolvedSearchParams.y as string;
  const month = monthStr ? parseInt(monthStr) : now.getMonth() + 1;
  const year = yearStr ? parseInt(yearStr) : now.getFullYear();

  const { logs, currentMonthLogs, currentMonthGrievances, leaves, holidays, stats, createdAt } = await getAttendanceHistory(month, year);

  // Create a Date object for the calendar widget
  const calendarDate = new Date(year, month - 1, 1);

  return (
    <PageContainer maxWidth="full" className="py-8 space-y-4 animate-fade-in">
      {/* Executive Header Banner */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="size-8 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <History className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none mb-0.5 sm:mb-1">
              Attendance History
            </h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1 sm:line-clamp-none">
              Monthly session logs, attendance calendar, and missed punch adjustments
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2.5 w-full sm:w-auto">
          <GrievanceDialog />
          <MonthFilter
            baseUrl="/dashboard/employee/attendance"
            minDate={createdAt ? (() => {
              const d = new Date(createdAt);
              const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              return m < "2026-05" ? "2026-05" : m;
            })() : "2026-05"}
          />
        </div>
      </div>

      <DashboardTabs />

      <div className="flex-1 space-y-4">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Logs"
            value={stats.totalPunches}
            subValue="All sessions"
            icon={<History className="size-4" />}
            progress={100}
            progressColor="bg-primary"
          />
          <StatCard
            label="On-Time"
            value={stats.onTime}
            subValue="Compliant arrivals"
            icon={<CheckCircle2 className="size-4" />}
            progress={stats.totalPunches > 0 ? (stats.onTime / stats.totalPunches) * 100 : 0}
            progressColor="bg-emerald-500"
          />
          <StatCard
            label="Late Arrivals"
            value={stats.late}
            subValue="Delayed check-ins"
            icon={<Clock className="size-4" />}
            progress={stats.totalPunches > 0 ? (stats.late / stats.totalPunches) * 100 : 0}
            progressColor="bg-amber-500"
          />
          <StatCard
            label="Auto Checkout"
            value={stats.autoPunchOuts}
            subValue="System closures"
            icon={<AlertCircle className="size-4" />}
            progress={stats.totalPunches > 0 ? (stats.autoPunchOuts / stats.totalPunches) * 100 : 0}
            progressColor="bg-rose-500"
          />
        </div>

        {/* Responsive Grid Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* Calendar Grid */}
          <div className="xl:col-span-5 h-full">
            <AttendanceCalendar logs={logs} leaves={leaves} holidays={holidays} joinedDate={createdAt} currentDate={calendarDate} />
          </div>

          {/* History Table */}
          <div className="xl:col-span-7 bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs animate-fade-in">
            <div className="px-5 py-4 border-b border-border/70 bg-muted/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                  <CalendarDays className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Session Logs</h3>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Recent operational activity registry</p>
                </div>
              </div>
            </div>
            <div className="p-0">
              <AttendanceHistoryTable logs={currentMonthLogs} />
            </div>
          </div>

          {/* Grievances List */}
          {currentMonthGrievances.length > 0 && (
            <div className="xl:col-span-12">
              <EmployeeGrievanceList grievances={currentMonthGrievances} />
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
