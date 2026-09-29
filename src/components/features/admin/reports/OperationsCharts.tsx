"use client";

import { useState, useMemo } from "react";
import { TrendingUp, Clock, FileText, ListChecks } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ProjectDeliveryHealthWidget, ProjectDeliveryStat } from "./ProjectDeliveryHealthWidget";
import { OperationsDetailTable } from "./OperationsDetailTable";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b"];
const STATUS_COLORS = ["#3b82f6", "#f59e0b", "#f97316", "#10b981"]; // Blue, Amber, Orange, Emerald

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border/80 p-2.5 rounded-md shadow-md text-xs font-medium text-popover-foreground">
        {label && <p className="font-bold border-b border-border/40 pb-1 mb-1">{label}</p>}
        <div className="space-y-1">
          {payload.map((pld: any, index: number) => {
            const valueStr =
              pld.name === "Late Rate" || pld.name === "Late Arrivals Rate" || pld.name === "lateRate"
                ? `${pld.value}%`
                : pld.value;
            const displayName = pld.name === "lateRate" ? "Late Arrivals Rate" : pld.name;
            return (
              <div key={index} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: pld.color || pld.fill }} />
                <span className="text-muted-foreground">{displayName}:</span>
                <span className="font-bold text-foreground">{valueStr}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

interface OperationsChartsProps {
  mounted: boolean;
  summaries: {
    totalLatePunches30Days: number;
    outsideOfficePunches30Days: number;
    [key: string]: any;
  };
  dailyTrends: Array<{ dateStr: string; present: number; late: number; outsideOffice: number }>;
  departmentLatePatterns: Array<{ name: string; lateRate: number; total: number; late: number }>;
  leaveCategoryDistribution: Array<{ name: string; value: number }>;
  leaveRequestStatusCounts: { pending: number; approved: number; rejected: number };
  taskPieData: Array<{ name: string; value: number }>;
  taskStatusCounts: { todo: number; inProgress: number; inReview: number; completed: number; total: number };
  projectCompletionStats: ProjectDeliveryStat[];
}

export function OperationsCharts({
  mounted,
  summaries,
  dailyTrends,
  departmentLatePatterns,
  leaveCategoryDistribution,
  leaveRequestStatusCounts,
  taskPieData,
  taskStatusCounts,
  projectCompletionStats,
}: OperationsChartsProps) {
  const [attendanceDaysRange, setAttendanceDaysRange] = useState<7 | 15 | 30>(7);

  const displayedAttendanceTrends = useMemo(() => {
    return dailyTrends.slice(-attendanceDaysRange);
  }, [dailyTrends, attendanceDaysRange]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
      {/* ── 1. Attendance & Lateness Trends (Row 1, Cols 1 & 2) ── */}
      <div className="lg:col-span-2 bg-card border border-border/80 rounded-md p-5 space-y-4 shadow-2xs flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-primary" /> Attendance & Lateness Trends
            </h2>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Daily presents and late arrivals calculated over the last {attendanceDaysRange} days.
            </p>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
            <Clock className="size-3 text-muted-foreground hidden sm:inline" />
            <select
              value={attendanceDaysRange}
              onChange={(e) => setAttendanceDaysRange(Number(e.target.value) as 7 | 15 | 30)}
              aria-label="Filter attendance days range"
              className="h-7 px-2 text-xs rounded-md border border-input bg-background font-semibold focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
            >
              <option value={7}>Last 7 Days</option>
              <option value={15}>Last 15 Days</option>
              <option value={30}>Last 30 Days</option>
            </select>
          </div>
        </div>

        <div className="h-[260px] w-full pt-2">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={1}>
              <AreaChart data={displayedAttendanceTrends} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="lateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.5)" />
                <XAxis
                  dataKey="dateStr"
                  tick={{ fontSize: 10, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }} />
                <Area
                  type="monotone"
                  name="Presents"
                  dataKey="present"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#presentGrad)"
                />
                <Area
                  type="monotone"
                  name="Late Punch"
                  dataKey="late"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#lateGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </div>

      {/* ── 2. Project Delivery Health (Rows 1 & 2, Col 3 - spans 2 rows vertically) ── */}
      <div className="lg:col-span-1 lg:row-span-2 flex flex-col">
        <ProjectDeliveryHealthWidget projects={projectCompletionStats} className="h-full" />
      </div>

      {/* ── 3. Leave Distribution (Row 2, Col 1) ── */}
      <div className="lg:col-span-1 bg-card border border-border/80 rounded-md p-5 space-y-4 shadow-2xs flex flex-col justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <FileText className="size-3.5 text-primary" /> Leave Distribution
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Distribution of approved leave days this month by policy.
          </p>
        </div>

        <div className="h-[210px] w-full flex items-center justify-center">
          {mounted && leaveCategoryDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={1}>
              <PieChart>
                <Pie
                  data={leaveCategoryDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {leaveCategoryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-center opacity-40">
              <span className="text-xs font-semibold">No leaves taken this month</span>
            </div>
          )}
        </div>

        {/* Leave approvals overview */}
        <div className="border-t border-border/50 pt-3.5 grid grid-cols-3 gap-2 text-center">
          <div className="bg-amber-500/10 p-2 rounded-md border border-amber-500/20">
            <p className="text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 leading-none">Pending</p>
            <p className="text-sm font-bold text-amber-600 mt-1">{leaveRequestStatusCounts.pending}</p>
          </div>
          <div className="bg-emerald-500/10 p-2 rounded-md border border-emerald-500/20">
            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 leading-none">Approved</p>
            <p className="text-sm font-bold text-emerald-600 mt-1">{leaveRequestStatusCounts.approved}</p>
          </div>
          <div className="bg-rose-500/10 p-2 rounded-md border border-rose-500/20">
            <p className="text-[9px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 leading-none">Rejected</p>
            <p className="text-sm font-bold text-rose-600 mt-1">{leaveRequestStatusCounts.rejected}</p>
          </div>
        </div>
      </div>

      {/* ── 4. Late Punch Rate by Dept (Row 2, Col 2) ── */}
      <div className="lg:col-span-1 bg-card border border-border/80 rounded-md p-5 space-y-4 shadow-2xs flex flex-col justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Clock className="size-3.5 text-amber-500" /> Late Punch Rate by Dept
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Arriving delay ratio percentage by department.
          </p>
        </div>

        <div className="h-[280px] w-full overflow-y-auto custom-scrollbar overflow-x-hidden">
          {mounted && departmentLatePatterns.length > 0 ? (
            <div style={{ height: Math.max(260, departmentLatePatterns.length * 35), width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                <BarChart data={departmentLatePatterns} layout="vertical" margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border)/0.5)" />
                  <XAxis type="number" unit="%" tick={{ fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} width={85} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="lateRate" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center opacity-40">
              <span className="text-xs font-semibold">No delay logs found</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Organizational Audits (Row 3, Cols 1 & 2 - spans 2 cols) ── */}
      <div className="lg:col-span-2 flex flex-col h-full">
        <OperationsDetailTable summaries={summaries} dailyTrends={dailyTrends} className="h-full" />
      </div>

      {/* ── 6. Task Metrics (Row 3, Col 3 - spans 1 col) ── */}
      <div className="lg:col-span-1 bg-card border border-border/80 rounded-md p-5 space-y-4 shadow-2xs flex flex-col justify-between h-full">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <ListChecks className="size-3.5 text-primary" /> Task Metrics
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Workflow stages of all organizational tasks.
          </p>
        </div>

        <div className="h-[190px] w-full flex items-center justify-center">
          {mounted && taskPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={1}>
              <PieChart>
                <Pie
                  data={taskPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {taskPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-center opacity-40">
              <span className="text-xs font-semibold">No tasks logged</span>
            </div>
          )}
        </div>

        {/* Quick numbers */}
        <div className="border-t border-border/50 pt-3.5 grid grid-cols-4 gap-1.5 text-center">
          <div className="p-1.5 rounded-md bg-muted/40">
            <p className="text-[9px] font-bold uppercase tracking-tight text-muted-foreground leading-none">To Do</p>
            <p className="text-xs font-bold text-blue-600 mt-1">{taskStatusCounts.todo}</p>
          </div>
          <div className="p-1.5 rounded-md bg-muted/40">
            <p className="text-[9px] font-bold uppercase tracking-tight text-muted-foreground leading-none">Active</p>
            <p className="text-xs font-bold text-amber-600 mt-1">{taskStatusCounts.inProgress}</p>
          </div>
          <div className="p-1.5 rounded-md bg-muted/40">
            <p className="text-[9px] font-bold uppercase tracking-tight text-muted-foreground leading-none">Review</p>
            <p className="text-xs font-bold text-orange-600 mt-1">{taskStatusCounts.inReview}</p>
          </div>
          <div className="p-1.5 rounded-md bg-muted/40">
            <p className="text-[9px] font-bold uppercase tracking-tight text-muted-foreground leading-none">Done</p>
            <p className="text-xs font-bold text-emerald-600 mt-1">{taskStatusCounts.completed}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
