"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { approveGrievance, rejectGrievance } from "@/actions/attendance/grievance";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
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

export function GrievanceReviewTable({ data }: { data: any[] }) {
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const handleApprove = async (id: string, requestedTime: string) => {
    setIsProcessing(id);
    try {
      const res = await approveGrievance(id, requestedTime);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to approve");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt("Rejection reason (optional):");
    if (reason === null) return; // User cancelled

    setIsProcessing(id);
    try {
      const res = await rejectGrievance(id, reason);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to reject");
    } finally {
      setIsProcessing(null);
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center">
        <Clock className="size-8 text-muted-foreground/30 mb-3" />
        <h3 className="text-sm font-bold text-foreground tracking-tight mb-1">No Pending Grievances</h3>
        <p className="text-xs text-muted-foreground font-medium max-w-[240px]">All attendance disputes have been resolved</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
          <TableHeader className="bg-muted/30 border-b border-border/70">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[250px] py-3.5 px-5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Employee</TableHead>
              <TableHead className="py-3.5 px-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Type</TableHead>
              <TableHead className="py-3.5 px-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Date & Time</TableHead>
              <TableHead className="py-3.5 px-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Reason</TableHead>
              <TableHead className="py-3.5 px-5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status / Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/40">
            {data.map((req) => (
              <TableRow key={req.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="py-3 px-5">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8 rounded-full shrink-0">
                      <AvatarImage src={req.user.avatarUrl || ""} className="object-cover rounded-full" />
                      <AvatarFallback className="bg-muted text-muted-foreground font-bold text-[9px] group-hover:bg-primary/10 group-hover:text-primary transition-colors flex items-center justify-center size-full rounded-full">
                        {req.user.name?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-[11px] text-foreground truncate max-w-35 leading-tight" title={req.user.name}>
                        {req.user.name}
                      </span>
                      <span className="text-[9px] text-muted-foreground truncate">
                        {req.user.employeeCode || req.user.email}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-3 px-4">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border inline-block whitespace-nowrap",
                    req.grievanceType === 'FORGOT_PUNCH_IN' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
                      req.grievanceType === 'FORGOT_PUNCH_OUT' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                        req.grievanceType === 'FORGOT_BOTH' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' :
                          'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
                  )}>
                    {req.grievanceType.replace(/_/g, ' ')}
                  </span>
                </TableCell>
                <TableCell className="py-3 px-4">
                  <p className="text-xs font-semibold text-foreground">{format(new Date(req.date), "dd MMM yyyy")}</p>
                  <p className="text-[10px] font-bold text-primary mt-0.5">Req Time: {formatTime12hr(req.requestedTime)}</p>
                  {req.grievanceType === 'FORGOT_BOTH' && req.requestedOutTime && (
                    <p className="text-[10px] font-bold text-primary mt-0.5">Out Time: {formatTime12hr(req.requestedOutTime)}</p>
                  )}
                </TableCell>
                <TableCell className="py-3 px-4">
                  <p className="text-xs text-muted-foreground max-w-[200px] truncate italic" title={req.reason}>"{req.reason}"</p>
                </TableCell>
                <TableCell className="py-3 px-5 text-right">
                  {req.status === 'PENDING' ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs font-semibold rounded-md border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                        disabled={isProcessing === req.id}
                        onClick={() => handleApprove(req.id, req.requestedTime)}
                      >
                        <CheckCircle2 className="size-3.5 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs font-semibold rounded-md border-rose-500/30 text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                        disabled={isProcessing === req.id}
                        onClick={() => handleReject(req.id)}
                      >
                        <XCircle className="size-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  ) : (
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border inline-block whitespace-nowrap",
                      req.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                        req.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' :
                          'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    )}>
                      {req.status}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
  );
}
