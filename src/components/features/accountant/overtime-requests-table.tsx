"use client";

import { Table, TableBody, TableHeader, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Check, X, Timer, CalendarDays, Search, Trash2, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { processOvertimeStatus, cancelOvertimeRequest } from "@/actions/payroll/overtime";
import { useState, useMemo } from "react";
import { cn, getInitials } from "@/lib/utils";
import { ExportButton } from "@/components/ui/export-button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface OvertimeRecord {
  id: string;
  employeeName: string;
  department: string;
  avatarUrl?: string | null;
  date: string;
  hours: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

interface OvertimeRequestsTableProps {
  data: OvertimeRecord[];
  title?: string;
  subtitle?: string;
  role?: string;
}

export function OvertimeRequestsTable({ data: initialData, title = "Overtime Requests", subtitle = "Manage employee overtime requests", role }: OvertimeRequestsTableProps) {
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
      const result = await processOvertimeStatus(id, status);
      if (result.success) {
        toast.success(`Overtime request ${status.toLowerCase()} successfully`);
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

  const handleDelete = async (id: string) => {
    setProcessingId(id);
    try {
      const result = await cancelOvertimeRequest(id);
      if (result.success) {
        toast.success("Overtime record deleted successfully");
        setData(prev => prev.filter(item => item.id !== id));
      } else {
        toast.error(result.error || "Failed to delete overtime record");
      }
    } catch (error) {
      toast.error("An unexpected error occurred while deleting");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(row =>
      row.employeeName.toLowerCase().includes(term) ||
      row.reason.toLowerCase().includes(term)
    );
  }, [data, searchTerm]);

  return (
    <div className="border rounded-md mt-2">
      {/* Search & Statistics Bar */}
      <div className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/20 border-b border-border/70">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
          <Input
            placeholder="Search staff members or reasons..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 border-border/80 focus:ring-primary/20 transition-all rounded-md text-xs bg-background"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded-md transition-colors cursor-pointer"
            >
              <X className="size-3 text-muted-foreground/50" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-muted-foreground bg-background px-3 py-1.5 rounded-md border border-border/70">
            {filteredData.length} Requests
          </span>
          {filteredData.length > 0 && (
            <ExportButton
              filename={`overtime-requests-${new Date().toISOString().split('T')[0]}`}
              title="Overtime Requests Report"
              subtitle={`Generated on ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}${searchTerm ? ` · Filtered by: "${searchTerm}"` : ""}`}
              columns={[
                { header: "Employee", key: "employeeName" },
                { header: "Department", key: "department" },
                { header: "Date", key: "date" },
                { header: "Hours", key: "hours" },
                { header: "Reason", key: "reason" },
                { header: "Status", key: "status" },
              ]}
              rows={filteredData}
              label="Export Overtime"
            />
          )}
        </div>
      </div>

      {/* ── Mobile card view ── */}
      <div className="sm:hidden divide-y divide-border/40">
        {filteredData.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground font-medium">
            No overtime requests found
          </div>
        ) : (
          filteredData.map((req) => (
            <div key={req.id} className="p-4 hover:bg-muted/10 transition-colors space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="size-8 rounded-full shrink-0">
                    {req.avatarUrl && (
                      <AvatarImage src={req.avatarUrl} alt={req.employeeName} className="object-cover" />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center size-full">
                      {getInitials(req.employeeName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-xs text-foreground truncate" title={req.employeeName}>
                      {req.employeeName}
                    </span>
                    {req.department && (
                      <span className="text-[10px] text-muted-foreground truncate font-medium">
                        {req.department}
                      </span>
                    )}
                  </div>
                </div>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0",
                  req.status === "PENDING" && "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
                  req.status === "APPROVED" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                  req.status === "REJECTED" && "bg-rose-500/10 text-rose-600 border-rose-500/20"
                )}>
                  {req.status}
                </span>
              </div>

              <div className="flex items-center gap-4 bg-muted/20 rounded-md px-3 py-2 border border-border/50 text-xs">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 text-muted-foreground/60 shrink-0" />
                  <span className="font-semibold text-foreground/80">{req.date}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Timer className="size-3.5 text-primary shrink-0" />
                  <span className="font-bold text-primary">{req.hours} hrs</span>
                </div>
              </div>

              {req.reason && (
                <p className="text-xs text-muted-foreground italic line-clamp-2 leading-relaxed">"{req.reason}"</p>
              )}

              <div className="flex items-center gap-2 pt-1">
                {req.status === "PENDING" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={processingId === req.id}
                      onClick={() => handleAction(req.id, "APPROVED")}
                      className="flex-1 h-8 text-xs font-semibold rounded-md border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                    >
                      <Check className="size-3.5 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={processingId === req.id}
                      onClick={() => handleAction(req.id, "REJECTED")}
                      className="flex-1 h-8 text-xs font-semibold rounded-md border-rose-500/30 text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <X className="size-3.5 mr-1" /> Reject
                    </Button>
                  </>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={processingId === req.id}
                      className="h-8 px-3 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-500/30 rounded-md cursor-pointer transition-colors"
                      title="Delete Overtime Record"
                    >
                      {processingId === req.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4 text-rose-600" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-md border border-border/80 shadow-2xl max-w-sm">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-sm font-bold">Delete Overtime Record?</AlertDialogTitle>
                      <AlertDialogDescription className="text-xs text-muted-foreground">
                        Are you sure you want to delete this {req.status.toLowerCase()} overtime record for {req.employeeName} ({req.date}, {req.hours} hrs)? This will remove it from payroll calculations.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                      <AlertDialogCancel className="h-9 text-xs font-semibold rounded-md border-border/80">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(req.id)}
                        className="h-9 text-xs font-semibold rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Desktop Table ── */}
      <div className="hidden sm:block overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30 border-b border-border/70">
            <TableRow className="border-border/70 hover:bg-transparent">
              <TableHead className="py-3.5 px-5 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">Employee</TableHead>
              <TableHead className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">Date</TableHead>
              <TableHead className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">Hours</TableHead>
              <TableHead className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">Reason</TableHead>
              <TableHead className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">Status</TableHead>
              <TableHead className="py-3.5 px-5 text-right text-xs font-bold text-muted-foreground whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/40">
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground font-medium">
                  No overtime requests found
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="py-3 px-5">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8 rounded-full shrink-0">
                        {row.avatarUrl && <AvatarImage src={row.avatarUrl} alt={row.employeeName} className="object-cover" />}
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center size-full">
                          {getInitials(row.employeeName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-xs text-foreground truncate" title={row.employeeName}>{row.employeeName}</span>
                        {row.department && (
                          <span className="text-[10px] text-muted-foreground truncate font-medium mt-0.5">
                            {row.department}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <span className="text-xs font-medium text-muted-foreground">{row.date}</span>
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <span className="text-xs font-bold text-primary font-mono">{row.hours} hrs</span>
                  </TableCell>
                  <TableCell className="py-3 px-4 max-w-xs">
                    <span className="text-xs text-muted-foreground line-clamp-1 italic" title={row.reason}>
                      "{row.reason}"
                    </span>
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-md border inline-block whitespace-nowrap",
                      row.status === "PENDING" && "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
                      row.status === "APPROVED" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                      row.status === "REJECTED" && "bg-rose-500/10 text-rose-600 border-rose-500/20"
                    )}>
                      {row.status}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 px-5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.status === "PENDING" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={processingId === row.id}
                            onClick={() => handleAction(row.id, "APPROVED")}
                            className="h-8 px-2.5 text-xs font-semibold rounded-md border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                          >
                            {processingId === row.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Check className="size-3.5" />
                            )}
                            <span className="ml-1">Approve</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={processingId === row.id}
                            onClick={() => handleAction(row.id, "REJECTED")}
                            className="h-8 px-2.5 text-xs font-semibold rounded-md border-rose-500/30 text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                          >
                            {processingId === row.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <X className="size-3.5" />
                            )}
                            <span className="ml-1">Reject</span>
                          </Button>
                        </>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={processingId === row.id}
                            className="size-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-md cursor-pointer transition-colors"
                            title="Delete Overtime Record"
                          >
                            {processingId === row.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-md border border-border/80 shadow-2xl max-w-sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-sm font-bold">Delete Overtime Record?</AlertDialogTitle>
                            <AlertDialogDescription className="text-xs text-muted-foreground">
                              Are you sure you want to delete this {row.status.toLowerCase()} overtime record for {row.employeeName} ({row.date}, {row.hours} hrs)? This will remove it from payroll calculations.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel className="h-9 text-xs font-semibold rounded-md border-border/80">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(row.id)}
                              className="h-9 text-xs font-semibold rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
