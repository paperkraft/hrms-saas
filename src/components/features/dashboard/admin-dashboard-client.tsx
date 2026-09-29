"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Users,
  CheckCircle2,
  Calendar,
  UserMinus,
  RefreshCw,
  LayoutDashboard,
  TrendingUp,
  Loader2,
  FileText,
  Sun,
  CloudSun,
  Moon,
  Sparkles,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UpcomingMilestones } from "./upcoming-milestones";
import { LocationStatus } from "./location-status";
import { CommunicationHub } from "./communication-hub";
import { TodayStatus } from "./today-status";
import { TodoList } from "./todo-list";
import { AdminReportsClient } from "@/components/features/admin/reports-client";
import { getAdminDashboardStats } from "@/actions/dashboard/admin";
import { getAdminReportsData } from "@/actions/dashboard/reports";
import { toast } from "sonner";

interface AdminDashboardClientProps {
  initialStats: any;
  initialReports: any;
  userName?: string;
}

export function AdminDashboardClient({ initialStats, initialReports, userName = "Admin" }: AdminDashboardClientProps) {
  const [stats, setStats] = useState(initialStats);
  const [reports, setReports] = useState(initialReports);
  const [isReportsLoading, setIsReportsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") === "reports" ? "reports" : "overview";

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    if (activeTab === "reports" && !reports && !isReportsLoading) {
      setIsReportsLoading(true);
      getAdminReportsData()
        .then((res) => {
          if (res.success && res.data) {
            setReports(res.data);
          } else {
            toast.error("Failed to load reports data");
          }
        })
        .catch((err) => {
          console.error("[Reports Fetch Error]", err);
          toast.error("Error fetching analytics data");
        })
        .finally(() => {
          setIsReportsLoading(false);
        });
    }
  }, [activeTab, reports, isReportsLoading]);

  const setActiveTab = (tab: "overview" | "reports") => {
    const params = new URLSearchParams(window.location.search);
    if (tab === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", "reports");
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const handleRefresh = async (silent = false) => {
    if (isPending) return;
    setIsPending(true);
    try {
      const result = await getAdminDashboardStats();
      if (result.success && result.data) {
        setStats(result.data);
        if (!silent) {
          toast.success("Workforce presence synchronized", {
            description: "Live check-ins, active locations, and leave rosters updated.",
            duration: 2000,
          });
        }
      } else {
        if (!silent) {
          toast.error("Failed to sync workforce presence");
        }
      }
    } catch (err) {
      console.error("[Presence Sync Error]", err);
      if (!silent) {
        toast.error("Network error while syncing presence");
      }
    } finally {
      setIsPending(false);
    }
  };

  const totalStaff = stats.presentEmployees.length + stats.absentEmployees.length + stats.onLeaveEmployees.length;

  return (
    <div className="space-y-4">
      {/* ── Executive Header Banner ── */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <div className="size-8 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <LayoutDashboard className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5 sm:mb-1 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-snug flex items-center gap-1.5 sm:gap-2">
                <span>{greeting}, {userName}</span>
                {greeting === "Good morning" ? (
                  <CloudSun className="size-4 text-amber-500 shrink-0" />
                ) : greeting === "Good afternoon" ? (
                  <Sun className="size-4 text-amber-500 shrink-0" />
                ) : (
                  <Moon className="size-4 text-indigo-400 shrink-0" />
                )}
              </h1>
              <Badge variant="outline" className="text-[9px] sm:text-[10px] uppercase font-bold text-primary bg-primary/10 border-primary/20 px-1.5 sm:px-2 py-0.5 rounded-sm shrink-0">
                Operational Hub
              </Badge>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1 sm:line-clamp-none">
              Real-time workforce attendance, departmental presence, and operational overview
            </p>
          </div>
        </div>

        {/* Tab Switcher & Quick Refresh */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="grid grid-cols-2 flex-1 md:flex-initial bg-muted/40 p-1 rounded-md border border-border/70 gap-1">
            <button
              onClick={() => setActiveTab("overview")}
              className={cn(
                "flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer",
                activeTab === "overview"
                  ? "bg-background text-primary shadow-xs border border-border/60 font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutDashboard className="size-3.5 shrink-0" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={cn(
                "flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer",
                activeTab === "reports"
                  ? "bg-background text-primary shadow-xs border border-border/60 font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TrendingUp className="size-3.5 shrink-0" />
              <span className="hidden xs:inline sm:inline">Reports & Analytics</span>
              <span className="xs:hidden sm:hidden">Reports</span>
            </button>
          </div>

          {activeTab === "overview" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRefresh(false)}
              disabled={isPending}
              className="h-9 px-2.5 sm:px-3.5 text-xs font-semibold rounded-md border-border/80 bg-background hover:bg-muted cursor-pointer gap-1.5 sm:gap-2 shrink-0"
              title="Sync Presence"
            >
              <RefreshCw className={cn("size-3.5 text-muted-foreground", isPending && "animate-spin text-primary")} />
              <span className="hidden sm:inline">{isPending ? "Syncing..." : "Sync Presence"}</span>
            </Button>
          )}
        </div>
      </div>

      {activeTab === "overview" ? (
        <div className="space-y-4 animate-fade-in">
          {/* ── Real-time 4-Column KPI Stat Grid ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
            {/* Total Employees */}
            <div className="rounded-md border border-border/80 bg-card/90 p-3 sm:p-4 shadow-2xs hover:border-border transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-[11px] sm:text-xs font-medium truncate">Total Employees</span>
                  <div className="size-7 sm:size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Users className="size-3.5 sm:size-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5 sm:gap-2">
                  <span className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{stats.totalEmployees}</span>
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground">active staff</span>
                </div>
              </div>
              <div>
                <div className="mt-2 sm:mt-2.5 h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: "100%" }} />
                </div>
                <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                  <span className="inline-block size-1.5 sm:size-2 rounded-full bg-primary shrink-0" />
                  <span className="truncate">Entire active workforce</span>
                </div>
              </div>
            </div>

            {/* Present Today */}
            <div className="rounded-md border border-border/80 bg-card/90 p-3 sm:p-4 shadow-2xs hover:border-border transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-[11px] sm:text-xs font-medium truncate">Present Today</span>
                  <div className="size-7 sm:size-8 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="size-3.5 sm:size-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5 sm:gap-2">
                  <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
                    {stats.presentEmployees.length}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {stats.attendanceRate}% rate
                  </span>
                </div>
              </div>
              <div>
                <div className="mt-2 sm:mt-2.5 h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(stats.attendanceRate, 100)}%` }}
                  />
                </div>
                <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                  <span className="inline-block size-1.5 sm:size-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">Active check-ins & remote</span>
                </div>
              </div>
            </div>

            {/* Absent Today */}
            <div className="rounded-md border border-border/80 bg-card/90 p-3 sm:p-4 shadow-2xs hover:border-border transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-[11px] sm:text-xs font-medium truncate">Absent Today</span>
                  <div className="size-7 sm:size-8 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <UserMinus className="size-3.5 sm:size-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5 sm:gap-2">
                  <span className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 tracking-tight">
                    {stats.absentEmployees.length}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground">unaccounted</span>
                </div>
              </div>
              <div>
                <div className="mt-2 sm:mt-2.5 h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${totalStaff > 0 ? Math.min(Math.round((stats.absentEmployees.length / totalStaff) * 100), 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                  <span className="inline-block size-1.5 sm:size-2 rounded-full bg-rose-500 shrink-0" />
                  <span className="truncate">No punch or leave</span>
                </div>
              </div>
            </div>

            {/* On Leave Today */}
            <div className="rounded-md border border-border/80 bg-card/90 p-3 sm:p-4 shadow-2xs hover:border-border transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-[11px] sm:text-xs font-medium truncate">On Leave Today</span>
                  <div className="size-7 sm:size-8 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                    <Calendar className="size-3.5 sm:size-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5 sm:gap-2">
                  <span className="text-xl sm:text-2xl font-bold text-sky-600 dark:text-sky-400 tracking-tight">
                    {stats.onLeaveEmployees.length}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground">approved leaves</span>
                </div>
              </div>
              <div>
                <div className="mt-2 sm:mt-2.5 h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${totalStaff > 0 ? Math.min(Math.round((stats.onLeaveEmployees.length / totalStaff) * 100), 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                  <span className="inline-block size-1.5 sm:size-2 rounded-full bg-sky-500 shrink-0" />
                  <span className="truncate">Planned & sick leaves</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── ROW 1: Today's Live Attendance Feed ── */}
          <div className="grid grid-cols-1">
            <TodayStatus
              presentEmployees={stats.presentEmployees}
              absentEmployees={stats.absentEmployees}
              onLeaveEmployees={stats.onLeaveEmployees}
            />
          </div>

          {/* ── ROW 2: Communication Hub & Saturation Trends ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Communication Hub (4/12) */}
            <div className="lg:col-span-4">
              <CommunicationHub
                announcements={stats.announcements}
                notifications={stats.notifications}
                policies={stats.policies}
                role={stats.userRole}
              />
            </div>

            {/* Saturation Trends (8/12) */}
            <div className="lg:col-span-8">
              <div className="bg-card border border-border/80 rounded-md overflow-hidden h-[430px] flex flex-col shadow-2xs">
                <div className="px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-border/70 flex items-center justify-between bg-muted/20">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <FileText className="size-3.5 text-primary shrink-0" /> Monthly Leave Saturation
                      </h2>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                        {stats.monthlyLeaveSummary.length} Staff
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5">
                      Workforce absence index, taken leaves, and department utilization.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-border/40 flex-1 overflow-y-auto">
                  {stats.monthlyLeaveSummary.length === 0 ? (
                    <div className="py-16 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <FileText className="size-8 opacity-40" />
                      <p className="text-xs font-semibold">No leave saturation data recorded</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/40">
                      <div className="divide-y divide-border/40">
                        {stats.monthlyLeaveSummary.slice(0, 5).map((item: any, idx: number) => (
                          <div
                            key={`summary-left-${item.id}-${idx}`}
                            className="px-3.5 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors group"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Avatar className="size-8 rounded-full shrink-0">
                                {item.avatarUrl && (
                                  <AvatarImage src={item.avatarUrl} alt={item.name || ""} className="object-cover rounded-full" />
                                )}
                                <AvatarFallback className="bg-muted text-foreground/70 font-bold text-[10px] rounded-full">
                                  {getInitials(item.name || "")}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
                                <div className="mt-1.5 h-1.5 bg-muted/60 rounded-full overflow-hidden w-full">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all duration-500",
                                      item.totalDays > 3
                                        ? "bg-rose-500"
                                        : item.totalDays > 0
                                          ? "bg-emerald-500"
                                          : "bg-muted"
                                    )}
                                    style={{ width: `${Math.min((item.totalDays / 5) * 100, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0 text-right min-w-[45px]">
                              <span className="text-xs font-bold text-foreground/80 tabular-nums">
                                {item.totalDays}d
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="divide-y divide-border/40">
                        {stats.monthlyLeaveSummary.slice(5, 10).map((item: any, idx: number) => (
                          <div
                            key={`summary-right-${item.id}-${idx}`}
                            className="px-3.5 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors group"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Avatar className="size-8 rounded-full shrink-0">
                                {item.avatarUrl && (
                                  <AvatarImage src={item.avatarUrl} alt={item.name || ""} className="object-cover rounded-full" />
                                )}
                                <AvatarFallback className="bg-muted text-foreground/70 font-bold text-[10px] rounded-full">
                                  {getInitials(item.name || "")}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
                                <div className="mt-1.5 h-1.5 bg-muted/60 rounded-full overflow-hidden w-full">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all duration-500",
                                      item.totalDays > 3
                                        ? "bg-rose-500"
                                        : item.totalDays > 0
                                          ? "bg-emerald-500"
                                          : "bg-muted"
                                    )}
                                    style={{ width: `${Math.min((item.totalDays / 5) * 100, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0 text-right min-w-[45px]">
                              <span className="text-xs font-bold text-foreground/80 tabular-nums">
                                {item.totalDays}d
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── ROW 3: Operational Visibility Cluster (Milestones, Locations, Tasks) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Upcoming Milestones */}
            <div className="flex flex-col">
              <UpcomingMilestones
                holidays={stats.holidays || []}
                upcomingBirthdays={stats.upcomingBirthdays}
                upcomingAnniversaries={stats.upcomingAnniversaries}
              />
            </div>

            {/* Office Location Status */}
            <div className="flex flex-col">
              <LocationStatus locations={stats.locationStats || []} />
            </div>

            {/* Personal To-Do Workspace */}
            <div className="flex flex-col">
              <TodoList initialTodos={stats.todos || []} />
            </div>
          </div>
        </div>
      ) : isReportsLoading || !reports ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] border border-border/80 rounded-md bg-card p-12 text-center shadow-2xs animate-fade-in">
          <Loader2 className="size-8 text-primary animate-spin mb-4" />
          <p className="text-sm font-bold text-foreground">Loading Analytics & Performance Reports...</p>
          <p className="text-xs text-muted-foreground mt-1">Aggregating real-time workforce trends and operational KPIs.</p>
        </div>
      ) : (
        <div className="animate-fade-in">
          <AdminReportsClient
            summaries={reports.summaries}
            dailyTrends={reports.dailyTrends}
            departmentLatePatterns={reports.departmentLatePatterns}
            leaveCategoryDistribution={reports.leaveCategoryDistribution}
            leaveRequestStatusCounts={reports.leaveRequestStatusCounts}
            projectCompletionStats={reports.projectCompletionStats}
            taskStatusCounts={reports.taskStatusCounts}
            employeePerformance={reports.employeePerformance}
            tlPerformance={reports.tlPerformance}
            teamPerformance={reports.teamPerformance}
          />
        </div>
      )}
    </div>
  );
}
