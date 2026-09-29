"use client"

import { useState, useRef } from "react"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Label,
  Textarea
} from "@/components/ui"
import { MoreHorizontal, CheckCircle2, XCircle, PlayCircle, PauseCircle, CheckSquare, Trash2, Eye, Edit } from "lucide-react"
import { updateTask, approveTask, deleteTask } from "@/actions/projects/tasks"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { usePermissions } from "@/hooks/use-permissions"
import { canManageTask, isExternalUser } from "@/lib/permissions"
import { EditTaskDialog } from "./edit-task-dialog"

export function TaskRowActions({
  task,
  members = [],
  allMembers = []
}: {
  task: any;
  isAdmin?: boolean;
  isTL?: boolean;
  userDepartment?: string;
  currentUserId?: string;
  isAssigned?: boolean;
  members?: any[];
  allMembers?: any[];
}) {
  const router = useRouter()
  const { data: session } = useSession()
  const { isAdmin, isTL } = usePermissions()
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [approvalComment, setApprovalComment] = useState("")

  const {
    hasAuthority,
    canApprove,
    canRejectReview,
    canReject,
    canEditDelete,
    isAssigned,
    isDone,
    activeApprovalStage
  } = canManageTask(session?.user as any, task, members)

  async function handleStatusChange(newStatus: string) {
    setOpen(false)
    if (!isAssigned && !hasAuthority) {
      toast.error("Authority Required: Only the task assignee, TL, or Admin can change the status.")
      return
    }

    // Force approval flow for COMPLETED
    if (newStatus === "COMPLETED") {
      toast.error("Process Required: Please use the Approve button for finalization.")
      return
    }

    setLoading(true)
    const result = await updateTask(task.id, { status: newStatus })
    setLoading(false)
    if (result.success) {
      toast.success(`Task status updated to ${newStatus}`)
      router.refresh()
    } else {
      toast.error(result.error || "Failed to update task")
    }
  }

  async function handleApproval(status: "APPROVED" | "REJECTED", reason?: string) {
    setOpen(false)
    if (status === "REJECTED" && !reason) {
      setShowRejectDialog(true)
      return
    }

    setLoading(true)
    const result = await approveTask(task.id, status, reason)
    setLoading(false)
    if (result.success) {
      toast.success(`Task ${status.toLowerCase()} successfully`)
      setShowRejectDialog(false)
      setShowApproveDialog(false)
      setRejectionReason("")
      setApprovalComment("")
      router.refresh()
    } else {
      toast.error(result.error || "Failed to update approval")
    }
  }

  async function handleDelete() {
    setLoading(true)
    const result = await deleteTask(task.id)
    setLoading(false)
    if (result.success) {
      toast.success("Task deleted successfully")
      router.refresh()
    } else {
      toast.error(result.error || "Failed to delete task")
    }
  }

  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const isScrollingRef = useRef(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    isScrollingRef.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - touchStartRef.current.x)
    const dy = Math.abs(touch.clientY - touchStartRef.current.y)
    if (dx > 8 || dy > 8) {
      isScrollingRef.current = true
    }
  }

  if (!isAdmin && !isTL && !isAssigned) return null

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={loading}
            className="h-8 w-8 p-0"
            onPointerDownCapture={(e) => {
              // Prevents Radix UI's pointerdown handler from triggering,
              // which would open the dropdown immediately on touch start and block scrolling.
              if (e.pointerType === "touch") {
                e.stopPropagation()
              }
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onClick={(e) => {
              e.stopPropagation()
              if (isScrollingRef.current) return
              setOpen((prev) => !prev)
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[160px]">
          {isAssigned && task.status !== "COMPLETED" && (!task.lifecycleStatus || task.lifecycleStatus === "COMMITTED") && (
            <>
              {(task.status === "TODO" || task.status === "IN_REVIEW" || task.status === "ON_HOLD") && (
                <DropdownMenuItem onClick={() => handleStatusChange("IN_PROGRESS")}>
                  <PlayCircle className="mr-2 h-4 w-4 text-blue-500" />
                  {task.status === "ON_HOLD" ? "Resume Task" : "Start Task"}
                </DropdownMenuItem>
              )}
              {task.status === "IN_PROGRESS" && (
                <>
                  <DropdownMenuItem onClick={() => handleStatusChange("IN_REVIEW")}>
                    <Eye className="mr-2 h-4 w-4 text-orange-500" />
                    Mark Review
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange("ON_HOLD")}>
                    <PauseCircle className="mr-2 h-4 w-4 text-amber-500" />
                    Put On Hold
                  </DropdownMenuItem>
                </>
              )}
            </>
          )}

          {/* Admin/TL Privileges */}
          {hasAuthority && (
            <>
              {canEditDelete && (
                <DropdownMenuItem onClick={() => {
                  setOpen(false)
                  setShowEditDialog(true)
                }}>
                  <Edit className="mr-2 h-4 w-4 text-blue-500" />
                  Edit Task
                </DropdownMenuItem>
              )}

              {canApprove && (
                <DropdownMenuItem onClick={() => {
                  setOpen(false)
                  setShowApproveDialog(true)
                }}>
                  <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                  {activeApprovalStage === "SUB_TL"
                    ? (task.reviewerId ? "Approve (Reviewer)" : "Approve (Sub-TL)")
                    : activeApprovalStage === "TL"
                      ? "Approve (TL)"
                      : "Final Admin Approve"
                  }
                </DropdownMenuItem>
              )}

              {canReject && (
                <DropdownMenuItem onClick={() => {
                  setOpen(false)
                  setShowRejectDialog(true)
                }}>
                  <XCircle className="mr-2 h-4 w-4 text-rose-600" />
                  {isDone ? "Re-open/Reject" : "Reject"}
                </DropdownMenuItem>
              )}

              {canEditDelete && (
                <DropdownMenuItem
                  onClick={() => {
                    setOpen(false)
                    setShowDeleteAlert(true)
                  }}
                  className="text-rose-600 focus:text-rose-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Task
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Task Dialog */}
      {hasAuthority && (
        <EditTaskDialog
          task={task}
          isTLorAdmin={!!(isAdmin || isTL)}
          members={members}
          allMembers={allMembers}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          isExternal={isExternalUser(session?.user as any)}
        />
      )}

      {/* Approval Context Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={(open) => {
        setShowApproveDialog(open)
        if (!open) setApprovalComment("")
      }}>
        <DialogContent className="p-0 rounded-sm border-border shadow-lg overflow-hidden sm:max-w-[425px] gap-0">
          <DialogHeader className="px-5 py-4 border-b border-border/40 bg-emerald-50/50 dark:bg-emerald-950/20">
            <DialogTitle className="text-sm font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
              {activeApprovalStage === "SUB_TL"
                ? (task.reviewerId ? "Reviewer Task Approval" : "Sub-TL Task Approval")
                : activeApprovalStage === "TL"
                  ? "Team Leader Task Approval"
                  : "Final Admin Task Approval"
              }
            </DialogTitle>
            <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 font-bold tracking-widest uppercase">
              Add optional remarks for the project timeline
            </p>
          </DialogHeader>

          <div className="p-5">
            <div className="space-y-3">
              <Label htmlFor="approve-comment" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                Approval Remarks (Optional)
              </Label>
              <Textarea
                id="approve-comment"
                placeholder="Good work! The deliverables look solid..."
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                className="min-h-[100px] text-xs font-medium p-3 bg-muted/5 border-border rounded-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500/40 transition-all outline-none placeholder:text-muted-foreground/40 resize-none shadow-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end px-5 py-3 border-t border-border/40 bg-muted/10 gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowApproveDialog(false)}
              className="h-8 px-4 text-[10px] font-bold uppercase tracking-widest rounded-sm"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={loading}
              onClick={() => handleApproval("APPROVED", approvalComment)}
              className="h-8 px-6 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-sm shadow-none border-0"
            >
              {loading
                ? "Processing..."
                : activeApprovalStage === "SUB_TL"
                  ? (task.reviewerId ? "Confirm Reviewer Approval" : "Confirm Sub-TL Approval")
                  : activeApprovalStage === "TL"
                    ? "Confirm TL Approval"
                    : "Confirm Admin Approval"
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejection Feedback Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={(open) => {
        setShowRejectDialog(open)
        if (!open) setRejectionReason("")
      }}>
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          className="p-0 rounded-sm border-border shadow-lg overflow-hidden sm:max-w-[425px] gap-0"
        >
          <DialogHeader className="px-5 py-4 border-b border-border/40 bg-rose-50/50 dark:bg-rose-950/20">
            <DialogTitle className="text-sm font-bold tracking-tight text-rose-700 dark:text-rose-400">Reject Task Validation</DialogTitle>
            <p className="text-[10px] text-rose-600/70 dark:text-rose-400/70 font-bold tracking-widest uppercase">
              Provide actionable feedback for the assignee
            </p>
          </DialogHeader>

          <div className="p-5">
            <div className="space-y-3">
              <Label htmlFor="reason" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                Reason for Rejection <span className="text-rose-600">*</span>
              </Label>
              <Textarea
                id="reason"
                placeholder="Explain what needs to be fixed..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[120px] text-xs font-medium p-3 bg-muted/5 border-border rounded-sm focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500/40 transition-all outline-none placeholder:text-muted-foreground/40 resize-none shadow-none"
              />
              <p className="text-[10px] text-muted-foreground/60 font-medium italic">
                This feedback will be automatically posted as an official comment on the task.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end px-5 py-3 border-t border-border/40 bg-muted/10 gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRejectDialog(false)}
              className="h-8 px-4 text-[10px] font-bold uppercase tracking-widest rounded-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={loading || !rejectionReason.trim()}
              onClick={() => handleApproval("REJECTED", rejectionReason)}
              className="h-8 px-6 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-widest rounded-sm shadow-none border-0"
            >
              {loading ? "Processing..." : "Submit Rejection"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent className="rounded-sm border-border shadow-lg sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold tracking-tight">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This will permanently remove the task <span className="font-bold text-foreground">"{task.name}"</span> and all its associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              className="h-8 rounded-sm text-[10px] font-black uppercase tracking-widest"
              onClick={() => setShowDeleteAlert(false)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-8 rounded-sm bg-rose-600 hover:bg-rose-700 text-[10px] font-black uppercase tracking-widest text-white border-0"
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={loading}
            >
              {loading ? "Processing..." : "Delete Task"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

