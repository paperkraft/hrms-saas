"use client";

import { Table, TableBody, TableHeader, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Check, X, MapPin, CalendarDays, HelpCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { processAllowanceStatus } from "@/actions/payroll/allowance";
import { useState, useMemo } from "react";
import { cn, getInitials } from "@/lib/utils";
import { ExportButton } from "@/components/ui/export-button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AllowanceRecord {
  id: string;
  employeeName: string;
  department: string;
  avatarUrl?: string | null;
  fromDate: string;
  toDate: string;
  location: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

interface AllowanceRequestsTableProps {
  data: AllowanceRecord[];
  title?: string;
  subtitle?: string;
}

export function AllowanceRequestsTable({ data: initialData, title = "Allowance Requests", subtitle = "Manage off-site business meeting allowances" }: AllowanceRequestsTableProps) {
  const [data, setData] = useState(initialData);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Sync state if initialData changes
  if (initialData.length !== data.length && initialData !== data) {
    setData(initialData);
  }

  const handleAction = async (id: string, status: "APPROVED" | "REJECTED") => {
    setProcessingId(id);
    try {
      const result = await processAllowanceStatus(id, status);
      if (result.success) {
        toast.success(`Allowance request ${status.toLowerCase()} successfully`);
        setData(prev => prev.map(item => item.id === id ? { ...item, status } : item));
      } else {
        toast.error(result.error || "Failed to update status");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(row =>
      row.employeeName.toLowerCase().includes(term) ||
      row.location.toLowerCase().includes(term)
    );
  }, [data, searchTerm]);

  return (
    <div>
      {/* Search & Statistics Bar */}
      <div className="px-4 py-3 flex items-center justify-between gap-4 bg-muted/20 border-b border-border/70">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
          <Input
            placeholder="Search staff members or locations..."
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
            {filteredData.length} Requests
          </span>
          {filteredData.length > 0 && (
            <ExportButton
              filename={`allowance-requests-${new Date().toISOString().split('T')[0]}`}
              title="Allowance Requests Report"
              subtitle={`Generated on ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}${searchTerm ? ` · Filtered by: "${searchTerm}"` : ""}`}
              columns={[
                { header: "Employee", key: "employeeName" },
                { header: "Department", key: "department" },
                { header: "From Date", key: "fromDate" },
                { header: "To Date", key: "toDate" },
                { header: "Location", key: "location" },
                { header: "Status", key: "status" },
              ]}
              rows={filteredData}
              label="Export Allowances"
            />
          )}
        </div>
      </div>

      <div className="overflow-x-auto flex-1">
        <Table className="min-w-[800px]">
          <TableHeader className="bg-muted/5 border-b border-border/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-3 px-5 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 md:sticky md:left-0 md:bg-card md:z-20 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Employee</TableHead>
              <TableHead className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Travel Period</TableHead>
              <TableHead className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Location</TableHead>
              <TableHead className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Status</TableHead>
              <TableHead className="py-3 px-5 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/20">
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-[10px] text-muted-foreground/30 font-black uppercase tracking-widest">
                  No allowance requests found
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
                          {getInitials(req.employeeName)}
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
                        {req.fromDate === req.toDate ? req.fromDate : `${req.fromDate} — ${req.toDate}`}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <CalendarDays className="size-3 text-muted-foreground" />
                        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
                          Business Tour
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-primary" />
                      <span className="text-[11px] font-semibold text-foreground">{req.location}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border inline-block",
                      req.status === "PENDING" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                      req.status === "APPROVED" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                      req.status === "REJECTED" && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    )}>
                      {req.status}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 px-5 text-right">
                    {req.status === "PENDING" ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          disabled={processingId === req.id}
                          onClick={() => handleAction(req.id, "APPROVED")}
                          className="size-7 p-0 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors cursor-pointer"
                          title="Approve Request"
                        >
                          <Check className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          disabled={processingId === req.id}
                          onClick={() => handleAction(req.id, "REJECTED")}
                          className="size-7 p-0 bg-rose-600 hover:bg-rose-700 text-white rounded-md transition-colors cursor-pointer"
                          title="Reject Request"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                        Processed
                      </span>
                    )}
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
