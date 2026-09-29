"use client";

import { Table, TableBody, TableHeader, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Search, MapPin, Receipt, CalendarDays } from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ExportButton } from "@/components/ui/export-button";
import { Input } from "@/components/ui/input";

interface AllowanceRecord {
  id: string;
  fromDate: string;
  toDate: string;
  location: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

interface EmployeeAllowanceTableProps {
  data: AllowanceRecord[];
}

export function EmployeeAllowanceTable({ data: initialData }: EmployeeAllowanceTableProps) {
  const [data, setData] = useState(initialData);
  const [searchTerm, setSearchTerm] = useState("");

  if (initialData.length !== data.length && initialData !== data) {
    setData(initialData);
  }

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(row => row.location.toLowerCase().includes(term));
  }, [data, searchTerm]);

  return (
    <div className="bg-card border-0 overflow-hidden h-full flex flex-col">
      <div className="px-5 py-3.5 flex items-center justify-between gap-4 bg-muted/10 border-b border-border/70">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/40" />
          <Input
            placeholder="Search by location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-8 border-border/80 focus:ring-primary/20 transition-all rounded-md text-xs bg-muted/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-2 py-0.5 rounded-md border border-border/70 bg-muted/20">
            {filteredData.length} Requests
          </span>
          {filteredData.length > 0 && (
            <ExportButton
              filename={`my-allowances-${new Date().toISOString().split('T')[0]}`}
              title="My Allowance Requests"
              subtitle={`Generated on ${new Date().toLocaleDateString("en-GB")}`}
              columns={[
                { header: "From Date", key: "fromDate" },
                { header: "To Date", key: "toDate" },
                { header: "Location", key: "location" },
                { header: "Status", key: "status" },
              ]}
              rows={filteredData}
              label="Export"
            />
          )}
        </div>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden divide-y divide-border/40">
        {filteredData.length === 0 ? (
          <div className="py-12 text-center text-[10px] text-muted-foreground/40 font-black uppercase tracking-widest">
            No allowance requests found
          </div>
        ) : (
          filteredData.map((req) => (
            <div key={req.id} className="px-4 py-3.5 hover:bg-muted/10 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 shrink-0 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Receipt className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-foreground leading-none">{req.fromDate}</p>
                    {req.fromDate !== req.toDate && (
                      <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight mt-0.5">
                        — {req.toDate}
                      </p>
                    )}
                  </div>
                </div>
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0",
                  req.status === "PENDING" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                  req.status === "APPROVED" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                  req.status === "REJECTED" && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                )}>
                  {req.status}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <MapPin className="size-3.5 text-muted-foreground/50" />
                <span className="text-[11px] font-bold text-foreground">{req.location}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto flex-1 border-t border-border/70">
        <Table className="min-w-[600px]">
          <TableHeader className="bg-muted/20 border-b border-border/70">
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground md:sticky md:left-0 md:bg-card md:z-20 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">From Date</TableHead>
              <TableHead className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">To Date</TableHead>
              <TableHead className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">Location</TableHead>
              <TableHead className="py-3 px-5 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/40">
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-[10px] text-muted-foreground/40 font-black uppercase tracking-widest">
                  No allowance requests found
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((req) => (
                <TableRow key={req.id} className="hover:bg-muted/20 transition-colors group">
                  <TableCell className="py-3 px-4 md:sticky md:left-0 md:bg-card md:group-hover:bg-muted/30 md:z-10 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5 text-primary" />
                      <span className="text-[11px] font-bold text-foreground">{req.fromDate}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <span className="text-[11px] font-bold text-foreground">{req.toDate}</span>
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-muted-foreground/50" />
                      <span className="text-[11px] font-bold text-foreground">{req.location}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 px-5 text-right">
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border",
                      req.status === "PENDING" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                      req.status === "APPROVED" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                      req.status === "REJECTED" && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    )}>
                      {req.status}
                    </span>
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
