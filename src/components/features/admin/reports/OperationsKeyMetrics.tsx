import { Users, Activity, Briefcase, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Summaries {
  totalEmployees: number;
  attendanceRateToday: number;
  activeProjects: number;
  totalProjects: number;
  averagePerformanceRating: number;
}

interface OperationsKeyMetricsProps {
  summaries: Summaries;
}

export function OperationsKeyMetrics({ summaries }: OperationsKeyMetricsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* Metric 1 */}
      <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
        <div className="flex items-center justify-between text-muted-foreground mb-1.5">
          <span className="text-xs font-medium">Active Headcount</span>
          <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Users className="size-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-foreground tracking-tight">{summaries.totalEmployees}</span>
          <span className="text-[11px] text-muted-foreground">verified staff</span>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-primary" />
          <span>Active payroll personnel</span>
        </div>
      </div>

      {/* Metric 2 */}
      <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
        <div className="flex items-center justify-between text-muted-foreground mb-1.5">
          <span className="text-xs font-medium">Today's Attendance</span>
          <div className="size-8 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Activity className="size-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
            {summaries.attendanceRateToday}%
          </span>
          <span className="text-[11px] text-muted-foreground">presence ratio</span>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-emerald-500" />
          <span>Live check-in efficiency</span>
        </div>
      </div>

      {/* Metric 3 */}
      <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
        <div className="flex items-center justify-between text-muted-foreground mb-1.5">
          <span className="text-xs font-medium">Active Projects</span>
          <div className="size-8 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Briefcase className="size-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 tracking-tight">
            {summaries.activeProjects}
          </span>
          <span className="text-[11px] text-muted-foreground">of {summaries.totalProjects} orders</span>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-indigo-500" />
          <span>Ongoing client deliveries</span>
        </div>
      </div>

      {/* Metric 4 */}
      <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
        <div className="flex items-center justify-between text-muted-foreground mb-1.5">
          <span className="text-xs font-medium">Task Rating (Avg)</span>
          <div className="size-8 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Star className="size-4 fill-amber-500/30" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-foreground tracking-tight">
            {summaries.averagePerformanceRating ? Number(summaries.averagePerformanceRating).toFixed(1) : "—"}
          </span>
          <div className="flex items-center gap-0.5 ml-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={cn(
                  "size-3",
                  s <= Math.round(summaries.averagePerformanceRating || 0)
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/30"
                )}
              />
            ))}
          </div>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-amber-500" />
          <span>Team lead quality review</span>
        </div>
      </div>
    </div>
  );
}
