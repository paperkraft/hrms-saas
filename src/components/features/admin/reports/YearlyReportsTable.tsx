"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ExportButton } from "@/components/ui/export-button";
import { TrendingUp, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

function formatJoiningDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "—";
    return format(d, "dd/MM/yyyy");
  } catch {
    return "—";
  }
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2);
}

function getGradeBadgeClass(grade: string) {
  switch (grade) {
    case "Excellent":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25";
    case "Very Good":
      return "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/25";
    case "Good":
      return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25";
    case "Satisfactory":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25";
    case "Needs Improvement":
      return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function YearlyReportsTable({
  employeePerformance,
  filteredEmployees,
  selectedYear,
  baselineSalaries,
  setBaselineSalaries,
  incrementRules,
  yearlyExportColumns,
  exportedYearlyData,
}: any) {
  return (
    <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs">
      <div className="px-5 py-3.5 border-b border-border/70 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-muted/20">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-primary shrink-0" /> Yearly Performance & Salary Increment Planner
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Annual cumulative evaluation and compensation adjustment planner for {selectedYear}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton
            filename={`yearly-salary-increment-planner-${selectedYear}`}
            title="Yearly Performance & Salary Increment Planner"
            subtitle={`Report for Year ${selectedYear} — Exported on ${new Date().toLocaleDateString()}`}
            columns={yearlyExportColumns}
            rows={exportedYearlyData}
            label="Export Planner"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-xs font-semibold text-muted-foreground">
              <th className="px-4 py-3 text-center w-14">Rank</th>
              <th className="px-5 py-3">Employee</th>
              <th className="px-4 py-3">Joining Date</th>
              <th className="px-3 py-3 text-center">Score</th>
              <th className="px-4 py-3">Grade</th>
              <th className="px-4 py-3 text-right">Rec. Incr %</th>
              <th className="px-4 py-3 text-center">Baseline Salary (₹)</th>
              <th className="px-4 py-3 text-right">Increment Amt</th>
              <th className="px-5 py-3 text-right">Proposed Salary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 text-xs">
            {employeePerformance.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-16 text-center text-muted-foreground font-medium">
                  Performance data not available for the selected year.
                </td>
              </tr>
            ) : filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-16 text-center text-muted-foreground font-medium">
                  No employees found matching search criteria.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp: any, index: number) => {
                const baseValStr = baselineSalaries[emp.id] || "";
                const baseSalary = parseFloat(baseValStr) || 0;
                const incPercent = incrementRules[emp.grade] ?? 0;
                const incAmount = (baseSalary * incPercent) / 100;
                const proposedSalary = baseSalary + incAmount;

                return (
                  <tr key={`yearly-emp-${emp.id}-${index}`} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3.5 text-center font-bold text-muted-foreground tabular-nums">
                      {index + 1}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8 rounded-full shrink-0">
                          {emp.avatarUrl && (
                            <AvatarImage src={emp.avatarUrl} alt={emp.name} className="object-cover rounded-full" />
                          )}
                          <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary rounded-full">
                            {getInitials(emp.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-bold text-foreground group-hover:text-primary transition-colors truncate max-w-[170px]">
                            {emp.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[170px]">{emp.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs">
                      {formatJoiningDate(emp.joiningDate)}
                    </td>
                    <td className="px-3 py-3.5 text-center font-bold text-sm tabular-nums text-foreground">
                      {emp.overallScore}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {emp.isProbation && (
                          <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0.2 rounded-sm bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25 flex items-center gap-1">
                            <Shield className="size-2.5" />
                            Probation
                          </Badge>
                        )}
                        <Badge variant="outline" className={cn("text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-tight whitespace-nowrap", getGradeBadgeClass(emp.grade))}>
                          {emp.grade}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-primary">
                      {incPercent}%
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <input
                        type="number"
                        min="0"
                        step="500"
                        placeholder="Enter base..."
                        value={baseValStr}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBaselineSalaries((prev: any) => ({ ...prev, [emp.id]: val }));
                        }}
                        className="w-28 text-center bg-background border border-border/70 rounded-md px-2 py-1 text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                      />
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {incAmount > 0 ? `+ ₹${incAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-foreground">
                      {proposedSalary > 0 ? `₹${proposedSalary.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
