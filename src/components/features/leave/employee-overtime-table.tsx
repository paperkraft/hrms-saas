"use client";

import { Table, TableBody, TableHeader, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Timer, CalendarDays, Search, Trash2, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ExportButton } from "@/components/ui/export-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { cancelOvertimeRequest } from "@/actions/payroll/overtime";
import { toast } from "sonner";

interface OvertimeRecord {
  id: string;
  date: string;
  hours: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

interface EmployeeOvertimeTableProps {
  data: OvertimeRecord[];
}

export function EmployeeOvertimeTable({ data: initialData }: EmployeeOvertimeTableProps) {
  const [data, setData] = useState(initialData);
  const [searchTerm, setSearchTerm] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  if (initialData.length !== data.length && initialData !== data) {
    setData(initialData);
  }

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      const result = await cancelOvertimeRequest(id);
      if (result.success) {
        toast.success("Overtime request cancelled successfully");
        setData((prev) => prev.filter((item) => item.id !== id));
      } else {
        toast.error(result.error || "Failed to cancel overtime request");
      }
    } catch {
      toast.error("An unexpected error occurred while cancelling");
    } finally {
      setCancellingId(null);
    }
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(row => row.reason.toLowerCase().includes(term));
  }, [data, searchTerm]);

  return (
    <div className="bg-card border-0 overflow-hidden h-full flex flex-col">
      <div className="px-5 py-3.5 flex items-center justify-between gap-4 bg-muted/10 border-b border-border/70">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/40" />
          <Input
            placeholder="Search reasons..."
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
              filename={`my-overtime-${new Date().toISOString().split('T')[0]}`}
              title="My Overtime Requests"
              subtitle={`Generated on ${new Date().toLocaleDateString("en-GB")}`}
              columns={[
                { header: "Date", key: "date" },
                { header: "Hours", key: "hours" },
                { header: "Reason", key: "reason" },
                { header: "Status", key: "status" },
              ]}
              rows={filteredData}
              label="Export"
            />
          )}
        </div>
      </div>

      <div className="md:hidden divide-y divide-border/40">
        {filteredData.length === 0 ? (
          <div className="py-12 text-center text-[10px] text-muted-foreground/40 font-black uppercase tracking-widest">
            No overtime requests found
          </div>
        ) : (
          filteredData.map((req) => (
            <div key={req.id} className="px-4 py-3.5 hover:bg-muted/10 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 shrink-0 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <CalendarDays className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-foreground leading-none">{req.date}</p>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight mt-0.5">Overtime Log</p>
                  </div>
                </div>
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border",
                  req.status === "PENDING" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                  req.status === "APPROVED" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                  req.status === "REJECTED" && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                )}>
                  {req.status}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-2">
                <div className="flex items-center gap-1.5 text-foreground text-[11px] font-bold">
                  <Timer className="size-3.5 text-primary" />
                  {req.hours} hrs
                </div>
                {req.status === "PENDING" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={cancellingId === req.id}
                        className="h-6 px-2 text-[9px] font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 uppercase tracking-wider rounded-md cursor-pointer"
                      >
                        {cancellingId === req.id ? (
                          <Loader2 className="size-3 animate-spin mr-1" />
                        ) : (
                          <Trash2 className="size-3 mr-1" />
                        )}
                        Cancel
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-md border-border/80 shadow-2xl max-w-sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-sm font-bold">Cancel Overtime Request?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-muted-foreground">
                          Are you sure you want to cancel your overtime request for {req.date} ({req.hours} hrs)?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="h-8 text-xs font-semibold rounded-md">Keep</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleCancel(req.id)}
                          className="h-8 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-md cursor-pointer"
                        >
                          Cancel Request
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              {req.reason && (
                <p className="text-[10px] text-muted-foreground italic line-clamp-2 mt-2">{req.reason}</p>
              )}
            </div>
          ))
        )}
      </div>

      <div className="hidden md:block overflow-x-auto flex-1 border-t border-border/70">
        <Table className="min-w-[600px]">
          <TableHeader className="bg-muted/20 border-b border-border/70">
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground md:sticky md:left-0 md:bg-card md:z-20 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Date</TableHead>
              <TableHead className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">Hours</TableHead>
              <TableHead className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reason</TableHead>
              <TableHead className="py-3 px-4 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</TableHead>
              <TableHead className="py-3 px-5 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/40">
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-[10px] text-muted-foreground/40 font-black uppercase tracking-widest">
                  No overtime requests found
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((req) => (
                <TableRow key={req.id} className="hover:bg-muted/20 transition-colors group">
                  <TableCell className="py-3 px-4 md:sticky md:left-0 md:bg-card md:group-hover:bg-muted/30 md:z-10 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-foreground leading-none">
                        {req.date}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <CalendarDays className="size-3 text-muted-foreground/40" />
                        <span className="text-[9px] text-muted-foreground font-semibold uppercase">
                          Overtime Log
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <Timer className="size-3.5 text-primary" />
                      <span className="text-[11px] font-bold text-foreground">{req.hours} hrs</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <span className="text-[11px] text-muted-foreground line-clamp-1" title={req.reason}>
                      {req.reason}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 px-4 text-center">
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border inline-block",
                      req.status === "PENDING" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                      req.status === "APPROVED" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                      req.status === "REJECTED" && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    )}>
                      {req.status}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 px-5 text-right">
                    {req.status === "PENDING" ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={cancellingId === req.id}
                            className="h-7 px-2 text-[10px] font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 uppercase tracking-wider rounded-md transition-colors cursor-pointer"
                          >
                            {cancellingId === req.id ? (
                              <Loader2 className="size-3 animate-spin mr-1" />
                            ) : (
                              <Trash2 className="size-3 mr-1" />
                            )}
                            Cancel
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-md border-border/80 shadow-2xl max-w-md">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-sm font-bold">Cancel Overtime Request?</AlertDialogTitle>
                            <AlertDialogDescription className="text-xs text-muted-foreground">
                              Are you sure you want to cancel your overtime request for {req.date} ({req.hours} hrs)? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="h-8 text-xs font-semibold rounded-md">Keep</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleCancel(req.id)}
                              className="h-8 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-md cursor-pointer"
                            >
                              Cancel Request
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40">—</span>
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

