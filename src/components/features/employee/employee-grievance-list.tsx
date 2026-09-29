"use client";

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageSquareWarning } from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime12hr(time24: string) {
  if (!time24) return "";
  const [hours, minutes] = time24.split(":");
  if (!hours || !minutes) return time24;
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
}

export function EmployeeGrievanceList({ grievances }: { grievances: any[] }) {
  if (!grievances || grievances.length === 0) {
    return null;
  }

  return (
    <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs animate-fade-in">
      <div className="px-5 py-4 border-b border-border/70 bg-muted/20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
            <MessageSquareWarning className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Attendance Adjustments</h3>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Missed punch requests for this month</p>
          </div>
        </div>
      </div>
      {/* Mobile View */}
      <div className="md:hidden flex flex-col divide-y divide-border/40">
        {grievances.map((g) => (
          <div key={g.id} className="p-4 space-y-3 hover:bg-muted/10 transition-colors">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">{format(new Date(g.date), "dd MMM yyyy")}</p>
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border",
                g.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                  g.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' :
                    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              )}>
                {g.status}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className={cn(
                "w-fit text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border",
                g.grievanceType === 'FORGOT_PUNCH_IN' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
                  g.grievanceType === 'FORGOT_PUNCH_OUT' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                    g.grievanceType === 'FORGOT_BOTH' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' :
                      'bg-muted/20 text-muted-foreground border-border/80'
              )}>
                {g.grievanceType.replace(/_/g, ' ')}
              </span>
              <div className="flex gap-4 mt-1">
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Req Time</p>
                  <p className="text-xs font-bold text-foreground">{formatTime12hr(g.requestedTime)}</p>
                </div>
                {g.grievanceType === 'FORGOT_BOTH' && g.requestedOutTime && (
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Out Time</p>
                    <p className="text-xs font-bold text-foreground">{formatTime12hr(g.requestedOutTime)}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold mt-1">Reason</p>
                <p className="text-xs text-foreground mt-0.5 line-clamp-2">{g.reason}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader className="bg-muted/20 border-b border-border/70">
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</TableHead>
              <TableHead className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Type</TableHead>
              <TableHead className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Requested Times</TableHead>
              <TableHead className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reason</TableHead>
              <TableHead className="py-3 px-5 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/40">
            {grievances.map((g) => (
              <TableRow key={g.id} className="hover:bg-muted/20 transition-colors group">
                <TableCell className="py-3 px-4">
                  <p className="text-xs font-semibold text-foreground">{format(new Date(g.date), "dd MMM yyyy")}</p>
                </TableCell>
                <TableCell className="py-3 px-4">
                  <span className={cn(
                    "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border inline-block",
                    g.grievanceType === 'FORGOT_PUNCH_IN' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
                      g.grievanceType === 'FORGOT_PUNCH_OUT' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                        g.grievanceType === 'FORGOT_BOTH' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' :
                          'bg-muted/20 text-muted-foreground border-border/80'
                  )}>
                    {g.grievanceType.replace(/_/g, ' ')}
                  </span>
                </TableCell>
                <TableCell className="py-3 px-4">
                  <p className="text-[11px] font-bold text-foreground">In: {formatTime12hr(g.requestedTime)}</p>
                  {g.grievanceType === 'FORGOT_BOTH' && g.requestedOutTime && (
                    <p className="text-[11px] font-bold text-muted-foreground mt-0.5">Out: {formatTime12hr(g.requestedOutTime)}</p>
                  )}
                </TableCell>
                <TableCell className="py-3 px-4">
                  <p className="text-xs max-w-[200px] truncate text-muted-foreground" title={g.reason}>{g.reason}</p>
                </TableCell>
                <TableCell className="py-3 px-5 text-right">
                  <span className={cn(
                    "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border inline-block",
                    g.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                      g.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' :
                        'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  )}>
                    {g.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
