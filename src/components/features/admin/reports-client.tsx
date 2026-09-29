"use client";

import { useEffect, useState, useMemo } from "react";
import {
  TrendingUp,
  Activity,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Sliders,
} from "lucide-react";
import { getAdminReportsData, getAdminYearlyReportsData } from "@/actions/dashboard/reports";
import { MonthlyReportsTable } from "./reports/MonthlyReportsTable";
import { YearlyReportsTable } from "./reports/YearlyReportsTable";
import { TopPerformers } from "./reports/TopPerformers";
import { MethodologyPanel } from "./reports/MethodologyPanel";
import { toast } from "sonner";
import { format } from "date-fns";

import { OperationsKeyMetrics } from "./reports/OperationsKeyMetrics";
import { OperationsCharts } from "./reports/OperationsCharts";
import { OperationsDetailTable } from "./reports/OperationsDetailTable";
import { TLReviewGrid } from "./reports/TLReviewGrid";
import { TeamPerformanceGrid } from "./reports/TeamPerformanceGrid";
import { ProjectDeliveryStat } from "./reports/ProjectDeliveryHealthWidget";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface AdminReportsClientProps {
  summaries: {
    totalEmployees: number;
    totalProjects: number;
    activeProjects: number;
    averagePerformanceRating: number;
    attendanceRateToday: number;
    totalLatePunches30Days: number;
    outsideOfficePunches30Days: number;
  };
  dailyTrends: Array<{ dateStr: string; present: number; late: number; outsideOffice: number }>;
  departmentLatePatterns: Array<{ name: string; lateRate: number; total: number; late: number }>;
  leaveCategoryDistribution: Array<{ name: string; value: number }>;
  leaveRequestStatusCounts: { pending: number; approved: number; rejected: number };
  projectCompletionStats: ProjectDeliveryStat[];
  taskStatusCounts: { todo: number; inProgress: number; inReview: number; completed: number; total: number };
  employeePerformance?: Array<{
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    joiningDate?: Date | string | null;
    department: string;
    totalTasks: number;
    productivity: number;
    timeliness: number;
    quality: number;
    discipline: number;
    confidence: "high" | "medium" | "low";
    avgRating: number;
    overallScore: number;
    grade: string;
    isProbation?: boolean;
  }>;
  tlPerformance?: Array<{
    tlId: string;
    tlName: string;
    avatarUrl?: string | null;
    joiningDate?: Date | string | null;
    department: string;
    pendingReviews: number;
    overdueReviews: number;
    avgDelayDays: number;
    bayesianOTRR: number | null;
    overallScore: number | null;
    deptPunctuality: number;
    totalTasks?: number;
  }>;
  teamPerformance?: Array<{
    department: string;
    averageScore: number | null;
    productivity: number;
    timeliness: number;
    quality: number;
    discipline: number;
    memberCount: number;
  }>;
}

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const currentYearNum = new Date().getFullYear();
const currentMonthNum = new Date().getMonth() + 1;

export function AdminReportsClient({
  summaries: initialSummaries,
  dailyTrends: initialDailyTrends,
  departmentLatePatterns: initialDepartmentLatePatterns,
  leaveCategoryDistribution: initialLeaveCategoryDistribution,
  leaveRequestStatusCounts: initialLeaveRequestStatusCounts,
  projectCompletionStats: initialProjectCompletionStats,
  taskStatusCounts: initialTaskStatusCounts,
  employeePerformance: initialEmployeePerformance = [],
  tlPerformance: initialTlPerformance = [],
  teamPerformance: initialTeamPerformance = [],
}: AdminReportsClientProps) {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<"operations" | "performance">("operations");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [loadingData, setLoadingData] = useState(false);

  const [periodType, setPeriodType] = useState<"monthly" | "yearly">("monthly");
  const [incrementRules, setIncrementRules] = useState<Record<string, number>>({
    Excellent: 18,
    "Very Good": 12,
    Good: 7,
    Satisfactory: 3,
    "Needs Improvement": 0,
  });
  const [baselineSalaries, setBaselineSalaries] = useState<Record<string, string>>({});

  const [reportsData, setReportsData] = useState({
    summaries: initialSummaries,
    dailyTrends: initialDailyTrends,
    departmentLatePatterns: initialDepartmentLatePatterns,
    leaveCategoryDistribution: initialLeaveCategoryDistribution,
    leaveRequestStatusCounts: initialLeaveRequestStatusCounts,
    projectCompletionStats: initialProjectCompletionStats,
    taskStatusCounts: initialTaskStatusCounts,
    employeePerformance: initialEmployeePerformance,
    tlPerformance: initialTlPerformance,
    teamPerformance: initialTeamPerformance,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setReportsData({
      summaries: initialSummaries,
      dailyTrends: initialDailyTrends,
      departmentLatePatterns: initialDepartmentLatePatterns,
      leaveCategoryDistribution: initialLeaveCategoryDistribution,
      leaveRequestStatusCounts: initialLeaveRequestStatusCounts,
      projectCompletionStats: initialProjectCompletionStats,
      taskStatusCounts: initialTaskStatusCounts,
      employeePerformance: initialEmployeePerformance,
      tlPerformance: initialTlPerformance,
      teamPerformance: initialTeamPerformance,
    });
  }, [
    initialSummaries,
    initialDailyTrends,
    initialDepartmentLatePatterns,
    initialLeaveCategoryDistribution,
    initialLeaveRequestStatusCounts,
    initialProjectCompletionStats,
    initialTaskStatusCounts,
    initialEmployeePerformance,
    initialTlPerformance,
    initialTeamPerformance,
  ]);

  const fetchData = async (pType: "monthly" | "yearly", month: number, year: number) => {
    setLoadingData(true);
    try {
      if (pType === "yearly") {
        const res = await getAdminYearlyReportsData(year);
        if (res.success && res.data) {
          setReportsData((prev) => ({
            ...prev,
            employeePerformance: res.data.employeePerformance,
            tlPerformance: res.data.tlPerformance,
            teamPerformance: res.data.teamPerformance,
          }));
        } else {
          toast.error("Failed to load yearly reports data");
        }
      } else {
        const res = await getAdminReportsData(month, year);
        if (res.success && res.data) {
          setReportsData((prev) => ({ ...prev, ...res.data }));
        } else {
          toast.error("Failed to load monthly reports data");
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error("An error occurred while fetching reports data");
    } finally {
      setLoadingData(false);
    }
  };

  const handlePrevPeriod = () => {
    if (periodType === "yearly") {
      const targetYear = selectedYear - 1;
      if (targetYear < 2026) return;
      setSelectedYear(targetYear);
      fetchData("yearly", selectedMonth, targetYear);
    } else {
      let targetMonth = selectedMonth - 1;
      let targetYear = selectedYear;
      if (targetMonth < 1) {
        targetMonth = 12;
        targetYear -= 1;
      }
      if (targetYear < 2026 || (targetYear === 2026 && targetMonth < 5)) return;
      setSelectedMonth(targetMonth);
      setSelectedYear(targetYear);
      fetchData("monthly", targetMonth, targetYear);
    }
  };

  const handleNextPeriod = () => {
    if (periodType === "yearly") {
      const targetYear = selectedYear + 1;
      if (targetYear > currentYearNum) return;
      setSelectedYear(targetYear);
      fetchData("yearly", selectedMonth, targetYear);
    } else {
      let targetMonth = selectedMonth + 1;
      let targetYear = selectedYear;
      if (targetMonth > 12) {
        targetMonth = 1;
        targetYear += 1;
      }
      if (targetYear > currentYearNum || (targetYear === currentYearNum && targetMonth > currentMonthNum)) return;
      setSelectedMonth(targetMonth);
      setSelectedYear(targetYear);
      fetchData("monthly", targetMonth, targetYear);
    }
  };

  const handlePeriodTypeChange = (type: "monthly" | "yearly") => {
    setPeriodType(type);
    fetchData(type, selectedMonth, selectedYear);
  };

  const {
    summaries,
    dailyTrends,
    departmentLatePatterns,
    leaveCategoryDistribution,
    leaveRequestStatusCounts,
    projectCompletionStats,
    taskStatusCounts,
    employeePerformance = [],
    tlPerformance = [],
  } = reportsData;

  const employeeOfTheMonth = useMemo(() => {
    if (!employeePerformance || employeePerformance.length === 0) return null;
    const candidates = employeePerformance.filter((emp) => emp.overallScore !== null && emp.overallScore > 0 && !emp.isProbation);
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => {
      const scoreA = a.overallScore ?? -1;
      const scoreB = b.overallScore ?? -1;
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      if (b.quality !== a.quality) return (b.quality ?? -1) - (a.quality ?? -1);
      if (b.timeliness !== a.timeliness) return (b.timeliness ?? -1) - (a.timeliness ?? -1);
      if (b.productivity !== a.productivity) return (b.productivity ?? -1) - (a.productivity ?? -1);
      if (b.discipline !== a.discipline) return (b.discipline ?? -1) - (a.discipline ?? -1);

      const dateA = a.joiningDate ? new Date(a.joiningDate).getTime() : Infinity;
      const dateB = b.joiningDate ? new Date(b.joiningDate).getTime() : Infinity;
      return dateA - dateB;
    })[0];
  }, [employeePerformance]);

  const tlOfTheMonth = useMemo(() => {
    if (!tlPerformance || tlPerformance.length === 0) return null;
    const candidates = tlPerformance.filter((tl) => tl.overallScore !== null && tl.overallScore > 0);
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => {
      const scoreA = a.overallScore ?? -1;
      const scoreB = b.overallScore ?? -1;
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      if (b.deptPunctuality !== a.deptPunctuality) {
        return b.deptPunctuality - a.deptPunctuality;
      }
      return a.avgDelayDays - b.avgDelayDays;
    })[0];
  }, [tlPerformance]);

  const teamOfTheMonth = useMemo(() => {
    const teamPerformance = reportsData.teamPerformance;
    if (!teamPerformance || teamPerformance.length === 0) return null;
    const candidates = teamPerformance.filter((team) => team.averageScore !== null && team.averageScore > 0);
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => {
      const scoreA = a.averageScore ?? -1;
      const scoreB = b.averageScore ?? -1;
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      if (b.quality !== a.quality) return (b.quality ?? -1) - (a.quality ?? -1);
      return (b.productivity ?? -1) - (a.productivity ?? -1);
    })[0];
  }, [reportsData.teamPerformance]);

  const filteredEmployees = employeePerformance.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const yearlyExportColumns = useMemo(
    () => [
      { header: "Rank", key: "rank" },
      { header: "Employee Name", key: "name" },
      { header: "Department", key: "department" },
      { header: "Joining Date", key: "joiningDate" },
      { header: "Overall Performance Score", key: "overallScore" },
      { header: "Performance Grade", key: "grade" },
      { header: "Recommended Increment %", key: "incPercent" },
      { header: "Baseline Salary", key: "baseSalary" },
      { header: "Increment Amount", key: "incAmount" },
      { header: "Proposed Salary", key: "proposedSalary" },
    ],
    []
  );

  const exportedYearlyData = useMemo(() => {
    return filteredEmployees.map((emp, index) => {
      const baseSalary = parseFloat(baselineSalaries[emp.id]) || 0;
      const incPercent = incrementRules[emp.grade] ?? 0;
      const incAmount = (baseSalary * incPercent) / 100;
      const proposedSalary = baseSalary + incAmount;
      return {
        rank: index + 1,
        name: emp.name,
        department: emp.department,
        joiningDate: emp.joiningDate ? format(new Date(emp.joiningDate), "dd/MM/yyyy") : "—",
        overallScore: emp.overallScore,
        grade: emp.grade,
        incPercent: `${incPercent}%`,
        baseSalary: baseSalary > 0 ? `Rs. ${baseSalary.toFixed(2)}` : "Rs. 0.00",
        incAmount: incAmount > 0 ? `Rs. ${incAmount.toFixed(2)}` : "Rs. 0.00",
        proposedSalary: proposedSalary > 0 ? `Rs. ${proposedSalary.toFixed(2)}` : "Rs. 0.00",
      };
    });
  }, [filteredEmployees, baselineSalaries, incrementRules]);

  const taskPieData = [
    { name: "To Do", value: taskStatusCounts.todo },
    { name: "In Progress", value: taskStatusCounts.inProgress },
    { name: "In Review", value: taskStatusCounts.inReview },
    { name: "Completed", value: taskStatusCounts.completed },
  ].filter((t) => t.value > 0);

  return (
    <div className="space-y-4">
      {/* ── Sub-navigation & Month/Year Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div className="flex w-full sm:w-auto bg-muted/40 p-1 rounded-md border border-border/70 items-center gap-1">
          <button
            onClick={() => {
              setView("operations");
              if (periodType !== "monthly") {
                handlePeriodTypeChange("monthly");
              }
            }}
            className={cn(
              "flex-1 sm:flex-none justify-center px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
              view === "operations"
                ? "bg-background text-primary shadow-xs border border-border/60 font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Activity className="size-3.5" />
            <span>Attendance Overview</span>
          </button>
          <button
            onClick={() => setView("performance")}
            className={cn(
              "flex-1 sm:flex-none justify-center px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
              view === "performance"
                ? "bg-background text-primary shadow-xs border border-border/60 font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <TrendingUp className="size-3.5" />
            <span>Performance</span>
          </button>
        </div>

        {/* Month/Year Selection with Spinner */}
        <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
          {loadingData && <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />}
          <div className="flex items-center gap-1 bg-card border border-border/80 rounded-md p-1 h-9 shadow-2xs select-none">
            <button
              onClick={handlePrevPeriod}
              disabled={
                periodType === "yearly"
                  ? selectedYear === 2026 || (reportsData.employeePerformance && reportsData.employeePerformance.length === 0)
                  : (selectedYear === 2026 && selectedMonth <= 5) || (reportsData.employeePerformance && reportsData.employeePerformance.length === 0)
              }
              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title={periodType === "yearly" ? "Previous Year" : "Previous Month"}
              type="button"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-xs font-bold text-foreground min-w-[130px] text-center">
              {periodType === "yearly"
                ? `Year ${selectedYear}`
                : `${MONTHS.find((m) => m.value === selectedMonth)?.label} ${selectedYear}`}
            </span>
            <button
              onClick={handleNextPeriod}
              disabled={
                periodType === "yearly"
                  ? selectedYear === currentYearNum
                  : selectedYear === currentYearNum && selectedMonth === currentMonthNum
              }
              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title={periodType === "yearly" ? "Next Year" : "Next Month"}
              type="button"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className={cn("transition-all duration-300 relative min-h-[500px]", loadingData ? "opacity-50 pointer-events-none blur-[1px]" : "opacity-100")}>
        {view === "operations" ? (
          <div className="space-y-4 animate-fade-in">
            {/* ── Key Metrics summaries ── */}
            <OperationsKeyMetrics summaries={summaries} />

            {/* ── Operations Rows 1, 2, 3: Trends, Projects, Leaves, Lateness, Audits & Tasks ── */}
            <OperationsCharts
              mounted={mounted}
              summaries={summaries}
              dailyTrends={dailyTrends}
              departmentLatePatterns={departmentLatePatterns}
              leaveCategoryDistribution={leaveCategoryDistribution}
              leaveRequestStatusCounts={leaveRequestStatusCounts}
              taskPieData={taskPieData}
              taskStatusCounts={taskStatusCounts}
              projectCompletionStats={projectCompletionStats}
            />
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {/* Period Type Selection Tab: Monthly vs Yearly */}
            <div className="flex bg-muted/40 p-1 rounded-md border border-border/70 w-full sm:w-fit items-center gap-1">
              <button
                onClick={() => handlePeriodTypeChange("monthly")}
                className={cn(
                  "flex-1 sm:flex-none justify-center px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer",
                  periodType === "monthly"
                    ? "bg-background text-primary shadow-xs border border-border/60 font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>Monthly Evaluation</span>
              </button>
              <button
                onClick={() => handlePeriodTypeChange("yearly")}
                className={cn(
                  "flex-1 sm:flex-none justify-center px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer",
                  periodType === "yearly"
                    ? "bg-background text-primary shadow-xs border border-border/60 font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>Yearly & Increment Planner</span>
              </button>
            </div>

            {/* Stars of the Month / Year Section */}
            <TopPerformers
              periodType={periodType}
              employeeOfTheMonth={employeeOfTheMonth}
              tlOfTheMonth={tlOfTheMonth}
              teamOfTheMonth={teamOfTheMonth}
            />

            {/* Search Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border/80 rounded-md p-3.5 shadow-2xs">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by employee name or department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8.5 text-xs bg-background/80 border-border/70 focus:bg-background rounded-md w-full"
                />
              </div>
              <div className="text-xs text-muted-foreground font-medium">
                Showing <span className="font-bold text-foreground">{filteredEmployees.length}</span> of{" "}
                <span className="font-bold text-foreground">{employeePerformance.length}</span> employees
              </div>
            </div>

            {/* Formula Reference Panel */}
            <MethodologyPanel periodType={periodType} />

            {/* Increment Guidelines Adjuster */}
            {periodType === "yearly" && (
              <div className="bg-card border border-border/80 rounded-md p-5 space-y-4 shadow-2xs">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Sliders className="size-3.5 text-primary" /> Salary Increment Guidelines Adjuster
                  </h4>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                    Dynamically adjust the recommended salary increment percentage for each performance grade.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 pt-1">
                  {(["Excellent", "Very Good", "Good", "Satisfactory", "Needs Improvement"] as const).map((grade) => {
                    const value = incrementRules[grade] ?? 0;
                    let colorClass = "accent-emerald-500";
                    let textClass = "text-emerald-600 dark:text-emerald-400";
                    if (grade === "Excellent") {
                      colorClass = "accent-emerald-500";
                      textClass = "text-emerald-600 dark:text-emerald-400";
                    } else if (grade === "Very Good") {
                      colorClass = "accent-teal-500";
                      textClass = "text-teal-600 dark:text-teal-400";
                    } else if (grade === "Good") {
                      colorClass = "accent-indigo-500";
                      textClass = "text-indigo-600 dark:text-indigo-400";
                    } else if (grade === "Satisfactory") {
                      colorClass = "accent-amber-500";
                      textClass = "text-amber-600 dark:text-amber-400";
                    } else {
                      colorClass = "accent-rose-500";
                      textClass = "text-rose-600 dark:text-rose-400";
                    }

                    return (
                      <div key={grade} className="bg-muted/20 border border-border/60 rounded-md p-3 space-y-2 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">{grade}</span>
                          <span className={cn("text-xs font-bold tabular-nums", textClass)}>{value}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={value}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setIncrementRules((prev) => ({ ...prev, [grade]: val }));
                          }}
                          className={cn("w-full cursor-pointer h-1.5 rounded-full bg-muted appearance-none", colorClass)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Employee Performance Rankings / Salary Increment Planner Table */}
            {periodType === "yearly" ? (
              <YearlyReportsTable
                employeePerformance={employeePerformance}
                filteredEmployees={filteredEmployees}
                selectedYear={selectedYear}
                baselineSalaries={baselineSalaries}
                setBaselineSalaries={setBaselineSalaries}
                incrementRules={incrementRules}
                yearlyExportColumns={yearlyExportColumns}
                exportedYearlyData={exportedYearlyData}
              />
            ) : (
              <MonthlyReportsTable
                employeePerformance={employeePerformance}
                filteredEmployees={filteredEmployees}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                MONTHS={MONTHS}
              />
            )}

            {/* TL Review Queue & Efficiency Grid */}
            <TLReviewGrid
              tlPerformance={reportsData?.tlPerformance || []}
              periodType={periodType}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              MONTHS={MONTHS}
            />

            {/* Team Performance Grid */}
            <TeamPerformanceGrid
              teamPerformance={reportsData?.teamPerformance}
              periodType={periodType}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              MONTHS={MONTHS}
            />
          </div>
        )}
      </div>
    </div>
  );
}
