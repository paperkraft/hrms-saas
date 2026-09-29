"use client"

import { useState, useTransition } from "react"
import { respondToTask, acceptNegotiation } from "@/actions/commitments/responses"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  CheckCircle2, AlertTriangle, ArrowLeftRight, Clock, Loader2,
  ChevronRight, Briefcase, Calendar, Zap, MessageSquare, X
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import { cn } from "@/lib/utils"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Button, Textarea, Label, Select, SelectContent,
  SelectItem, SelectTrigger, SelectValue, Calendar as CalendarUI,
  Popover, PopoverContent, PopoverTrigger
} from "@/components/ui"
import { CalendarIcon } from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface PendingTask {
  id: string
  name: string
  description?: string | null
  priority: string
  plannedStart?: Date | null
  plannedEnd?: Date | null
  plannedDuration?: number | null
  lifecycleStatus: string
  proposedAt?: Date | null
  negotiationCount: number
  project: { id: string; name: string }
  proposedBy?: { id: string; name: string | null; avatarUrl?: string | null } | null
  creator?: { id: string; name: string | null } | null
  comments?: any[]
}

interface WorkloadSummary {
  activeTasks: number
  committedTasks: number
  estimatedHours: number
  capacityPct: number
  overdueTasks: number
}

interface TaskInboxProps {
  pendingTasks: PendingTask[]
  workload: WorkloadSummary
}

// ── Priority display helpers ──────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  LOW:    { label: "Low",    className: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  MEDIUM: { label: "Medium", className: "text-amber-600 bg-amber-50 border-amber-200" },
  HIGH:   { label: "High",   className: "text-orange-600 bg-orange-50 border-orange-200" },
  URGENT: { label: "Urgent", className: "text-rose-600 bg-rose-50 border-rose-200" }
}

const REASSIGNMENT_REASONS = [
  { value: "CAPACITY_OVERLOAD",    label: "Already at capacity" },
  { value: "MISSING_DEPENDENCY",   label: "Missing access / dependency" },
  { value: "SKILL_MISMATCH",       label: "Skill / domain mismatch" },
  { value: "LEAVE_CONFLICT",       label: "Approved leave conflict" },
  { value: "OTHER",                label: "Other (explain below)" }
]

// ── Workload Bar ───────────────────────────────────────────────────────────────

function WorkloadBar({ pct }: { pct: number }) {
  const color =
    pct <= 75  ? "bg-emerald-500" :
    pct <= 90  ? "bg-amber-500"   :
    pct <= 110 ? "bg-orange-500"  : "bg-rose-500"

  const label =
    pct <= 75  ? "Healthy"   :
    pct <= 90  ? "Moderate"  :
    pct <= 110 ? "High"      : "Overloaded"

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={cn(
        "text-[9px] font-black uppercase tracking-widest shrink-0",
        pct <= 75 ? "text-emerald-600" :
        pct <= 90 ? "text-amber-600"   :
        pct <= 110 ? "text-orange-600" : "text-rose-600"
      )}>
        {pct}% · {label}
      </span>
    </div>
  )
}

// ── Response Modal ─────────────────────────────────────────────────────────────

type ResponseAction = "ACCEPT" | "WORKLOAD_CONCERN" | "REQUEST_REASSIGNMENT"

interface ResponseModalProps {
  task: PendingTask
  action: ResponseAction
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

function ResponseModal({ task, action, open, onClose, onSuccess }: ResponseModalProps) {
  const [comment, setComment] = useState("")
  const [reason, setReason] = useState("")
  const [proposedEnd, setProposedEnd] = useState<Date | undefined>()
  const [isPending, startTransition] = useTransition()

  const isAccept = action === "ACCEPT"
  const isConcern = action === "WORKLOAD_CONCERN"
  const isReassign = action === "REQUEST_REASSIGNMENT"

  const config = {
    ACCEPT: {
      title: "Accept Task",
      subtitle: "Add a brief note on how you'll approach this.",
      placeholder: "e.g. Will start tomorrow after the client call, or Need API access first...",
      icon: <CheckCircle2 className="size-4 text-emerald-600" />,
      btnClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
      btnLabel: "Accept Task"
    },
    WORKLOAD_CONCERN: {
      title: "Raise Workload Concern",
      subtitle: "Explain the concern. You can also propose a revised deadline.",
      placeholder: "e.g. Current sprint is full, can we push deadline by 3 days? Have a critical handoff this week...",
      icon: <AlertTriangle className="size-4 text-amber-600" />,
      btnClass: "bg-amber-600 hover:bg-amber-700 text-white",
      btnLabel: "Submit Concern"
    },
    REQUEST_REASSIGNMENT: {
      title: "Request Reassignment",
      subtitle: "Select a reason and explain. Your manager will review and decide.",
      placeholder: "e.g. Currently at 120% capacity with 2 overdue tasks in critical state...",
      icon: <ArrowLeftRight className="size-4 text-rose-600" />,
      btnClass: "bg-rose-600 hover:bg-rose-700 text-white",
      btnLabel: "Send Request"
    }
  }[action]

  const canSubmit = comment.trim().length >= 10 && (!isReassign || reason)

  function handleSubmit() {
    startTransition(async () => {
      const result = await respondToTask(task.id, action, comment, {
        proposedEnd: isConcern ? proposedEnd : undefined,
        reassignmentReason: isReassign ? reason : undefined
      })

      if (result.success) {
        toast.success(
          isAccept ? "Task accepted!" :
          isConcern ? "Concern submitted to your manager." :
          "Reassignment request sent."
        )
        onSuccess()
        onClose()
        setComment("")
        setReason("")
        setProposedEnd(undefined)
      } else {
        toast.error(result.error || "Something went wrong")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="p-0 rounded-sm border border-border shadow-none overflow-hidden w-[94vw] sm:max-w-[480px] gap-0">
        <DialogHeader className="px-5 py-4 border-b border-border/40 flex flex-row items-center gap-2.5">
          {config.icon}
          <div>
            <DialogTitle className="text-sm font-bold tracking-tight">{config.title}</DialogTitle>
            <p className="text-[10px] text-muted-foreground/70 font-medium mt-0.5">
              <span className="font-bold text-foreground/80">"{task.name}"</span>
            </p>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground">{config.subtitle}</p>

          {/* Reason selector for reassignment */}
          {isReassign && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                Reason Category <span className="text-rose-500">*</span>
              </Label>
              <Select onValueChange={setReason} value={reason}>
                <SelectTrigger className="h-8 rounded-sm text-xs font-medium border-border focus:ring-1 focus:ring-primary/20 shadow-none">
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent className="rounded-sm">
                  {REASSIGNMENT_REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value} className="text-xs">
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Proposed end date for concern */}
          {isConcern && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                Proposed Revised Deadline <span className="text-muted-foreground/40">(optional)</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-8 w-full rounded-sm text-xs font-medium border-border shadow-none justify-start",
                      !proposedEnd && "text-muted-foreground/50"
                    )}
                  >
                    <CalendarIcon className="mr-2 size-3 opacity-50" />
                    {proposedEnd ? format(proposedEnd, "PPP") : "Pick a date..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-sm border-border shadow-lg" align="start">
                  <CalendarUI
                    mode="single"
                    selected={proposedEnd}
                    onSelect={setProposedEnd}
                    disabled={d => d < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Comment field */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
              Your Comment <span className="text-rose-500">*</span>
              <span className="text-muted-foreground/40 ml-1 normal-case">(min. 10 characters)</span>
            </Label>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={config.placeholder}
              className="resize-none text-xs min-h-[80px] rounded-sm border-border focus:ring-1 focus:ring-primary/20 shadow-none placeholder:text-muted-foreground/30"
            />
            <div className="flex justify-between">
              <span className="text-[9px] text-muted-foreground/50">
                {comment.trim().length < 10
                  ? `${10 - comment.trim().length} more characters needed`
                  : "✓ Ready to submit"}
              </span>
              <span className="text-[9px] text-muted-foreground/40">{comment.length} chars</span>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <Button
            variant="ghost"
            className="flex-1 h-9 text-xs font-bold uppercase tracking-widest rounded-sm"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            className={cn("flex-1 h-9 text-xs font-bold uppercase tracking-widest rounded-sm", config.btnClass)}
            onClick={handleSubmit}
            disabled={!canSubmit || isPending}
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : config.btnLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Task Inbox Card ────────────────────────────────────────────────────────────

function TaskInboxCard({
  task,
  workload,
  onAction
}: {
  task: PendingTask
  workload: WorkloadSummary
  onAction: (task: PendingTask, action: ResponseAction) => void
}) {
  const isNegotiating = task.lifecycleStatus === "NEGOTIATING"
  const proposer = task.proposedBy || task.creator
  const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM

  return (
    <div className={cn(
      "p-3 rounded-md border transition-all duration-200 flex flex-col gap-2.5 shadow-2xs",
      isNegotiating ? "border-amber-500/30 bg-amber-500/5" : "border-border/70 bg-card hover:bg-muted/20"
    )}>
      {/* Header Info */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-foreground tracking-tight line-clamp-1 leading-snug">{task.name}</p>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-tight mt-0.5 truncate">{task.project.name}</p>
        </div>
        <span className={cn(
          "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border shrink-0",
          priorityConfig.className
        )}>
          {priorityConfig.label}
        </span>
      </div>

      {/* Details & Dates */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground font-medium">
        {task.plannedEnd && (
          <div className="flex items-center gap-1">
            <Calendar className="size-3 text-primary" />
            <span>Due {format(new Date(task.plannedEnd), "dd MMM")}</span>
          </div>
        )}
        {task.plannedDuration && (
          <div className="flex items-center gap-1">
            <Briefcase className="size-3 text-primary" />
            <span>{task.plannedDuration}d</span>
          </div>
        )}
        {proposer?.name && (
          <span className="text-muted-foreground/60 font-normal">by {proposer.name.split(' ')[0]}</span>
        )}
      </div>

      {/* Discussion Snippet */}
      {isNegotiating && task.comments && task.comments.length > 0 && (
        <div className="px-2.5 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20">
          <p className="text-[10px] text-amber-800 dark:text-amber-300 font-medium leading-relaxed line-clamp-1">
            "{task.comments[0].content}"
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 pt-0.5">
        <button
          onClick={() => onAction(task, "ACCEPT")}
          className="flex-1 h-7 flex items-center justify-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
        >
          <CheckCircle2 className="size-3" />
          Accept
        </button>
        <button
          onClick={() => onAction(task, "WORKLOAD_CONCERN")}
          className="flex-1 h-7 flex items-center justify-center gap-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
        >
          <MessageSquare className="size-3" />
          Discuss
        </button>
        <button
          onClick={() => onAction(task, "REQUEST_REASSIGNMENT")}
          className="h-7 px-2.5 flex items-center justify-center rounded-md bg-muted border border-border/80 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-600 text-muted-foreground text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
          title="Request Reassignment"
        >
          <ArrowLeftRight className="size-3" />
        </button>
      </div>
    </div>
  )
}

// ── Main Inbox Widget ──────────────────────────────────────────────────────────

export function TaskInbox({ pendingTasks, workload }: TaskInboxProps) {
  const router = useRouter()
  const [activeModal, setActiveModal] = useState<{ task: PendingTask; action: ResponseAction } | null>(null)

  if (pendingTasks.length === 0) return null

  return (
    <div className="bg-card border border-border/80 rounded-md overflow-hidden flex flex-col h-[430px] shadow-2xs animate-fade-in w-full">
      {/* Widget Header */}
      <div className="px-5 py-4 border-b border-border/70 flex items-center justify-between bg-muted/20 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <MessageSquare className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Pending Responses</h3>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              {pendingTasks.length} task{pendingTasks.length !== 1 ? "s" : ""} awaiting action
            </p>
          </div>
        </div>
        <span className="size-6 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
          {pendingTasks.length}
        </span>
      </div>

      {/* Workload Summary Bar */}
      <div className="px-5 py-2.5 border-b border-border/50 bg-muted/10 shrink-0">
        <WorkloadBar pct={workload.capacityPct} />
      </div>

      {/* Task Cards List */}
      <div className="p-4 space-y-3 flex-1 overflow-y-auto scrollbar-hide">
        {pendingTasks.map(task => (
          <TaskInboxCard
            key={task.id}
            task={task}
            workload={workload}
            onAction={(t, a) => setActiveModal({ task: t, action: a })}
          />
        ))}
      </div>

      {/* Response Modal Dialog */}
      {activeModal && (
        <ResponseModal
          task={activeModal.task}
          action={activeModal.action}
          open={true}
          onClose={() => setActiveModal(null)}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  )
}
