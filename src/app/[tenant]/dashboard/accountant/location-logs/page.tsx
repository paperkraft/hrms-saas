import { getInitials } from "@/lib/utils";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LocationLogsTable } from "@/components/features/accountant/location-logs-table";
import { PageContainer, Avatar, AvatarImage, AvatarFallback } from "@/components/ui";
import { getLocationLogsAction } from "@/actions/attendance";
import { getAdminDashboardStats } from "@/actions/dashboard/admin";
import { DateFilter } from "@/components/features/accountant/date-filter";
import { CheckCircle2, Calendar, XCircle, MapPin, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasMenuAccess } from "@/lib/permissions";

export const dynamic = 'force-dynamic';

export default async function LocationLogsPage({
  searchParams
}: {
  searchParams: Promise<{ d?: string }>
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/accountant/location-logs", "/dashboard/accountant", "/dashboard/admin")) {
    redirect("/dashboard/employee");
  }

  const params = await searchParams;
  let d = params.d;
  if (!d) {
    const today = new Date();
    d = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  const [logsResult, statsResult] = await Promise.all([
    getLocationLogsAction(undefined, undefined, d),
    getAdminDashboardStats(d)
  ]);

  if (!logsResult.success || !logsResult.data || !statsResult.success || !statsResult.data) {
    return <div>Error loading data</div>;
  }

  const { logs, stats: locationStats } = logsResult.data;
  const dashboardStats = statsResult.data;

  return (
    <PageContainer maxWidth="full" className="py-6 animate-fade-in space-y-4">
      {/* ── Page Header Banner ── */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="size-8 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <MapPin className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none mb-0.5 sm:mb-1">
              Daily Attendance
            </h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1 sm:line-clamp-none">
              {locationStats.date
                ? `Geofence verification & live punch records for ${new Date(locationStats.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : `Geofence verification records for ${locationStats.monthName} ${locationStats.year}`
              }
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DateFilter currentDate={d} baseUrl="/dashboard/accountant/location-logs" />
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <Tabs defaultValue="present" className="w-full max-w-full">
        <div className="flex items-center justify-between gap-4">
          <TabsList className="bg-muted/40 p-1 rounded-md border border-border/70 h-10 sm:h-9 w-full sm:w-auto flex items-center justify-start gap-1 overflow-x-auto scrollbar-hide">
            <TabsTrigger
              value="present"
              className="h-8 px-3 sm:px-4 text-xs font-bold rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-border/60 transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-initial shrink-0"
            >
              <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
              <span>Present</span>
              <span className="ml-1 bg-emerald-500/10 text-emerald-600 px-1.5 py-0.2 rounded font-mono text-[10px] font-bold">
                {logs.length}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="on-leave"
              className="h-8 px-3 sm:px-4 text-xs font-bold rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-border/60 transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-initial shrink-0"
            >
              <Calendar className="size-3.5 text-amber-600 shrink-0" />
              <span>On Leave</span>
              <span className="ml-1 bg-amber-500/10 text-amber-600 px-1.5 py-0.2 rounded font-mono text-[10px] font-bold">
                {dashboardStats.onLeaveEmployees.length}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="absent"
              className="h-8 px-3 sm:px-4 text-xs font-bold rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-border/60 transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-initial shrink-0"
            >
              <XCircle className="size-3.5 text-rose-600 shrink-0" />
              <span>Absent</span>
              <span className="ml-1 bg-rose-500/10 text-rose-600 px-1.5 py-0.2 rounded font-mono text-[10px] font-bold">
                {dashboardStats.absentEmployees.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Present Employees Tab */}
        <TabsContent value="present" className="m-0">
          <LocationLogsTable data={logs} />
        </TabsContent>

        {/* On Leave Employees Tab */}
        <TabsContent value="on-leave" className="m-0">
          <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs w-full">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead className="bg-muted/30 border-b border-border/70">
                  <tr>
                    <th className="px-5 py-3.5 text-xs font-bold text-muted-foreground">Employee</th>
                    <th className="px-4 py-3.5 text-xs font-bold text-muted-foreground">Department</th>
                    <th className="px-4 py-3.5 text-xs font-bold text-muted-foreground">Leave Type</th>
                    <th className="px-4 py-3.5 text-xs font-bold text-muted-foreground">Duration</th>
                    <th className="px-5 py-3.5 text-xs font-bold text-muted-foreground text-right">Date Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {dashboardStats.onLeaveEmployees.map((e) => (
                    <tr key={e.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8 rounded-full shrink-0">
                            {(e as any).avatarUrl && <AvatarImage src={(e as any).avatarUrl} alt={e.name} className="object-cover" />}
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center size-full">
                              {getInitials(e.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-foreground">{e.name}</span>
                            <span className="text-[11px] text-muted-foreground font-medium">{(e as any).designation || "No Designation"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-foreground/80">{(e as any).department}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          {(e as any).leaveType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-muted-foreground">{(e as any).duration}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-xs font-bold text-foreground tabular-nums">
                          {new Date((e as any).startDate).toDateString() === new Date((e as any).endDate).toDateString() ? (
                            new Date((e as any).startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                          ) : (
                            `${new Date((e as any).startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${new Date((e as any).endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dashboardStats.onLeaveEmployees.length === 0 && (
              <div className="py-16 text-center flex flex-col items-center gap-2 opacity-30">
                <Calendar className="size-8 text-muted-foreground" />
                <p className="text-xs font-semibold uppercase tracking-wider">No employees on leave today</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Absent Employees Tab */}
        <TabsContent value="absent" className="m-0">
          <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs w-full">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead className="bg-muted/30 border-b border-border/70">
                  <tr>
                    <th className="px-5 py-3.5 text-xs font-bold text-muted-foreground">Employee</th>
                    <th className="px-4 py-3.5 text-xs font-bold text-muted-foreground">Department</th>
                    <th className="px-5 py-3.5 text-xs font-bold text-muted-foreground text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {dashboardStats.absentEmployees.map((e) => (
                    <tr key={e.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8 rounded-full shrink-0">
                            {(e as any).avatarUrl && <AvatarImage src={(e as any).avatarUrl} alt={e.name} className="object-cover" />}
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center size-full">
                              {getInitials(e.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-foreground">{e.name}</span>
                            <span className="text-[11px] text-muted-foreground font-medium">{(e as any).designation || "No Designation"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-foreground/80">{(e as any).department}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                          <AlertCircle className="size-3" /> Absent
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dashboardStats.absentEmployees.length === 0 && (
              <div className="py-16 text-center flex flex-col items-center gap-2 opacity-30">
                <CheckCircle2 className="size-8 text-emerald-600" />
                <p className="text-xs font-semibold uppercase tracking-wider">Everyone is accounted for today!</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
