import { Users } from "lucide-react";
import { ExportButton } from "@/components/ui/export-button";
import { cn } from "@/lib/utils";

interface TeamPerformanceGridProps {
  teamPerformance?: Array<{
    department: string;
    averageScore: number | null;
    productivity: number;
    timeliness: number;
    quality: number;
    discipline: number;
    memberCount: number;
  }>;
  periodType: "monthly" | "yearly";
  selectedMonth: number;
  selectedYear: number;
  MONTHS: Array<{ label: string; value: number }>;
}

export function TeamPerformanceGrid({
  teamPerformance,
  periodType,
  selectedMonth,
  selectedYear,
  MONTHS,
}: TeamPerformanceGridProps) {
  if (!teamPerformance || teamPerformance.length === 0) return null;

  return (
    <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs">
      <div className="px-5 py-3.5 border-b border-border/70 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-muted/20">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Users className="size-3.5 text-primary shrink-0" /> {periodType === "yearly" ? "Department / Team Yearly Performance" : "Department / Team Performance"}
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Aggregated metric averages and efficiency benchmarks across active teams.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton
            filename={
              periodType === "yearly"
                ? `team-yearly-performance-${selectedYear}`
                : `team-performance-${MONTHS.find((m) => m.value === selectedMonth)?.label.toLowerCase()}-${selectedYear}`
            }
            title="Department / Team Performance"
            subtitle={
              periodType === "yearly"
                ? `Report for Year ${selectedYear} — Exported on ${new Date().toLocaleDateString()}`
                : `Report for ${MONTHS.find((m) => m.value === selectedMonth)?.label} ${selectedYear} — Exported on ${new Date().toLocaleDateString()}`
            }
            columns={[
              { header: "Department", key: "department" },
              { header: "Team Size", key: "memberCount" },
              { header: "Productivity", key: "productivity", format: (v: number) => `${v}%` },
              { header: "Timeliness", key: "timeliness", format: (v: number) => `${v}%` },
              { header: "Quality", key: "quality", format: (v: number) => `${v}%` },
              { header: "Discipline", key: "discipline", format: (v: number) => `${v}%` },
              { header: "Average Team Score", key: "averageScore", format: (v: number | null) => (v !== null ? `${v}%` : "—") },
            ]}
            rows={teamPerformance}
            label="Export Teams"
          />
          <div className="size-8 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Users className="size-4" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto min-h-[150px]">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-xs font-semibold text-muted-foreground">
              <th className="px-4 py-3 text-center w-14">Rank</th>
              <th className="px-5 py-3">Department</th>
              <th className="px-4 py-3 text-center">Team Size</th>
              <th className="px-4 py-3 text-center">Avg Productivity</th>
              <th className="px-4 py-3 text-center">Avg Timeliness</th>
              <th className="px-4 py-3 text-center">Avg Quality</th>
              <th className="px-4 py-3 text-center">Avg Discipline</th>
              <th className="px-5 py-3 text-right">Team Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 text-xs">
            {teamPerformance.map((team, index) => (
              <tr key={`team-row-${team.department}-${index}`} className="hover:bg-muted/30 transition-colors group">
                <td className="px-4 py-3.5 text-center font-bold text-muted-foreground tabular-nums">
                  {index + 1}
                </td>
                <td className="px-5 py-3.5 font-bold text-foreground group-hover:text-primary transition-colors">
                  {team.department}
                </td>
                <td className="px-4 py-3.5 text-center font-semibold text-foreground">
                  {team.memberCount} members
                </td>
                <td className="px-4 py-3.5 text-center font-mono font-medium text-foreground">
                  {team.productivity}%
                </td>
                <td className="px-4 py-3.5 text-center font-mono font-medium text-foreground">
                  {team.timeliness}%
                </td>
                <td className="px-4 py-3.5 text-center font-mono font-medium text-foreground">
                  {team.quality}%
                </td>
                <td className="px-4 py-3.5 text-center font-mono font-medium text-foreground">
                  {team.discipline}%
                </td>
                <td className="px-5 py-3.5 text-right font-bold text-sm tabular-nums text-foreground">
                  {team.averageScore !== null ? `${team.averageScore}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
