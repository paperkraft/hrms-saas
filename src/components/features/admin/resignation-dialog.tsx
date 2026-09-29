"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserX, Loader2, CheckCircle2, ArrowRightLeft, AlertTriangle } from "lucide-react"
import { setUserEmploymentStatus } from "@/actions/user"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

const labelClass = "text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/80"
const inputClass = "h-8 w-full bg-muted border-border rounded-sm text-xs font-medium px-3 focus:ring-2 focus:ring-primary/10 focus:border-primary/40 transition-all outline-none"
const selectTriggerClass = "h-8 w-full bg-muted border-border rounded-sm text-xs font-medium px-3 focus:ring-2 focus:ring-primary/10 focus:border-primary/40 transition-all outline-none shadow-none"

interface ResignationDialogProps {
  user: {
    id: string
    name: string | null
    email: string
    status?: string
    resignationDate?: Date | string | null
    resignationReason?: string | null
  }
  activeUsers: { id: string; name: string | null; email: string }[]
}

export function ResignationDialog({ user, activeUsers }: ResignationDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [targetStatus, setTargetStatus] = useState<string>(
    user.status === "RESIGNED" ? "RESIGNED" : "RESIGNED"
  )
  const [resignationDate, setResignationDate] = useState<string>(
    user.resignationDate
      ? new Date(user.resignationDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  )
  const [resignationReason, setResignationReason] = useState<string>(
    user.resignationReason || ""
  )
  const [reassignTasksToId, setReassignTasksToId] = useState<string>("none")

  // Available target employees for task transfer (excluding this user)
  const candidateAssignees = activeUsers.filter((u) => u.id !== user.id)

  const [rejoiningDate, setRejoiningDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  )

  const isAlreadyInactive = user.status === "RESIGNED" || user.status === "INACTIVE" || user.status === "TERMINATED"

  async function handleStatusChange(statusToApply: string) {
    setLoading(true)
    try {
      const res = await setUserEmploymentStatus({
        userId: user.id,
        status: statusToApply as any,
        resignationDate: statusToApply !== "ACTIVE" && resignationDate ? new Date(resignationDate) : null,
        resignationReason: resignationReason.trim() || null,
        rejoiningDate: statusToApply === "ACTIVE" && rejoiningDate ? new Date(rejoiningDate) : null,
        reassignTasksToId: reassignTasksToId !== "none" ? reassignTasksToId : null,
      })

      if (res.success) {
        toast.success(
          statusToApply === "ACTIVE"
            ? `${user.name || "Employee"} reactivated successfully with rejoining date.`
            : `${user.name || "Employee"} marked as ${statusToApply.toLowerCase()}. All project, task, and document records preserved.`
        )
        setOpen(false)
      } else {
        toast.error(res.error || "Failed to update employee status")
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isAlreadyInactive ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 rounded-sm transition-all"
            title="Re-activate / Rehire Employee"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 rounded-sm transition-all"
            title="Deactivate / Mark as Resigned"
          >
            <UserX className="w-3.5 h-3.5" />
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="p-0 rounded-sm border border-border shadow-lg overflow-hidden w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader className="px-5 py-4 border-b border-border bg-muted/20">
          <DialogTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
            {isAlreadyInactive ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Rehire / Reactivate: {user.name}
              </>
            ) : (
              <>
                <UserX className="w-4 h-4 text-amber-600" />
                Deactivate / Mark Resigned
              </>
            )}
          </DialogTitle>
          <p className="text-[10px] text-muted-foreground font-medium">
            Manage employment status for {user.name || user.email}
          </p>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Safe retention banner */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-sm p-3 flex gap-2.5 items-start">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
              <span className="font-bold">Zero Data Loss:</span> Resigned employee data is safely retained. All tasks, project records, uploaded documents, attendance, and payroll records remain intact and accessible to administrators and project members.
            </div>
          </div>

          {isAlreadyInactive ? (
            <div className="space-y-4">
              <div className="p-3 bg-muted/40 rounded-sm border border-border/60 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Status:</span>
                  <span className="font-bold uppercase text-amber-600">{user.status}</span>
                </div>
                {user.resignationDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Previous Exit Date:</span>
                    <span className="font-medium">
                      {new Date(user.resignationDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
                {user.resignationReason && (
                  <div className="pt-1 text-[11px] text-muted-foreground">
                    <span className="font-medium">Departure Reason: </span>
                    {user.resignationReason}
                  </div>
                )}
              </div>

              {/* Rehire / Rejoining Date Field */}
              <div className="space-y-1.5 pt-1">
                <Label className={labelClass}>Rejoining / Rehire Date</Label>
                <Input
                  type="date"
                  value={rejoiningDate}
                  onChange={(e) => setRejoiningDate(e.target.value)}
                  className={inputClass}
                />
                <p className="text-[9px] text-muted-foreground">
                  Original joining date will be preserved, and current leave balance cycle will start from this date.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 h-9 text-xs font-bold uppercase tracking-widest rounded-sm"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => handleStatusChange("ACTIVE")}
                  className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold uppercase tracking-widest rounded-sm"
                >
                  {loading ? <Loader2 className="size-3.5 animate-spin" /> : "Confirm Rejoining"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <Label className={labelClass}>Select New Status</Label>
                <Select value={targetStatus} onValueChange={setTargetStatus}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm border border-border">
                    <SelectItem value="RESIGNED" className="text-xs">Resigned (Left Organization)</SelectItem>
                    <SelectItem value="INACTIVE" className="text-xs">Inactive (Temporarily Suspended - e.g. Maternity / Sabbatical)</SelectItem>
                    <SelectItem value="TERMINATED" className="text-xs">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>
                  {targetStatus === "INACTIVE"
                    ? "Suspension / Leave Start Date"
                    : targetStatus === "TERMINATED"
                    ? "Termination Date"
                    : "Resignation / Exit Date"}
                </Label>
                <Input
                  type="date"
                  value={resignationDate}
                  onChange={(e) => setResignationDate(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>
                  {targetStatus === "INACTIVE"
                    ? "Reason / Notes (e.g. Maternity Leave, Sabbatical, Medical)"
                    : "Reason / Departure Notes (Optional)"}
                </Label>
                <Input
                  placeholder={
                    targetStatus === "INACTIVE"
                      ? "e.g. Maternity leave, Medical sabbatical, Study leave"
                      : "e.g. Relocation, Notice period completed"
                  }
                  value={resignationReason}
                  onChange={(e) => setResignationReason(e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* Task Reassignment Option */}
              <div className="pt-2 border-t border-border/40 space-y-1.5">
                <Label className={labelClass + " flex items-center gap-1.5"}>
                  <ArrowRightLeft className="w-3 h-3 text-primary" />
                  Reassign Active Tasks To (Optional)
                </Label>
                <Select value={reassignTasksToId} onValueChange={setReassignTasksToId}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Keep tasks assigned as (Resigned)" />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm border border-border max-h-48">
                    <SelectItem value="none" className="text-xs">Keep tasks assigned to {user.name || "user"}</SelectItem>
                    {candidateAssignees.map((u) => (
                      <SelectItem key={u.id} value={u.id} className="text-xs">
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[9px] text-muted-foreground">
                  If selected, all open & in-progress tasks will be transferred to this employee.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-border/30">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 h-9 text-xs font-bold uppercase tracking-widest rounded-sm"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => handleStatusChange(targetStatus)}
                  className="flex-1 h-9 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold uppercase tracking-widest rounded-sm"
                >
                  {loading ? <Loader2 className="size-3.5 animate-spin" /> : "Confirm Deactivation"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
