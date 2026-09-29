"use client";

import { useState, useMemo } from "react";
import { Table, TableBody, TableHeader, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { CheckCircle2, Search, X } from "lucide-react";
import { CancelLeaveButton } from "@/components/features/leave/cancel-leave-button";
import { cn, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ExportButton } from "@/components/ui/export-button";
import { Input } from "@/components/ui/input";

interface ApprovalRecord {
  id: string;
  employeeName: string;
  department: string;
  avatarUrl?: string | null;
  startDate: string;
  endDate: string;
  category: string;
  duration: string;
  halfDayType?: string | null;
  leaveType?: string;
  reason?: string;
  systemNote?: string;
  updatedAt: string | Date;
}

interface RecentApprovalsTableProps {
  data: ApprovalRecord[];
  title?: string;
  subtitle?: string;
}

export function RecentApprovalsTable({ data, title = "Recent Approvals", subtitle = "Recent valid departures" }: RecentApprovalsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(row =>
      row.employeeName.toLowerCase().includes(term)
    );
  }, [data, searchTerm]);

  return (
    <div>
      {/* Search & Statistics Bar */}
      <div className="px-4 py-3 flex items-center justify-between gap-4 bg-muted/20 border-b border-border/70">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
          <Input
            placeholder="Search staff members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-8 border-border/70 focus:ring-primary/20 transition-all rounded-md text-xs bg-background"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded-md transition-colors"
            >
              <X className="size-3 text-muted-foreground/50" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs font-semibold text-muted-foreground px-2 py-0.5 rounded-md border border-border/60 bg-background">
            {filteredData.length} Records
          </span>
          {filteredData.length > 0 && (
            <ExportButton
              filename={`approved-leaves-${new Date().toISOString().split('T')[0]}`}
              title="Approved Leaves History"
              subtitle={`Generated on ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}${searchTerm ? ` · Filtered by: "${searchTerm}"` : ""}`}
              columns={[
                { header: "Employee", key: "employeeName" },
                { header: "Department", key: "department" },
                { header: "Start Date", key: "startDate" },
                { header: "End Date", key: "endDate" },
                { header: "Category", key: "category", format: (v: any) => v.replace(/_/g, ' ') },
                { header: "Duration", key: "duration" },
                { header: "Type", key: "leaveType", format: (v: any) => v || 'General' },
                { header: "Reason", key: "reason" },
              ]}
              rows={filteredData}
              label="Export History"
            />
          )}
        </div>
      </div>
      <div className="overflow-x-auto flex-1">
        <Table className="min-w-[800px]">
          <TableHeader className="bg-muted/5 border-b border-border/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-3 px-5 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 md:sticky md:left-0 md:bg-card md:z-20 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Employee</TableHead>
              <TableHead className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Period</TableHead>
              <TableHead className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Branch</TableHead>
              <TableHead className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Reason</TableHead>
              <TableHead className="py-3 px-5 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/20">
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-[10px] text-muted-foreground/30 font-black uppercase tracking-widest">
                  No approved records found
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((req) => (
                <TableRow key={req.id} className="hover:bg-muted/30 transition-colors group">
                  <TableCell className="py-3 px-5 md:sticky md:left-0 md:bg-card md:group-hover:bg-muted md:z-10 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8 rounded-full shrink-0">
                        {req.avatarUrl && (
                          <AvatarImage src={req.avatarUrl} alt={req.employeeName} className="object-cover rounded-full" />
                        )}
                        <AvatarFallback className="bg-muted text-muted-foreground font-bold text-[9px] group-hover:bg-primary/10 group-hover:text-primary transition-colors flex items-center justify-center size-full rounded-full">
                          {getInitials(req.employeeName || '')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-[11px] text-foreground truncate max-w-35 leading-tight" title={req.employeeName}>
                          {req.employeeName}
                        </span>
                        {req.department && (
                          <span className="text-[9px] text-muted-foreground truncate">
                            {req.department}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-foreground leading-none">
                        {req.startDate === req.endDate ? req.startDate : `${req.startDate} — ${req.endDate}`}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
                          {req.duration} SESSION
                        </span>
                        {req.duration === "HALF" && req.halfDayType && (
                          <span className={cn(
                            "text-[8px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded-md border",
                            req.halfDayType === "FIRST_HALF" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          )}>
                            {req.halfDayType === "FIRST_HALF" ? "1st Half" : "2nd Half"}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-foreground uppercase tracking-tight">
                        {req.category.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-semibold uppercase">{req.leaveType || 'General'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <span className="text-[10px] font-bold text-muted-foreground/60 line-clamp-2 max-w-[200px]" title={req.reason || "No reason provided"}>
                      {req.reason || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 px-5 text-right">
                    <div className="transition-opacity">
                      <CancelLeaveButton requestId={req.id} employeeName={req.employeeName} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
