"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TableHead,
  Input,
  TableCell,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { CalendarRange, MessageSquare, Search, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExportButton } from "@/components/ui/export-button";
import { usePagination } from "@/hooks/use-pagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

interface LeaveRequest {
  id: string;
  startDate: Date | string;
  endDate: Date | string;
  leaveType: string | null;
  duration: string;
  halfDayType: string | null;
  category: string;
  status: string;
  reason: string | null;
  startTime: string | null;
  endTime: string | null;
}

interface LeaveHistoryTableProps {
  leaves: LeaveRequest[];
}

export function LeaveHistoryTable({ leaves }: LeaveHistoryTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return "--:--";
    if (timeStr.toUpperCase().includes("AM") || timeStr.toUpperCase().includes("PM")) return timeStr;
    try {
      const parts = timeStr.split(':');
      if (parts.length < 2) return timeStr;
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      if (isNaN(hours) || isNaN(minutes)) return timeStr;
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
    } catch (e) { return timeStr; }
  };

  const filteredLeaves = useMemo(() => {
    if (!searchTerm) return leaves;
    const term = searchTerm.toLowerCase();
    return leaves.filter(leave => {
      const typeStr = (leave.leaveType === "CASUAL" ? "casual" : leave.leaveType === "MEDICAL" ? "sick" : "leave").toLowerCase();
      const statusStr = leave.status.toLowerCase();
      const reasonStr = (leave.reason || "").toLowerCase();
      return typeStr.includes(term) || statusStr.includes(term) || reasonStr.includes(term);
    });
  }, [leaves, searchTerm]);

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems: paginatedLeaves,
    totalItems,
    itemsPerPage
  } = usePagination(filteredLeaves, 10);

  const getStatusConfig = (status: string) => {
    if (status === "APPROVED") return { dot: "bg-emerald-500", text: "text-emerald-600", label: "Approved" };
    if (status === "REJECTED") return { dot: "bg-rose-500", text: "text-rose-600", label: "Rejected" };
    return { dot: "bg-amber-500 animate-pulse", text: "text-amber-600", label: "Pending" };
  };

  const getDurationLabel = (leave: LeaveRequest) => {
    if (leave.duration === "FULL") return "Full day";
    if (leave.duration === "HALF") return `Half day${leave.halfDayType ? ` · ${leave.halfDayType === "FIRST_HALF" ? "1st" : "2nd"}` : ""}`;
    if (leave.duration === "SHORT") return `Short · ${formatTime(leave.startTime)}–${formatTime(leave.endTime)}`;
    return leave.duration;
  };

  const getDurationColor = (duration: string) => {
    if (duration === "HALF") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/10";
    if (duration === "SHORT") return "bg-primary/10 text-primary border-primary/10";
    return "bg-muted/20 text-muted-foreground/80 border-border/20";
  };



  return (
    <div className="animate-fade-in flex flex-col h-full">
      {/* Controls */}
      <div className="px-5 py-3.5 flex items-center justify-between gap-4 border-b border-border/70 bg-muted/10">
        <div className="hidden md:relative md:flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/40" />
          <Input placeholder="Search leaves or status..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="pl-9 h-8 border-border/80 focus:ring-primary/20 transition-all rounded-md text-xs bg-muted/20" />
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-2 py-0.5 rounded-md border border-border/70 bg-muted/20">{filteredLeaves.length} Requests</span>
          <ExportButton
            filename={`leave-history-${new Date().toISOString().split('T')[0]}`}
            title="Leave History Report"
            subtitle={`Exported on ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
            columns={[
              { header: "Start Date", key: "startDate", format: (v) => new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
              { header: "End Date", key: "endDate", format: (v) => new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
              { header: "Type", key: "leaveType", format: (v) => v === "CASUAL" ? "Casual" : v === "MEDICAL" ? "Medical" : "Other" },
              {
                header: "Duration", key: "duration", format: (v, row) => {
                  if (v === "HALF") return `Half Day${row.halfDayType ? " - " + (row.halfDayType === "FIRST_HALF" ? "1st" : "2nd") : ""}`;
                  if (v === "SHORT") return `Short (${row.startTime || ""} - ${row.endTime || ""})`;
                  return "Full Day";
                }
              },
              { header: "Category", key: "category", format: (v) => v === "MONTHLY_POLICY_1" ? "Monthly" : v === "UNPAID" ? "Unpaid" : "Earned" },
              { header: "Status", key: "status", format: (v) => v },
              { header: "Reason", key: "reason", format: (v) => v || "" },
            ]}
            rows={filteredLeaves}
          />
        </div>
      </div>

      {filteredLeaves.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center gap-2 opacity-30">
          <Search className="size-7" />
          <p className="text-[10px] font-black uppercase tracking-widest">No matching history</p>
        </div>
      ) : (
        <>
          {/* ── MOBILE CARD VIEW (< md) ── */}
          <div className="md:hidden divide-y divide-border/40">
            {paginatedLeaves.map((leave) => {
              const start = new Date(leave.startDate);
              const end = new Date(leave.endDate);
              const status = getStatusConfig(leave.status);
              const days = (() => {
                let count = 0;
                let cur = new Date(start);
                while (cur <= end) { if (cur.getDay() !== 0) count++; cur.setDate(cur.getDate() + 1); }
                return count;
              })();

              return (
                <div key={leave.id} className="px-4 py-3.5 hover:bg-muted/10 active:bg-muted/20 transition-colors">
                  {/* Row 1: date + status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="size-9 shrink-0 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <CalendarRange className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-foreground leading-none">
                          {start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        {start.getTime() !== end.getTime() && (
                          <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight mt-0.5">
                            — {end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className={cn("size-1.5 rounded-full", status.dot)} />
                      <span className={cn("text-[9px] font-black uppercase tracking-widest", status.text)}>{status.label}</span>
                    </div>
                  </div>
                  {/* Row 2: tags */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border", getDurationColor(leave.duration))}>
                      {getDurationLabel(leave)}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-border/80 bg-muted/20 text-muted-foreground">
                      {leave.leaveType === "CASUAL" ? "Casual" : leave.leaveType === "MEDICAL" ? "Sick" : "Leave"}
                    </span>
                    {leave.duration !== "SHORT" && (
                      <span className="text-[9px] font-semibold text-muted-foreground">{days} {days === 1 ? "day" : "days"}</span>
                    )}
                  </div>
                  {/* Row 3: reason */}
                  {leave.reason && (
                    <div className="flex items-start gap-1.5 mt-2">
                      <MessageSquare className="size-3 text-muted-foreground/40 mt-0.5 shrink-0" />
                      <p className="text-[10px] text-muted-foreground italic line-clamp-2 leading-snug">{leave.reason}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── DESKTOP TABLE VIEW (md+) ── */}
          <div className="hidden md:block overflow-x-auto border-t border-border/70 flex-1">
            <div className="inline-block min-w-full align-middle">
              <Table className="min-w-[600px]">
                <TableHeader className="bg-muted/20">
                  <TableRow className="border-b border-border/70 hover:bg-transparent">
                    <TableHead className="py-3 px-5 font-black text-[10px] uppercase tracking-widest text-muted-foreground w-[200px] whitespace-nowrap">Timeline</TableHead>
                    <TableHead className="py-3 px-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground text-center whitespace-nowrap">Duration</TableHead>
                    <TableHead className="py-3 px-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">Type</TableHead>
                    <TableHead className="py-3 px-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">Reason</TableHead>
                    <TableHead className="py-3 px-5 font-black text-[10px] uppercase tracking-widest text-muted-foreground text-right whitespace-nowrap">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLeaves.map((leave) => {
                    const start = new Date(leave.startDate);
                    const end = new Date(leave.endDate);
                    const status = getStatusConfig(leave.status);
                    const days = (() => {
                      let count = 0;
                      let cur = new Date(start);
                      while (cur <= end) { if (cur.getDay() !== 0) count++; cur.setDate(cur.getDate() + 1); }
                      return count;
                    })();
                    return (
                      <TableRow key={leave.id} className="hover:bg-muted/20 transition-colors border-b border-border/40 group last:border-0">
                        <TableCell className="py-3 px-5 md:sticky md:left-0 md:bg-card md:group-hover:bg-muted/30 md:z-10 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                          <div className="flex items-center gap-2.5 min-w-[150px]">
                            <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-colors">
                              <CalendarRange className="size-3.5" />
                            </div>
                            <div>
                              <p className="text-[11px] font-bold text-foreground leading-none">
                                {start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                              {start.getTime() !== end.getTime() && (
                                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight mt-0.5">
                                  — {end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-center">
                          <div className="inline-flex flex-col items-center min-w-[80px]">
                            <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border mb-0.5", getDurationColor(leave.duration))}>
                              {leave.duration === "FULL" ? "Full day" : leave.duration === "HALF" ? "Half day" : "Short"}
                            </span>
                            {leave.duration === "HALF" && leave.halfDayType && (
                              <span className={cn("text-[8px] font-bold uppercase tracking-tight mb-1", leave.halfDayType === "FIRST_HALF" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                                {leave.halfDayType === "FIRST_HALF" ? "1st Half" : "2nd Half"}
                              </span>
                            )}
                            <span className="text-[9px] font-semibold text-muted-foreground tabular-nums">
                              {leave.duration === "SHORT" ? `${formatTime(leave.startTime)} - ${formatTime(leave.endTime)}` : `${days} ${days === 1 ? 'day' : 'days'}`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <div className="flex flex-col min-w-[100px]">
                            <span className="text-[11px] font-bold text-foreground uppercase tracking-tight">
                              {leave.leaveType === "CASUAL" ? "Casual Leave" : leave.leaveType === "MEDICAL" ? "Sick Leave" : "Other Leave"}
                            </span>
                            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">
                              {leave.category === "MONTHLY_POLICY_1" ? "Monthly" : leave.category === "UNPAID" ? "Unpaid" : "Policy"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <div className="flex items-start gap-1.5 min-w-[150px]">
                            <MessageSquare className="size-3 text-muted-foreground/50 mt-0.5" />
                            <p className="text-[10px] font-medium text-muted-foreground leading-snug line-clamp-2 italic" title={leave.reason || ""}>
                              {leave.reason || "No reason specified"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5 min-w-[80px]">
                            <div className={cn("size-1.5 rounded-full", status.dot)} />
                            <span className={cn("text-[9px] font-black uppercase tracking-widest", status.text)}>{leave.status}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            showOnlyNavigationOnMobile={true}
          />
        </>
      )}
    </div>
  );
}
