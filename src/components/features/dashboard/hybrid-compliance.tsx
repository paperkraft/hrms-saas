"use client";

import { Building2, Home, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface HybridComplianceProps {
  stats: {
    minOfficeDays: number;
    completedOfficeDays: number;
  };
}

export function HybridCompliance({ stats }: HybridComplianceProps) {
  const percentage = Math.min(100, (stats.completedOfficeDays / stats.minOfficeDays) * 100);
  const isCompliant = stats.completedOfficeDays >= stats.minOfficeDays;

  return (
    <div className="bg-card border border-border/80 rounded-md p-5 space-y-4 shadow-2xs animate-fade-in relative overflow-hidden group">
      {/* Background Decor */}
      <div className="absolute -right-4 -top-4 opacity-[0.03] rotate-12 group-hover:rotate-0 transition-transform duration-700 pointer-events-none">
        <Building2 className="size-24" />
      </div>

      <div className="flex items-center justify-between relative z-10">
        <div className="space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Work Mode Compliance</p>
          <h3 className="text-sm font-bold text-foreground tracking-tight">Hybrid Attendance</h3>
        </div>
        <div className={cn(
          "px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
          isCompliant 
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
        )}>
          {isCompliant ? "Goal Reached" : "In Progress"}
        </div>
      </div>

      <div className="space-y-2 relative z-10">
        <div className="flex items-end justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums text-foreground tracking-tight">{stats.completedOfficeDays}</span>
            <span className="text-xs font-semibold text-muted-foreground">/ {stats.minOfficeDays} office days</span>
          </div>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Weekly Goal</span>
        </div>

        <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-1000 ease-out",
              isCompliant ? "bg-emerald-500" : "bg-amber-500"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] font-medium relative z-10 pt-1 border-t border-border/50">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Home className="size-3.5 text-primary" />
          <span>Flexible remote days</span>
        </div>
        {isCompliant ? (
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
            <CheckCircle2 className="size-3.5" />
            <span>Quota satisfied</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
            <AlertCircle className="size-3.5" />
            <span>{stats.minOfficeDays - stats.completedOfficeDays} more to go</span>
          </div>
        )}
      </div>
    </div>
  );
}
