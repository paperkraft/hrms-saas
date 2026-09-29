import { AlertCircle, HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MethodologyPanelProps {
  periodType: "monthly" | "yearly";
}

export function MethodologyPanel({ periodType }: MethodologyPanelProps) {
  return (
    <div className="bg-card border border-border/80 rounded-md p-5 space-y-3.5 shadow-2xs">
      {periodType === "yearly" ? (
        <>
          <div className="flex items-center gap-2 text-foreground">
            <AlertCircle className="size-4 text-primary" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Yearly Evaluation & Salary Increment Methodology</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-muted-foreground">
            <div className="space-y-1.5 font-medium">
              <p className="font-bold text-foreground">Yearly Aggregation & Grade Assignment</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Productivity / Timeliness / Quality / Discipline</strong>: Aggregated across the entire calendar year.</li>
                <li><strong>Yearly Performance Score</strong>: Calculated using the same weighted formula: <code className="text-primary font-bold">30% Prod + 25% Time + 25% Qual + 20% Disc</code>.</li>
                <li><strong>Grade Mapping</strong>: Excellent (&ge;90), Very Good (80-89), Good (70-79), Satisfactory (50-69), Needs Improvement (&lt;50).</li>
                <li><strong>Default Sort</strong>: Sorted by overall score descending, falling back to <strong>joining date</strong> ascending.</li>
              </ul>
            </div>
            <div className="space-y-1.5 font-medium">
              <p className="font-bold text-foreground">Interactive Salary Increment Planner</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Guidelines Adjuster</strong>: Allows modifying the default base increment percentage per grade.</li>
                <li><strong>Inline Calculator</strong>: Enter a baseline salary in the rankings grid to instantly compute:</li>
                <li className="pl-4"><strong>Increment Amount</strong>: <code className="text-primary font-bold">(Base Salary &times; Increment %) / 100</code></li>
                <li className="pl-4"><strong>Proposed Salary</strong>: <code className="text-primary font-bold">Base Salary + Increment Amount</code></li>
                <li><strong>Export Capabilities</strong>: Export the computed increment planner grid to CSV or printable PDF.</li>
              </ul>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 text-foreground">
            <AlertCircle className="size-4 text-primary" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Monthly Evaluation Formulas & Methodology</h4>
            <Popover>
              <PopoverTrigger className="p-1 hover:bg-muted rounded-md transition-colors">
                <HelpCircle className="size-3.5 text-muted-foreground hover:text-primary transition-colors" />
              </PopoverTrigger>
              <PopoverContent className="w-[360px] text-xs space-y-3 shadow-xl border border-border/80 rounded-md p-4" side="bottom" align="start">
                <h5 className="font-bold text-foreground border-b pb-2">Example: Performance Calculation</h5>
                <div className="space-y-2 mt-1">
                  <p className="font-semibold text-primary">Fair 4-Pillar System</p>
                  <p className="text-muted-foreground leading-tight">Everything is duration & priority-weighted (a 10-day HIGH priority task counts 15 points, while a 2-day LOW priority task counts 1.5 points).</p>
                </div>
                <div className="space-y-2 pt-1 border-t border-border/40 mt-3">
                  <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                    <li><strong>Productivity:</strong> Delivered Weight / Max(Due Weight, Dept Baseline)</li>
                    <li><strong>Timeliness:</strong> On-Time Weight / Submitted Deadline Weight</li>
                    <li><strong>Quality:</strong> 85% Rating + 15% FTR Acceptance (Defaults to 60% if unrated)</li>
                    <li><strong>Discipline:</strong> Present Days without Lateness / Total Present</li>
                  </ul>
                </div>
                <div className="pt-2 border-t font-semibold text-[11px]">
                  <p>Overall = (100 &times; 0.30) + (85 &times; 0.25) + (80 &times; 0.25) + (90 &times; 0.20)</p>
                  <p className="text-primary mt-1">Final Score = 30 + 21.25 + 20 + 18 = <span className="font-bold text-sm">89% (Very Good)</span></p>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-muted-foreground">
            <div className="space-y-1.5 font-medium">
              <p className="font-bold text-foreground">Employee Metrics (Duration-Weighted)</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Task Grouping</strong>: Evaluated in the month of their <strong>deadline</strong>.</li>
                <li><strong>Task Weighting</strong>: Uses task duration (days) &times; Priority (Urgent/High = 1.5x, Low = 0.75x).</li>
                <li><strong>Productivity</strong>: Measures delivered volume against assigned due weight or Department Baseline.</li>
                <li><strong>Overall Score</strong>: <code className="text-primary font-bold">30% Prod + 25% Time + 25% Qual + 20% Disc</code>.</li>
                <li><strong>Probation</strong>: Employees within 90 days receive a Probation badge.</li>
              </ul>
            </div>
            <div className="space-y-1.5 font-medium">
              <p className="font-bold text-foreground">Team Leader & Team Metrics</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Review Queue</strong>: Tracks pending and overdue task reviews.</li>
                <li><strong>Review Efficiency</strong>: Continuous score factoring in turnaround time and average delay days.</li>
                <li><strong>Team Punctuality</strong>: Aggregated presence and punctuality rate of department members.</li>
                <li><strong>Team Performance</strong>: Departmental averages across productivity, quality, and timeliness.</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
