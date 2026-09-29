"use client"

import { useState, useEffect, useRef } from "react"
import {
  Card,
  Badge,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Avatar,
  AvatarImage,
  AvatarFallback
} from "@/components/ui"

import { updateTask, deleteTask } from "@/actions/projects/tasks"
import { toast } from "sonner"
import { cn, stripHtml } from "@/lib/utils"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { Clock, CheckCircle2, AlertTriangle, Eye, Lock, PauseCircle, History, Star, StarHalf, RefreshCw, Hourglass, MessageSquare, ArrowLeftRight, FolderKanban } from "lucide-react"
import { format, differenceInCalendarDays, formatDistanceToNow } from "date-fns"
import { TaskRowActions } from "@/components/features/projects/task-row-actions"
import { usePermissions } from "@/hooks/use-permissions"
import { useTransition } from "react"
import { forceCommitTask } from "@/actions/commitments/responses"

const COLUMNS = [
  { id: "TODO", title: "To Do", icon: AlertTriangle, color: "text-muted-foreground", bgColor: "bg-muted/50", borderColor: "border-border/60", dotColor: "bg-muted-foreground" },
  { id: "IN_PROGRESS", title: "In Progress", icon: Clock, color: "text-amber-500", bgColor: "bg-amber-50", borderColor: "border-amber-100", dotColor: "bg-amber-500" },
  { id: "ON_HOLD", title: "On Hold", icon: PauseCircle, color: "text-rose-500", bgColor: "bg-rose-50", borderColor: "border-rose-100", dotColor: "bg-rose-500" },
  { id: "IN_REVIEW", title: "In Review", icon: Eye, color: "text-orange-500", bgColor: "bg-orange-50", borderColor: "border-orange-100", dotColor: "bg-orange-500" },
  { id: "COMPLETED", title: "Done", icon: CheckCircle2, color: "text-emerald-500", bgColor: "bg-emerald-50", borderColor: "border-emerald-100", dotColor: "bg-emerald-500" },
]

// ── Proposed Task Card Component to comply with React hook rules ─────────────
function ProposedTaskCard({
  task,
  projectName,
  onTaskClick,
  onForceCommitSuccess
}: {
  task: any
  projectName?: string
  onTaskClick?: (task: any) => void
  onForceCommitSuccess: (taskId: string) => void
}) {
  const isNegotiating = task.lifecycleStatus === "NEGOTIATING"
  const [isForcing, setIsForcing] = useState(false)
  const [forceReason, setForceReason] = useState("")
  const [showForceForm, setShowForceForm] = useState(false)
  const taskProjectName = task.project?.name || task.projectName || projectName

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

  const handleClick = () => {
    if (isScrollingRef.current) return
    onTaskClick?.(task)
  }

  return (
    <div
      className={cn(
        "shrink-0 w-[260px] rounded-sm border bg-white p-3 cursor-pointer hover:shadow-sm transition-all",
        isNegotiating ? "border-amber-300" : "border-border"
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onClick={handleClick}
    >
      {/* Lifecycle badge */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className={cn(
          "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-[2px] border",
          isNegotiating
            ? "text-amber-700 bg-amber-50 border-amber-200"
            : "text-slate-600 bg-slate-50 border-slate-200"
        )}>
          {isNegotiating ? "💬 Discussing" : "⏳ Proposed"}
        </span>
        {task.proposedAt && (
          <span className="text-[8px] text-muted-foreground/50 ml-auto">
            {formatDistanceToNow(new Date(task.proposedAt), { addSuffix: true })}
          </span>
        )}
      </div>

      {/* Project Name Badge */}
      {taskProjectName && (
        <div className="flex items-center gap-1 text-[9.5px] font-bold text-primary/90 bg-primary/5 px-1.5 py-0.5 rounded border border-primary/15 max-w-full truncate mb-1.5" title={`Project: ${taskProjectName}`}>
          <FolderKanban className="size-2.5 text-primary shrink-0" />
          <span className="truncate">{taskProjectName}</span>
        </div>
      )}

      <p className="text-xs font-bold text-foreground truncate mb-0.5">
        {task.taskNumber && <span className="text-[9px] font-black text-indigo-500 mr-1">#{task.taskNumber}</span>}
        {task.name}
      </p>
      <p className="text-[10px] text-muted-foreground/60 font-medium truncate mb-2">
        → {task.assignedTo?.name || "Unassigned"}
      </p>

      {task.plannedEnd && (
        <p className="text-[9px] text-muted-foreground/60 mb-2">
          Due: {format(new Date(task.plannedEnd), "MMM d, yyyy")}
        </p>
      )}

      {/* Force-commit inline form */}
      {!showForceForm ? (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setShowForceForm(true) }}
          className="w-full mt-1 h-7 rounded-sm border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[9px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1"
        >
          <Lock className="size-3" /> Force Commit
        </button>
      ) : (
        <div
          className="space-y-2 mt-1"
          onClick={e => e.stopPropagation()}
        >
          <textarea
            className="w-full text-[10px] font-medium border border-border rounded-sm p-2 resize-none min-h-[52px] focus:outline-none focus:ring-1 focus:ring-primary/20"
            placeholder="Business reason (required, min 10 chars)..."
            value={forceReason}
            onChange={e => setForceReason(e.target.value)}
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              className="flex-1 h-7 rounded-sm bg-muted/40 text-muted-foreground text-[9px] font-black uppercase tracking-widest hover:bg-muted"
              onClick={() => { setShowForceForm(false); setForceReason("") }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={forceReason.trim().length < 10 || isForcing}
              className="flex-1 h-7 rounded-sm bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black uppercase tracking-widest disabled:opacity-40"
              onClick={async () => {
                setIsForcing(true)
                const result = await forceCommitTask(task.id, forceReason)
                setIsForcing(false)
                if (result.success) {
                  toast.success("Task force-committed")
                  onForceCommitSuccess(task.id)
                  setShowForceForm(false)
                  setForceReason("")
                } else {
                  toast.error(result.error || "Failed to force commit")
                }
              }}
            >
              {isForcing ? <RefreshCw className="size-3 animate-spin mx-auto" /> : "Commit"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function KanbanBoard({
  initialTasks,
  members = [],
  allMembers = [],
  projectName,
  onTaskClick,
}: {
  initialTasks: any[];
  members: any[];
  allMembers?: any[];
  projectName?: string;
  onTaskClick?: (task: any) => void;
}) {
  const { isAdmin, isTL, userId: currentUserId, departmentId: userDepartment, ledDepartmentId, ledDepartmentIds } = usePermissions()
  const [tasks, setTasks] = useState(initialTasks)
  const [isReady, setIsReady] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<any>(null)
  const [isPending, startTransition] = useTransition()
  const [syncingTasks, setSyncingTasks] = useState<Set<string>>(new Set())

  // Touch scroll event tracking refs to prevent accidental click activation
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

  const handleTaskClick = (task: any) => {
    if (isScrollingRef.current) return
    onTaskClick?.(task)
  }


  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

  useEffect(() => {
    setIsReady(true)
  }, [])

  async function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const task = tasks.find(t => t.id === draggableId)
    if (!task) return

    const newStatus = destination.droppableId

    if (task.status === "COMPLETED") {
      toast.error("Finalized: Completed tasks cannot be moved. Admin or TL must reject the task through the details view to return it to In Progress.")
      return
    }

    if (newStatus === "COMPLETED") {
      toast.error("Process Required: Tasks can only be moved to Done through the two-level approval process (TL & Admin approval required).")
      return
    }

    // Optimistic UI update
    const oldTasks = [...tasks]
    setTasks(prev => prev.map(t =>
      t.id === draggableId ? { ...t, status: newStatus } : t
    ))

    setSyncingTasks(prev => new Set(prev).add(draggableId))

    startTransition(async () => {
      try {
        const response = await updateTask(draggableId, { status: newStatus })

        if (response.success && response.data) {
          toast.success(`Task moved to ${newStatus.replace("_", " ")}`)
          setTasks(prev => prev.map(t => t.id === draggableId ? response.data : t))
        } else {
          toast.error(response.error || "Failed to move task")
          setTasks(oldTasks)
        }
      } catch (err) {
        toast.error("An error occurred")
        setTasks(oldTasks)
      } finally {
        setSyncingTasks(prev => {
          const next = new Set(prev)
          next.delete(draggableId)
          return next
        })
      }
    })
  }

  async function handleDeleteTask() {
    if (!taskToDelete) return

    const response = await deleteTask(taskToDelete.id)
    if (response.success) {
      toast.success("Task deleted successfully")
      setTasks(prev => prev.filter(t => t.id !== taskToDelete.id))
      setTaskToDelete(null)
    } else {
      toast.error(response.error || "Failed to delete task")
    }
  }

  if (!isReady) return <div className="flex gap-6 min-h-[400px] opacity-0" />

  // Separate proposed vs committed tasks for display
  const proposedTasks = tasks.filter(t =>
    t.lifecycleStatus === "PROPOSED" || t.lifecycleStatus === "NEGOTIATING"
  )
  const boardTasks = tasks.filter(t =>
    !t.lifecycleStatus || t.lifecycleStatus === "COMMITTED"
  )

  const showProposedColumn = (isAdmin || isTL) && proposedTasks.length > 0

  return (
    <>
      {/* PROPOSED pre-column — outside DnD, TL/Admin only */}
      {showProposedColumn && (
        <div className="px-4 pt-4 border-t border-amber-100 bg-amber-50/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm border border-amber-200 bg-amber-50 text-amber-700">
              <Hourglass className="size-3.5" />
              <span className="text-xs font-bold">Proposed</span>
            </div>
            <Badge variant="secondary" className="text-[11px] font-bold h-6 px-2.5 bg-amber-100 text-amber-700 border-none rounded-sm">
              {proposedTasks.length}
            </Badge>
            <p className="text-[9px] font-bold text-amber-600/70 uppercase tracking-widest">
              Awaiting employee response
            </p>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-3 custom-scrollbar">
            {proposedTasks.map(task => (
              <ProposedTaskCard
                key={task.id}
                task={task}
                projectName={projectName}
                onTaskClick={onTaskClick}
                onForceCommitSuccess={(taskId) => {
                  setTasks(prev => prev.map(t =>
                    t.id === taskId ? { ...t, lifecycleStatus: "COMMITTED" } : t
                  ))
                }}
              />
            ))}
          </div>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex overflow-x-auto gap-4 min-h-[380px] items-start p-4 border-t custom-scrollbar">

          {COLUMNS.map(column => {
            const columnTasks = boardTasks.filter(t => t.status === column.id)

            return (
              <div key={column.id} className="flex flex-col gap-4 min-w-[280px] max-w-[320px] w-full">
                {/* Column Header */}
                <div className="flex items-center justify-between group bg-muted/50">
                  <div className="flex items-center gap-4 p-1">
                    <div
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-sm border transition-all",
                        column.bgColor,
                        column.borderColor,
                        column.color
                      )}
                    >
                      <column.icon className="size-4 fill-current/10" />
                      <span className="text-xs font-bold">{column.title}</span>
                    </div>
                    <Badge variant="secondary" className="text-[11px] font-bold h-6 px-2.5 bg-muted/50 text-muted-foreground border-none rounded-sm">
                      {columnTasks.length}
                    </Badge>
                  </div>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={cn(
                        "flex-1 transition-all duration-300 min-h-[450px] flex flex-col gap-4 rounded-md",
                        snapshot.isDraggingOver ? "bg-muted/50" : "bg-transparent"
                      )}
                    >
                      {columnTasks.map((task, index) => {
                        const isOverdue = task.status !== "COMPLETED" && task.plannedEnd && differenceInCalendarDays(new Date(task.plannedEnd), new Date()) < 0;
                        const taskProjectName = task.project?.name || task.projectName || projectName;

                        return (
                          <Draggable
                            key={task.id}
                            draggableId={task.id}
                            index={index}
                            isDragDisabled={task.assignedToId !== currentUserId}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cn(
                                  "transition-all duration-200",
                                  snapshot.isDragging ? "rotate-1 scale-[1.01]" : ""
                                )}
                              >
                                <Card
                                  onTouchStart={handleTouchStart}
                                  onTouchMove={handleTouchMove}
                                  onClick={() => handleTaskClick(task)}
                                  className={cn(
                                    "group bg-white dark:bg-card border transition-all duration-300 overflow-hidden rounded-md p-0 cursor-pointer hover:ring-1 hover:ring-primary/20",
                                    snapshot.isDragging ? "ring-2 ring-primary" : "",
                                    syncingTasks.has(task.id) && "animate-pulse opacity-80",
                                    task.status === "IN_REVIEW" && "border-amber-500 bg-amber-50/10 dark:bg-amber-950/20"
                                  )}>
                                  {syncingTasks.has(task.id) && (
                                    <div className="absolute top-1 right-1 z-20">
                                      <RefreshCw className="size-2.5 animate-spin text-primary" />
                                    </div>
                                  )}

                                  <div className="p-4 space-y-3 relative">

                                    {/* Header Row: Title, Project Name & Priority */}
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="space-y-1.5 min-w-0 flex-1">
                                        {/* Task Number & Project Name Banner */}
                                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                          {task.taskNumber && (
                                            <span className="text-[9px] font-black text-indigo-400/80 tabular-nums tracking-tight">#{task.taskNumber}</span>
                                          )}
                                          {taskProjectName && (
                                            <span
                                              className="inline-flex items-center gap-1 text-[9.5px] font-bold text-primary/90 bg-primary/5 px-1.5 py-0.5 rounded border border-primary/15 max-w-[200px] truncate"
                                              title={`Project: ${taskProjectName}`}
                                            >
                                              <FolderKanban className="size-2.5 text-primary shrink-0" />
                                              <span className="truncate">{taskProjectName}</span>
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <h4 className="text-[13px] font-bold text-foreground leading-tight tracking-tight group-hover:text-primary transition-colors">
                                            {task.name}
                                          </h4>
                                          {task.assignedToId !== currentUserId && (
                                            <span title={`Locked to ${task.assignedTo?.name || "assigned member"}`} >
                                              <Lock className="size-3 text-muted-foreground/50 shrink-0" />
                                            </span>
                                          )}
                                          {task.committedByOverride && (
                                            <span title="Force-committed by manager">
                                              <Lock className="size-3 text-rose-500 shrink-0 animate-pulse" />
                                            </span>
                                          )}
                                        </div>
                                        <p className={cn(
                                          "text-[11px] font-medium",
                                          isOverdue ? "text-rose-600 animate-pulse-soft" : "text-muted-foreground"
                                        )}>
                                          {task.status === "COMPLETED" && task.actualEnd
                                            ? `Completed: ${format(new Date(task.actualEnd), "d MMM yyyy")}`
                                            : task.status === "IN_REVIEW"
                                              ? (task.adminApproved ? "Admin Approved" :
                                                 task.tlApproved ? "TL Approved • Waiting for Admin" :
                                                 task.subTlApproved ? "Sub-TL Approved • Waiting for TL" :
                                                 (task.department?.parentDepartmentId || task.reviewerId ? "Pending Sub-TL" : "Pending TL Approval"))
                                              : task.plannedEnd
                                                ? (differenceInCalendarDays(new Date(task.plannedEnd), new Date()) < 0
                                                  ? `Overdue by ${Math.abs(differenceInCalendarDays(new Date(task.plannedEnd), new Date()))} Days`
                                                  : `${differenceInCalendarDays(new Date(task.plannedEnd), new Date())} Days Remaining`)
                                                : "No Deadline"}
                                        </p>
                                      </div>

                                      {(() => {
                                        let priorityStyle = { label: "Low", color: "text-emerald-700 border-emerald-200 bg-emerald-50/30", dot: "bg-emerald-500" };

                                        if (task.status === "COMPLETED") {
                                          priorityStyle = { label: "Completed", color: "text-emerald-600 border-emerald-100 bg-emerald-50/50", dot: "bg-emerald-500" };
                                        } else {
                                          switch (task.priority) {
                                            case "URGENT":
                                              priorityStyle = { label: "Urgent", color: "text-rose-600 border-rose-100 bg-rose-50/50", dot: "bg-rose-500" };
                                              break;
                                            case "HIGH":
                                              priorityStyle = { label: "High", color: "text-orange-600 border-orange-100 bg-orange-50/50", dot: "bg-orange-500" };
                                              break;
                                            case "MEDIUM":
                                              priorityStyle = { label: "Medium", color: "text-amber-600 border-amber-100 bg-amber-50/50", dot: "bg-amber-500" };
                                              break;
                                            case "LOW":
                                            default:
                                              priorityStyle = { label: "Low", color: "text-emerald-600 border-emerald-100 bg-emerald-50/50", dot: "bg-emerald-500" };
                                              break;
                                          }
                                        }

                                        return (
                                          <div className="flex flex-col items-end gap-1">
                                            <Badge variant="outline" className={cn("rounded-full border px-2 py-0 h-5 text-[9px] font-bold gap-1.5 shrink-0 transition-colors", priorityStyle.color)}>
                                              <div className={cn("size-1.5 rounded-full", priorityStyle.dot)} />
                                              {priorityStyle.label}
                                            </Badge>
                                            {task.status === "COMPLETED" && (task.subTlRating || task.tlRating || task.adminRating) && (
                                              <div className="flex items-center gap-0.5" title={"Average Performance Rating"}>
                                                {(() => {
                                                  const ratings = [task.subTlRating, task.tlRating, task.adminRating].filter(r => r !== null && r !== undefined);
                                                  const average = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
                                                  return (
                                                    <>
                                                      {[1, 2, 3, 4, 5].map((s) => {
                                                        if (s <= average) {
                                                          return <Star key={s} className="size-2.5 fill-amber-400 text-amber-400" />
                                                        } else if (s - 0.5 <= average) {
                                                          return <StarHalf key={s} className="size-2.5 fill-amber-400 text-amber-400" />
                                                        } else {
                                                          return <Star key={s} className="size-2.5 text-muted-foreground/30" />
                                                        }
                                                      })}
                                                    </>
                                                  )
                                                })()}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })()}
                                    </div>

                                    {/* Dashed Separator */}
                                    <div className="w-full border-t border-dashed" />

                                    {/* Description */}
                                    <p className="text-[11.5px] text-muted-foreground/80 font-medium leading-relaxed line-clamp-2">
                                      {task.description ? stripHtml(task.description) : "No description provided for this task."}
                                    </p>

                                    {/* Progress & Schedule */}
                                    <div className="space-y-3 pt-1 border-t border-border/40">
                                      {/* Progress Bar */}
                                      <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">Progress</span>
                                          <span className="text-[10px] font-bold text-primary tabular-nums">{task.progress || 0}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden border border-border/10">
                                          <div
                                            className="h-full bg-primary transition-all duration-500 ease-in-out"
                                            style={{ width: `${task.progress || 0}%` }}
                                          />
                                        </div>
                                      </div>

                                      {/* Date Range */}
                                      <div className="text-[10px]">
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-muted-foreground/60 uppercase tracking-widest">Deadline</span>
                                          <span className={cn(
                                            "font-semibold tabular-nums",
                                            isOverdue ? "text-rose-600" : "text-muted-foreground/80"
                                          )}>
                                            {task.plannedEnd ? format(new Date(task.plannedEnd), "d MMM yyyy") : "---"}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="flex items-center justify-between pt-1">
                                      <div className="flex items-center gap-3">
                                        <div className="flex -space-x-1.5">
                                          <Avatar className="size-6 border-2 border-white dark:border-gray-800" title={task.assignedTo?.name || "Unassigned"}>
                                            {task.assignedTo?.avatarUrl && (
                                              <AvatarImage src={task.assignedTo.avatarUrl} alt={task.assignedTo.name} className="object-cover" />
                                            )}
                                            <AvatarFallback className="text-[8px] font-bold text-muted-foreground bg-muted uppercase">
                                              {task.assignedTo?.name ? task.assignedTo.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("") : "U"}
                                            </AvatarFallback>
                                          </Avatar>
                                        </div>
                                        <div className="flex items-center gap-2.5 text-muted-foreground/60">
                                          <div className="flex items-center gap-1" title={`${task.comments?.length || 0} Comments`}>
                                            <MessageSquare className="size-3.5" />
                                            <span className="text-[11px] font-semibold">{task.comments?.length || 0}</span>
                                          </div>
                                        </div>
                                      </div>

                                      <div onClick={(e) => e.stopPropagation()}>
                                        {(() => {
                                          const isAssignee = task.assignedToId === currentUserId;
                                          const isManager = task.assignedTo?.managerId === currentUserId;
                                          const availableLedDepartmentIds = ledDepartmentIds ?? (ledDepartmentId ? [ledDepartmentId] : []);
                                          const isDeptLeader = availableLedDepartmentIds.length > 0 && (
                                            (task.departmentId && availableLedDepartmentIds.includes(task.departmentId)) ||
                                            (task.assignedTo?.departmentId && availableLedDepartmentIds.includes(task.assignedTo.departmentId)) ||
                                            (task.department?.parentDepartmentId && availableLedDepartmentIds.includes(task.department.parentDepartmentId)) ||
                                            (task.assignedTo?.department?.parentDepartmentId && availableLedDepartmentIds.includes(task.assignedTo.department.parentDepartmentId))
                                          );
                                          const hasTaskAuthority = isAdmin || isDeptLeader || isManager;

                                          const showActions = hasTaskAuthority || (isAssignee && !["COMPLETED", "IN_REVIEW"].includes(task.status));

                                          return showActions && (
                                            <TaskRowActions
                                              task={task}
                                              members={members}
                                              allMembers={allMembers}
                                            />
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        )
                      })}

                      {provided.placeholder}

                      {columnTasks.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border/10 rounded-sm opacity-30 py-12">
                          <column.icon className="size-8 mb-3 text-muted-foreground" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Empty Column</p>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}

        </div>
      </DragDropContext>

      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent className="rounded-sm border-border shadow-lg sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold tracking-tight">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This will permanently remove the task <span className="font-bold text-foreground">"{taskToDelete?.name}"</span> and all its associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              className="h-8 rounded-sm text-[10px] font-black uppercase tracking-widest"
              onClick={() => setTaskToDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-8 rounded-sm bg-rose-600 hover:bg-rose-700 text-[10px] font-black uppercase tracking-widest text-white border-0"
              onClick={(e) => {
                e.preventDefault()
                handleDeleteTask()
              }}
            >
              Delete Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}



