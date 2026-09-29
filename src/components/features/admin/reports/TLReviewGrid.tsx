import { Clock } from "lucide-react";
import { ExportButton } from "@/components/ui/export-button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface TLReviewGridProps {
  tlPerformance: Array<{
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
  periodType: "monthly" | "yearly";
  selectedMonth: number;
  selectedYear: number;
  MONTHS: Array<{ label: string; value: number }>;
}

export function TLReviewGrid({
  tlPerformance,
  periodType,
  selectedMonth,
  selectedYear,
  MONTHS,
}: TLReviewGridProps) {
  return (
    <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs">
      <div className="px-5 py-3.5 border-b border-border/70 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-muted/20">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Clock className="size-3.5 text-primary shrink-0" /> {periodType === "yearly" ? "Team Leader Yearly Review Efficiency" : "Team Leader Review Efficiency"}
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Review turnaround latency, pending reviews, and department punctuality.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton
            filename={
              periodType === "yearly"
                ? `tl-yearly-performance-${selectedYear}`
                : `tl-performance-${MONTHS.find((m) => m.value === selectedMonth)?.label.toLowerCase()}-${selectedYear}`
            }
            title="Team Leader Performance & Review Efficiency"
            subtitle={
              periodType === "yearly"
                ? `Report for Year ${selectedYear} — Exported on ${new Date().toLocaleDateString()}`
                : `Report for ${MONTHS.find((m) => m.value === selectedMonth)?.label} ${selectedYear} — Exported on ${new Date().toLocaleDateString()}`
            }
            columns={[
              { header: "Team Leader", key: "tlName" },
              { header: "Department", key: "department" },
              { header: "Pending Reviews", key: "pendingReviews" },
              { header: "Overdue Reviews", key: "overdueReviews" },
              { header: "Average Delay Days", key: "avgDelayDays", format: (v: number, row: any) => (row.overdueReviews > 0 ? `${v} days` : "—") },
              { header: "Review Efficiency Score", key: "reviewEfficiency", format: (v: number) => `${v}%` },
            ]}
            rows={tlPerformance}
            label="Export Leadership"
          />
          <div className="size-8 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Clock className="size-4" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-xs font-semibold text-muted-foreground">
              <th className="px-5 py-3">Team Leader</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3 text-center">Review Queue</th>
              <th className="px-4 py-3 text-center">Efficiency</th>
              <th className="px-5 py-3 text-right">Leadership Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 text-xs">
            {tlPerformance.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-muted-foreground font-medium">
                  {periodType === "yearly"
                    ? "Performance data not available for the selected year."
                    : "Performance data not available for the selected month."}
                </td>
              </tr>
            ) : (
              tlPerformance.map((tl, idx) => (
                <tr key={`tl-row-${tl.tlId}-${tl.department}-${idx}`} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8 rounded-full shrink-0">
                        {tl.avatarUrl && (
                          <AvatarImage src={tl.avatarUrl} alt={tl.tlName} className="object-cover rounded-full" />
                        )}
                        <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary rounded-full">
                          {getInitials(tl.tlName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground group-hover:text-primary transition-colors truncate max-w-[170px]">{tl.tlName}</p>
                        <p className="text-[11px] text-muted-foreground truncate max-w-[170px]">{tl.department}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground font-medium text-xs">
                    {tl.department}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xs font-mono font-semibold text-foreground">
                        {tl.pendingReviews} pending
                      </span>
                      {tl.overdueReviews > 0 && (
                        <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0.2 rounded-sm bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25">
                          {tl.overdueReviews} overdue
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono font-semibold text-foreground">
                    {tl.bayesianOTRR !== null ? `${tl.bayesianOTRR}%` : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-sm tabular-nums text-foreground">
                    {tl.overallScore !== null ? tl.overallScore : "—"}
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
