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
} from "@/components/ui";
import { Calendar, Clock, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExportButton } from "@/components/ui/export-button";
import { usePagination } from "@/hooks/use-pagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

interface AttendanceLog {
  id: string;
  date: Date;
  punchIn: Date | null;
  punchOut: Date | null;
  isLate: boolean;
  isLateSpecialCase?: boolean;
  isHalfDay?: boolean;
  isAutoPunchOut: boolean;
  isOutsideOffice: boolean;
}

interface AttendanceHistoryTableProps {
  logs: AttendanceLog[];
}

export function AttendanceHistoryTable({ logs }: AttendanceHistoryTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredLogs = useMemo(() => {
    let filtered = logs;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => {
        const dateStr = new Date(log.date).toLocaleDateString().toLowerCase();
        const statusStr = log.isHalfDay ? "half day" : log.isLate ? "late" : "on time";
        const locationStr = log.isOutsideOffice ? "external" : "office";
        return dateStr.includes(term) || statusStr.includes(term) || locationStr.includes(term);
      });
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [logs, searchTerm]);

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems: paginatedLogs,
    totalItems,
    itemsPerPage
  } = usePagination(filteredLogs, 10);

  const getStatusConfig = (log: AttendanceLog) => {
    if (log.isHalfDay) return { color: "bg-purple-500", text: "Half Day (Late Entry)", textColor: "text-purple-600", pulse: false };
    if (log.isLate && !log.isLateSpecialCase) return { color: "bg-amber-500", text: "Late Entry", textColor: "text-amber-600", pulse: true };
    if (log.isLate && log.isLateSpecialCase) return { color: "bg-emerald-400", text: "Late (Excused)", textColor: "text-emerald-500", pulse: false };
    return { color: "bg-emerald-500", text: "On Time", textColor: "text-emerald-600", pulse: false };
  };



  return (
    <div className="animate-fade-in flex flex-col h-full">
      {/* Controls */}
      <div className="px-5 py-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 border-b border-border/70 bg-muted/10">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          <div className="hidden relative md:flex md:flex-1 md:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/40" />
            <Input placeholder="Search dates or status..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="pl-9 h-8 border-border/80 focus:ring-primary/20 transition-all rounded-md text-xs bg-muted/20" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-2 py-0.5 rounded-md border border-border/70 bg-muted/20">{filteredLogs.length} Records</span>
          <ExportButton
            filename={`attendance-history-${new Date().toISOString().split('T')[0]}`}
            title="Attendance History Report"
            subtitle={`Exported on ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
            columns={[
              { header: "Date", key: "date", format: (v) => new Date(v).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) },
              { header: "Check In", key: "punchIn", format: (v) => v ? new Date(v).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : "--" },
              { header: "Check Out", key: "punchOut", format: (v) => v ? new Date(v).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : "--" },
              { header: "Status", key: "isLate", format: (v, row) => row.isLate ? (row.isLateSpecialCase ? "Late (Excused)" : "Late") : "On Time" },
              { header: "Location", key: "isOutsideOffice", format: (v) => v ? "Remote" : "Office" },
              { header: "Auto Checkout", key: "isAutoPunchOut", format: (v) => v ? "Yes" : "No" },
            ]}
            rows={filteredLogs}
          />
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center gap-2 opacity-30">
          <Search className="size-7" />
          <p className="text-[10px] font-black uppercase tracking-widest">No matching history</p>
        </div>
      ) : (
        <>
          {/* ── MOBILE CARD VIEW (< md) ── */}
          <div className="md:hidden divide-y divide-border/40">
            {paginatedLogs.map((log) => {
              const status = getStatusConfig(log);
              return (
                <div key={log.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/10 active:bg-muted/20 transition-colors">
                  {/* Date block */}
                  <div className="shrink-0 w-12 h-12 rounded-md bg-primary/10 border border-primary/20 flex flex-col items-center justify-center">
                    <span className="text-[9px] font-black text-primary uppercase tracking-widest leading-none">
                      {new Date(log.date).toLocaleDateString('en-GB', { month: 'short' })}
                    </span>
                    <span className="text-lg font-black text-primary leading-none mt-0.5">
                      {new Date(log.date).getDate()}
                    </span>
                    <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none mt-0.5">
                      {new Date(log.date).toLocaleDateString('en-GB', { weekday: 'short' })}
                    </span>
                  </div>
                  {/* Times + Status */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Clock className="size-3 text-emerald-500" />
                        <span className="text-[11px] font-bold text-foreground tabular-nums">
                          {log.punchIn ? new Date(log.punchIn).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase() : "--:--"}
                        </span>
                      </div>
                      <span className="text-muted-foreground/40 text-xs">→</span>
                      <div className="flex items-center gap-1">
                        <Clock className="size-3 text-rose-500" />
                        <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
                          {log.punchOut ? new Date(log.punchOut).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase() : "--:--"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <div className={cn("size-1.5 rounded-full shrink-0", status.color, status.pulse && "animate-pulse")} />
                      <span className={cn("text-[9px] font-black uppercase tracking-widest", status.textColor)}>{status.text}</span>
                      {log.isAutoPunchOut && (
                        <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">Auto Out</span>
                      )}
                      {log.isOutsideOffice && (
                        <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-0.5">
                          <MapPin className="size-2.5" /> Remote
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── DESKTOP TABLE VIEW (md+) ── */}
          <div className="hidden md:block overflow-x-auto flex-1 border-t border-border/70">
            <div className="inline-block min-w-full align-middle">
              <Table className="min-w-[600px]">
                <TableHeader className="bg-muted/20">
                  <TableRow className="border-b border-border/70 hover:bg-transparent">
                    <TableHead className="py-3 px-5 font-black text-[10px] uppercase tracking-widest text-muted-foreground w-45 md:sticky md:left-0 md:bg-card md:z-20 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Date</TableHead>
                    <TableHead className="py-3 px-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground">Check In</TableHead>
                    <TableHead className="py-3 px-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground">Check Out</TableHead>
                    <TableHead className="py-3 px-5 font-black text-[10px] uppercase tracking-widest text-muted-foreground text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.map((log) => {
                    const status = getStatusConfig(log);
                    return (
                      <TableRow key={log.id} className="hover:bg-muted/20 transition-colors border-b border-border/40 group last:border-0">
                        <TableCell className="py-3 px-5 md:sticky md:left-0 md:bg-card md:group-hover:bg-muted/30 md:z-10 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                          <div className="flex items-center gap-2.5">
                            <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-colors">
                              <Calendar className="size-3.5" />
                            </div>
                            <span className="font-bold text-[11px] text-foreground">
                              {new Date(log.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <div className="flex items-center gap-1.5 tabular-nums">
                            <Clock className="size-3.5 text-emerald-500/80" />
                            <span className="text-[11px] font-bold text-foreground">
                              {log.punchIn ? new Date(log.punchIn).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase() : "--:--"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <div className="flex items-center gap-1.5 tabular-nums">
                            <Clock className="size-3.5 text-rose-500/80" />
                            <span className="text-[11px] font-bold text-muted-foreground">
                              {log.punchOut ? new Date(log.punchOut).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase() : "--:--"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-5 text-right">
                          <div className="flex justify-end items-center gap-1.5">
                            {log.isAutoPunchOut && (
                              <div className="px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[8px] font-bold uppercase border border-rose-500/20">Auto Out</div>
                            )}
                            {log.isOutsideOffice && (
                              <div className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[8px] font-bold uppercase border border-amber-500/20 flex items-center gap-0.5">
                                <MapPin className="size-2.5" /> Remote
                              </div>
                            )}
                            <div className={cn("size-1.5 rounded-full", status.color, status.pulse && "animate-pulse")} />
                            <span className={cn("text-[9px] font-black uppercase tracking-widest", status.textColor)}>{status.text}</span>
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
