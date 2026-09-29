"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ExportButton } from "@/components/ui/export-button";
import { Users, Star, AlertTriangle, Clock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2);
}

function getRateColorClass(rate: number) {
  if (rate >= 90) return "bg-emerald-500";
  if (rate >= 75) return "bg-teal-500";
  if (rate >= 50) return "bg-amber-500";
  return "bg-rose-500";
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

export function MonthlyReportsTable({
  employeePerformance,
  filteredEmployees,
  selectedMonth,
  selectedYear,
  MONTHS,
}: any) {
  return (
    <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs">
      <div className="px-5 py-3.5 border-b border-border/70 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-muted/20">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Users className="size-3.5 text-primary shrink-0" /> Employee Performance & Rankings
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Evaluated for {MONTHS.find((m: any) => m.value === selectedMonth)?.label} {selectedYear} across all department metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton
            filename={`employee-performance-${MONTHS.find((m: any) => m.value === selectedMonth)?.label.toLowerCase()}-${selectedYear}`}
            title="Employee Performance & Evaluation Rankings"
            subtitle={`Report for ${MONTHS.find((m: any) => m.value === selectedMonth)?.label} ${selectedYear} — Exported on ${new Date().toLocaleDateString()}`}
            columns={[
              { header: "Employee Name", key: "name" },
              { header: "Department", key: "department" },
              { header: "Total Tasks Assigned", key: "totalTasks" },
              { header: "Productivity", key: "productivity", format: (v: number) => `${v}%` },
              { header: "Timeliness", key: "timeliness", format: (v: number) => `${v}%` },
              { header: "Quality", key: "quality", format: (v: number) => `${v}%` },
              { header: "Discipline", key: "discipline", format: (v: number) => `${v}%` },
              { header: "Average Quality Rating", key: "avgRating", format: (v: number) => (v > 0 ? `${v} / 5` : "—") },
              { header: "Overall Performance Score", key: "overallScore" },
              { header: "Performance Grade", key: "grade" },
            ]}
            rows={filteredEmployees}
            label="Export Rankings"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-xs font-semibold text-muted-foreground">
              <th className="px-5 py-3">Employee</th>
              <th className="px-4 py-3 text-center">Tasks</th>
              <th className="px-4 py-3">Productivity</th>
              <th className="px-4 py-3">Timeliness</th>
              <th className="px-4 py-3">Quality</th>
              <th className="px-4 py-3">Discipline</th>
              <th className="px-3 py-3 text-center">Avg Rating</th>
              <th className="px-3 py-3 text-center">Score</th>
              <th className="px-5 py-3 text-right">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 text-xs">
            {employeePerformance.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-16 text-center text-muted-foreground font-medium">
                  Performance data not available for the selected month.
                </td>
              </tr>
            ) : filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-16 text-center text-muted-foreground font-medium">
                  No employees found matching search criteria.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp: any, idx: number) => (
                <tr key={`monthly-emp-${emp.id}-${idx}`} className="hover:bg-muted/30 transition-colors group">
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
                        <p className="font-bold text-foreground group-hover:text-primary transition-colors truncate max-w-[170px]">{emp.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate max-w-[170px]">{emp.department}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center font-bold text-foreground tabular-nums">
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{emp.totalTasks}</span>
                      {emp.totalTasks > 0 && (
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            emp.confidence === "high" ? "bg-emerald-500" : emp.confidence === "medium" ? "bg-amber-500" : "bg-rose-500"
                          )}
                          title={`${emp.confidence} confidence`}
                        />
                      )}
                    </div>
                  </td>

                  {/* Productivity */}
                  <td className="px-4 py-3.5">
                    <div className="space-y-1.5">
                      <span className="text-xs font-mono font-semibold text-foreground">{emp.productivity}%</span>
                      <div className="w-24 h-1.5 bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-300", getRateColorClass(emp.productivity))}
                          style={{ width: `${emp.productivity}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Timeliness */}
                  <td className="px-4 py-3.5">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-semibold text-foreground">{emp.timeliness}%</span>
                        {emp.deadlineCoverageRatio !== undefined && emp.deadlineCoverageRatio < 40 && (
                          <span title="Low Deadline Coverage (<40%)" className="text-amber-500 cursor-help">
                            <AlertTriangle className="size-3" />
                          </span>
                        )}
                      </div>
                      <div className="w-24 h-1.5 bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-300", getRateColorClass(emp.timeliness))}
                          style={{ width: `${emp.timeliness}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Quality */}
                  <td className="px-4 py-3.5">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-semibold text-foreground">{emp.quality}%</span>
                        {emp.isQualityDefaulted && (
                          <span
                            title={
                              emp.historicalQualityUsed !== null
                                ? `Pending Rating (Using ${emp.historicalQualityUsed.toFixed(0)}% historical average)`
                                : "Pending Rating (Using default)"
                            }
                            className="text-blue-400 cursor-help"
                          >
                            <Clock className="size-3" />
                          </span>
                        )}
                      </div>
                      <div className="w-24 h-1.5 bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-300", getRateColorClass(emp.quality))}
                          style={{ width: `${emp.quality}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Discipline */}
                  <td className="px-4 py-3.5">
                    <div className="space-y-1.5">
                      <span className="text-xs font-mono font-semibold text-foreground">{emp.discipline}%</span>
                      <div className="w-24 h-1.5 bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-300", getRateColorClass(emp.discipline))}
                          style={{ width: `${emp.discipline}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Avg Rating */}
                  <td className="px-3 py-3.5">
                    {emp.avgRating > 0 ? (
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-bold text-foreground">{emp.avgRating}</span>
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <span className="text-muted-foreground/40 font-semibold">—</span>
                      </div>
                    )}
                  </td>

                  {/* Overall Score */}
                  <td className="px-3 py-3.5 text-center font-bold text-sm tabular-nums text-foreground">{emp.overallScore}</td>

                  {/* Grade */}
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
