import React from "react";
import { Trophy, Users, Award, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TopPerformersProps {
  periodType: "monthly" | "yearly";
  employeeOfTheMonth: any;
  tlOfTheMonth: any;
  teamOfTheMonth: any;
}

export function TopPerformers({
  periodType,
  employeeOfTheMonth,
  tlOfTheMonth,
  teamOfTheMonth,
}: TopPerformersProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-scale-in">
      {/* Employee of the Month / Year */}
      {employeeOfTheMonth ? (
        <div className="relative overflow-hidden bg-card border border-amber-500/30 rounded-md p-5 flex items-center justify-between shadow-2xs group hover:border-amber-500/50 transition-all duration-300">
          <div className="flex items-center gap-3.5 z-10 min-w-0">
            <div className="size-11 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0 group-hover:scale-105 transition-transform">
              <Trophy className="size-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 leading-none">
                {periodType === "yearly" ? "Employee of the Year" : "Employee of the Month"}
              </span>
              <h4 className="text-sm font-bold text-foreground mt-1 truncate" title={employeeOfTheMonth.name}>
                {employeeOfTheMonth.name}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {employeeOfTheMonth.department} • Grade: <span className="text-amber-600 dark:text-amber-400 font-bold">{employeeOfTheMonth.grade}</span>
              </p>
            </div>
          </div>

          <div className="text-right z-10 shrink-0">
            <span className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
              {employeeOfTheMonth.overallScore}
            </span>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-none mt-0.5">
              Score
            </p>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden bg-card border border-border/80 rounded-md p-5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3.5 z-10">
            <div className="size-11 rounded-md bg-muted flex items-center justify-center border border-border/70 shrink-0">
              <Trophy className="size-5 text-muted-foreground/40" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 leading-none">
                {periodType === "yearly" ? "Employee of the Year" : "Employee of the Month"}
              </span>
              <h4 className="text-sm font-bold text-muted-foreground mt-1">
                Data pending
              </h4>
              <p className="text-xs text-muted-foreground/70">
                {periodType === "yearly" ? "No evaluations recorded for this year" : "No evaluations recorded for this month"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Team Leader of the Month / Year */}
      {tlOfTheMonth ? (
        <div className="relative overflow-hidden bg-card border border-indigo-500/30 rounded-md p-5 flex items-center justify-between shadow-2xs group hover:border-indigo-500/50 transition-all duration-300">
          <div className="flex items-center gap-3.5 z-10 min-w-0">
            <div className="size-11 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0 group-hover:scale-105 transition-transform">
              <Award className="size-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 leading-none">
                {periodType === "yearly" ? "Team Leader of the Year" : "Team Leader of the Month"}
              </span>
              <h4 className="text-sm font-bold text-foreground mt-1 truncate" title={tlOfTheMonth.tlName}>
                {tlOfTheMonth.tlName}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {tlOfTheMonth.department} • Punctuality: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{tlOfTheMonth.deptPunctuality}%</span>
              </p>
            </div>
          </div>

          <div className="text-right z-10 shrink-0">
            <span className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 tabular-nums">
              {tlOfTheMonth.overallScore}
            </span>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-none mt-0.5">
              Score
            </p>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden bg-card border border-border/80 rounded-md p-5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3.5 z-10">
            <div className="size-11 rounded-md bg-muted flex items-center justify-center border border-border/70 shrink-0">
              <Award className="size-5 text-muted-foreground/40" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 leading-none">
                {periodType === "yearly" ? "Team Leader of the Year" : "Team Leader of the Month"}
              </span>
              <h4 className="text-sm font-bold text-muted-foreground mt-1">
                Data pending
              </h4>
              <p className="text-xs text-muted-foreground/70">
                {periodType === "yearly" ? "No TL reviews recorded this year" : "No TL reviews recorded this month"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Team of the Month / Year */}
      {teamOfTheMonth ? (
        <div className="relative overflow-hidden bg-card border border-emerald-500/30 rounded-md p-5 flex items-center justify-between shadow-2xs group hover:border-emerald-500/50 transition-all duration-300">
          <div className="flex items-center gap-3.5 z-10 min-w-0">
            <div className="size-11 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0 group-hover:scale-105 transition-transform">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 leading-none">
                {periodType === "yearly" ? "Team of the Year" : "Team of the Month"}
              </span>
              <h4 className="text-sm font-bold text-foreground mt-1 truncate" title={teamOfTheMonth.department}>
                {teamOfTheMonth.department}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Quality: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{teamOfTheMonth.quality}%</span> • Prod: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{teamOfTheMonth.productivity}%</span>
              </p>
            </div>
          </div>

          <div className="text-right z-10 shrink-0">
            <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
              {teamOfTheMonth.averageScore}
            </span>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-none mt-0.5">
              Score
            </p>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden bg-card border border-border/80 rounded-md p-5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3.5 z-10">
            <div className="size-11 rounded-md bg-muted flex items-center justify-center border border-border/70 shrink-0">
              <ShieldCheck className="size-5 text-muted-foreground/40" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 leading-none">
                {periodType === "yearly" ? "Team of the Year" : "Team of the Month"}
              </span>
              <h4 className="text-sm font-bold text-muted-foreground mt-1">
                Data pending
              </h4>
              <p className="text-xs text-muted-foreground/70">
                {periodType === "yearly" ? "No department scores computed this year" : "No department scores computed this month"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
