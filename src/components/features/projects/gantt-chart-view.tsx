"use client"

import { useState, useMemo, useEffect, useTransition, useRef } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, differenceInCalendarDays, isWithinInterval, startOfDay, addMonths, subMonths, addDays } from "date-fns"
import { ChevronLeft, ChevronRight, GripVertical, RefreshCw, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarImage, AvatarFallback, Button } from "@/components/ui"
import { updateTask } from "@/actions/projects/tasks"
import { toast } from "sonner"
import Link from "next/link"

interface GanttChartViewProps {
  tasks: any[]
  members: any[]
  onTaskClick?: (task: any) => void
  groupBy?: "user" | "project"
  isAdmin?: boolean
  milestones?: any[]
}

export function GanttChartView({ tasks, members, onTaskClick, groupBy = "user", isAdmin = false, milestones = [] }: GanttChartViewProps) {
  // Use current month as initial view
  const [viewDate, setViewDate] = useState(new Date())

  const [isPending, startTransition] = useTransition()
  const [taskOverrides, setTaskOverrides] = useState<Record<string, { plannedStart?: Date, plannedEnd?: Date }>>({})
  const [isDragging, setIsDragging] = useState<{
    taskId: string,
    startX: number,
    originalStart: Date,
    originalEnd: Date,
    mode: "extend" | "move"
  } | null>(null)
  const [syncingTasks, setSyncingTasks] = useState<Set<string>>(new Set())
  const dragMovedRef = useRef(false)

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const dateA = a.plannedStart ? new Date(a.plannedStart).getTime() : 0
      const dateB = b.plannedStart ? new Date(b.plannedStart).getTime() : 0
      return dateA - dateB || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
    })
  }, [tasks])

  const tasksWithOverrides = useMemo(() => {
    return sortedTasks.map(task => {
      const override = taskOverrides[task.id]
      if (override) {
        return { 
          ...task, 
          plannedStart: override.plannedStart || task.plannedStart,
          plannedEnd: override.plannedEnd || task.plannedEnd 
        }
      }
      return task
    })
  }, [sortedTasks, taskOverrides])

  const startDate = startOfMonth(viewDate)
  const endDate = endOfMonth(viewDate)
  const days = eachDayOfInterval({ start: startDate, end: endDate })

  // Group tasks by assignee or project
  const groupedTasks = useMemo(() => {
    const groups: Record<string, any[]> = {}

    tasksWithOverrides.forEach(task => {
      const groupId = groupBy === "user"
        ? (task.assignedToId || "unassigned")
        : (task.projectId || "no-project")

      if (!groups[groupId]) groups[groupId] = []
      groups[groupId].push(task)
    })

    return Object.entries(groups)
      .map(([groupId, items]) => {
        let groupName = "Unknown"
        let groupAvatar = undefined

        if (groupBy === "user") {
          const user = members.find(m => m.id === groupId)
          groupName = user?.name || "Unassigned"
          groupAvatar = user?.avatarUrl || user?.avatar
        } else {
          // Find the project name from any task in the group
          const taskWithProject = items.find(t => t.project?.name)
          groupName = taskWithProject?.project?.name || "No Project"
        }

        return {
          id: groupId,
          name: groupName,
          avatar: groupAvatar,
          tasks: items // Preserving stable order from sortedTasks
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name)) // Stable sort by name
  }, [tasksWithOverrides, members, groupBy])

  const nextMonth = () => setViewDate(prev => addMonths(prev, 1))
  const prevMonth = () => setViewDate(prev => subMonths(prev, 1))

  const columnWidth = 40 // px per day

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - isDragging.startX
      const deltaDays = Math.round(deltaX / columnWidth)

      if (deltaDays !== 0) {
        dragMovedRef.current = true
      }

      if (isDragging.mode === "extend") {
        const newEnd = addDays(isDragging.originalEnd, deltaDays)
        setTaskOverrides(prev => ({
          ...prev,
          [isDragging.taskId]: { ...prev[isDragging.taskId], plannedEnd: newEnd }
        }))
      } else {
        const newStart = addDays(isDragging.originalStart, deltaDays)
        const newEnd = addDays(isDragging.originalEnd, deltaDays)
        setTaskOverrides(prev => ({
          ...prev,
          [isDragging.taskId]: { plannedStart: newStart, plannedEnd: newEnd }
        }))
      }
    }

    const handleMouseUp = async () => {
      const currentDragging = isDragging
      const override = taskOverrides[currentDragging.taskId]

      setIsDragging(null)

      if (override) {
        const hasStartChanged = override.plannedStart && override.plannedStart.getTime() !== currentDragging.originalStart.getTime()
        const hasEndChanged = override.plannedEnd && override.plannedEnd.getTime() !== currentDragging.originalEnd.getTime()

        if (hasStartChanged || hasEndChanged) {
          try {
            const updateData: any = {}
            if (hasStartChanged) updateData.plannedStart = override.plannedStart
            if (hasEndChanged) updateData.plannedEnd = override.plannedEnd

            // Ensure duration is updated if needed
            const finalStart = override.plannedStart || currentDragging.originalStart
            const finalEnd = override.plannedEnd || currentDragging.originalEnd
            const plannedDuration = Math.max(1, differenceInCalendarDays(finalEnd, finalStart) + 1)

            setSyncingTasks(prev => new Set(prev).add(currentDragging.taskId))
            
            startTransition(async () => {
              try {
                const res = await updateTask(currentDragging.taskId, {
                  ...updateData,
                  plannedDuration
                })

                if (!res.success) {
                  toast.error(res.error || "Failed to update task")
                  setTaskOverrides(prev => {
                    const next = { ...prev }
                    delete next[currentDragging.taskId]
                    return next
                  })
                } else {
                  toast.success("Schedule updated")
                }
              } catch (err) {
                toast.error("An error occurred during update")
              } finally {
                setSyncingTasks(prev => {
                  const next = new Set(prev)
                  next.delete(currentDragging.taskId)
                  return next
                })
              }
            })
          } catch (err) {
            toast.error("Error calculating update")
          }
        }
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, taskOverrides, columnWidth, tasks])

  return (
    <div className="rounded-sm border bg-card flex flex-col h-auto sm:h-[750px] overflow-hidden">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-6 py-2 sm:py-3 border-b shrink-0 bg-white dark:bg-card gap-2 sm:gap-6">
        <div className="flex items-center justify-between sm:justify-start gap-4 sm:gap-6 w-full sm:w-auto">
          <div className="space-y-0 sm:space-y-1 shrink-0">
            <p className="text-[7px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 leading-none">Project Timeline</p>
            <h2 className="text-[11px] sm:text-lg font-bold tracking-tight text-foreground/90 whitespace-nowrap">
              {format(viewDate, "MMMM yyyy")}
            </h2>
          </div>
          <div className="flex items-center gap-1 bg-muted/20 p-0.5 sm:p-1 rounded-sm border border-border/40 shrink-0">
            <Button variant="ghost" size="icon" className="size-6 rounded-sm hover:bg-white" onClick={prevMonth}>
              <ChevronLeft className="size-3" />
            </Button>
            <Button variant="ghost" size="icon" className="size-6 rounded-sm hover:bg-white" onClick={nextMonth}>
              <ChevronRight className="size-3" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 sm:gap-5 shrink-0">
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <div className="size-1.5 sm:size-2 rounded-full bg-blue-500/80" />
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Working</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <div className="size-1.5 sm:size-2 rounded-full bg-amber-400/80" />
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Review</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <div className="size-1.5 sm:size-2 rounded-full bg-emerald-500/80" />
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Done</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <div className="size-1.5 sm:size-2 rounded-full bg-slate-400/80" />
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">To Do</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <div className="size-1.5 sm:size-2 rounded-full bg-rose-500/80" />
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Overdue</span>
          </div>
        </div>
      </div>

      {/* Main Gantt Area - Unified Scroll */}
      <div className="flex-1 overflow-auto bg-white dark:bg-slate-950 relative scrollbar-thin scrollbar-thumb-muted-foreground/20">
        <div className="flex flex-row min-w-max min-h-full">
          {/* Left Side: Task Table - Sticky Column */}
          <div className={cn(
            "sticky left-0 shrink-0 border-r border-border/80 bg-white dark:bg-slate-950 z-40 flex flex-col",
            groupBy === "user" ? "w-[160px] sm:w-[360px]" : "w-[180px] sm:w-[400px]"
          )}>
            {/* Compact Table Header */}
            <div className="h-10 border-b-2 border-border/40 flex items-center bg-slate-50 dark:bg-slate-900 shrink-0 px-2 sm:px-4">
              <div className="w-[105px] sm:w-[150px] shrink-0 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Name</div>
              <div className="w-[25px] sm:w-[40px] shrink-0 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 text-center">%</div>
              {groupBy !== "user" && (
                <div className="hidden sm:block w-[40px] shrink-0 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 text-center">Work</div>
              )}
              <div className="hidden sm:block w-[50px] shrink-0 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 text-center">Start</div>
              <div className="hidden sm:block w-[50px] shrink-0 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 text-center">End</div>
              <div className="hidden sm:block w-[50px] shrink-0 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 text-center">Days</div>
            </div>

            <div className="divide-y divide-border/20">
              {groupedTasks.map((group) => (
                <div key={group.id} className="bg-background">
                  {/* Compact Group Header */}
                  <div className="px-2 sm:px-4 py-1.5 bg-muted/5 border-b border-border/30 flex items-center gap-2 sm:gap-3 sticky top-0 z-10 backdrop-blur-md">
                    {groupBy === "user" && (
                      <Avatar className="size-5 sm:size-6 border shrink-0" title={group.name}>
                        {group.avatar && (
                          <AvatarImage src={group.avatar} alt={group.name} className="object-cover" />
                        )}
                        <AvatarFallback className="text-[7px] sm:text-[8px] font-black bg-primary/10 text-primary uppercase">
                          {group.name ? group.name.split(" ").map(n => n[0]).slice(0, 2).join("") : "U"}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    {groupBy === "project" && group.id !== "no-project" ? (
                      <Link href={`/dashboard/projects/${group.id}`} className="text-[10px] sm:text-[11px] font-bold tracking-tight leading-none truncate text-primary hover:underline transition-colors">
                        {group.name}
                      </Link>
                    ) : (
                      <h3 className={cn(
                        "text-[10px] sm:text-[11px] font-bold tracking-tight leading-none truncate",
                        groupBy === "project" ? "text-primary" : "text-foreground/80"
                      )}>
                        {group.name}
                      </h3>
                    )}
                  </div>

                  {/* Compact Task Rows */}
                  <div className="divide-y divide-border/5">
                    {group.tasks.map(task => {
                      const daysCount = task.plannedStart && task.plannedEnd
                        ? differenceInCalendarDays(startOfDay(new Date(task.plannedEnd)), startOfDay(new Date(task.plannedStart))) + 1
                        : 0

                      return (
                        <div
                          key={task.id}
                          className="h-8 flex items-center px-2 sm:px-4 hover:bg-primary/2 transition-colors cursor-pointer group/row"
                          onClick={() => onTaskClick?.(task)}
                        >
                          <div className="w-[105px] sm:w-[150px] shrink-0">
                            <p className="text-[9px] sm:text-[10px] font-bold text-foreground/70 truncate group-hover/row:text-primary transition-colors leading-tight flex items-center gap-1">
                              {task.lifecycleStatus === "PROPOSED" && "⏳ "}
                              {task.lifecycleStatus === "NEGOTIATING" && "💬 "}
                              {task.committedByOverride && "⚠ "}
                              {task.name}
                            </p>
                          </div>
                          <div className="w-[25px] sm:w-[40px] shrink-0 text-center">
                            <span className="text-[8px] sm:text-[9px] font-bold text-muted-foreground/80 tabular-nums">{task.progress}%</span>
                          </div>
                          {groupBy !== "user" && (
                            <div className="hidden sm:flex w-[40px] shrink-0 justify-center">
                              <Avatar className="size-3.5 sm:size-4 border ring-1 ring-white" title={task.assignedTo?.name || "Unassigned"}>
                                {task.assignedTo?.avatarUrl && (
                                  <AvatarImage src={task.assignedTo.avatarUrl} alt={task.assignedTo.name || "U"} className="object-cover" />
                                )}
                                <AvatarFallback className="text-[5px] sm:text-[6px] font-black bg-slate-100 text-slate-500">
                                  {task.assignedTo?.name ? task.assignedTo.name.split(" ").map((n: any) => n[0]).slice(0, 2).join("") : "U"}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                          )}
                          <div className="hidden sm:block w-[55px] shrink-0 text-center">
                            <span className="text-[8px] font-semibold text-muted-foreground/60 tabular-nums">
                              {task.plannedStart ? format(new Date(task.plannedStart), "MMM d") : "-"}
                            </span>
                          </div>
                          <div className="hidden sm:block w-[55px] shrink-0 text-center">
                            <span className="text-[8px] font-semibold text-muted-foreground/60 tabular-nums">
                              {task.plannedEnd ? format(new Date(task.plannedEnd), "MMM d") : "-"}
                            </span>
                          </div>
                          <div className="hidden sm:block w-[45px] shrink-0 text-center">
                            <span className="text-[8px] sm:text-[9px] font-bold text-foreground/60 tabular-nums">{daysCount}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side: Timeline Grid - Together in the same horizontal flow */}
          <div
            className="relative bg-[#F9FAFB] dark:bg-slate-950"
            style={{ width: `${days.length * columnWidth}px` }}
          >
            {/* Compact Timeline Header Row */}
            <div className="h-10 border-b-2 border-border/40 flex sticky top-0 z-30 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md">
              {days.map((day) => {
                const isWeekend = day.getDay() === 0 || day.getDay() === 6
                const isToday = isSameDay(day, new Date())
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "h-full border-r border-border/80 flex flex-col items-center justify-center shrink-0 transition-colors",
                      isWeekend ? "bg-muted/10" : "bg-transparent",
                      isToday && "bg-primary/5"
                    )}
                    style={{ width: `${columnWidth}px` }}
                  >
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">
                      {format(day, "EEE").substring(0, 2)}
                    </span>
                    <span className={cn(
                      "text-[9px] font-black tabular-nums leading-none mt-0.5",
                      isToday ? "text-primary" : "text-slate-600"
                    )}>
                      {format(day, "dd")}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Grid Body */}
            <div className="relative flex-1">
              {/* Background Grid Lines */}
              <div className="absolute inset-0 pointer-events-none flex">
                {days.map((day) => {
                  const isToday = isSameDay(day, new Date())
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "h-full border-r border-border/60 shrink-0 relative",
                        day.getDay() === 0 || day.getDay() === 6 ? "bg-muted/5" : ""
                      )}
                      style={{ width: `${columnWidth}px` }}
                    >
                      {isToday && (
                        <div className="absolute left-0 top-0 bottom-0 w-px bg-blue-500 z-30" />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Milestones Vertical Lines */}
              {milestones?.map(milestone => {
                const dateToUse = (milestone.status === "COMPLETED" && milestone.actualDate) 
                  ? milestone.actualDate 
                  : milestone.dueDate;
                  
                if (!dateToUse) return null;
                const mDate = startOfDay(new Date(dateToUse));
                if (mDate < startDate || mDate > endDate) return null; // Only show if in view month
                
                const startDiff = differenceInCalendarDays(mDate, startDate);
                const left = (startDiff * columnWidth) + (columnWidth / 2); // center of the day column
                
                return (
                  <div 
                    key={`ms-${milestone.id}`}
                    className="absolute top-0 bottom-0 w-4 -ml-2 z-30 flex flex-col items-center group/ms cursor-default"
                    style={{ left: `${left}px` }}
                  >
                    {/* Trophy Icon */}
                    <div className={cn(
                      "size-4 rounded-full flex items-center justify-center bg-card border shrink-0 -mb-1 z-10 shadow-sm",
                      milestone.status === "COMPLETED" ? "border-emerald-500 text-emerald-500" : "border-primary text-primary"
                    )}>
                      <Trophy className="size-2.5" />
                    </div>

                    {/* The actual visible line */}
                    <div className={cn(
                      "flex-1 w-px border-l-2",
                      milestone.status === "COMPLETED" ? "border-emerald-500" : "border-primary/50 border-dashed"
                    )} />
                    
                    {/* Hover Tooltip */}
                    <div className="opacity-0 group-hover/ms:opacity-100 transition-opacity absolute top-4 pointer-events-none bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-sm whitespace-nowrap shadow-md z-40 border border-slate-700">
                      <div className="flex items-center gap-1.5">
                        <span className={milestone.status === "COMPLETED" ? "text-emerald-400" : "text-primary"}>🏆</span>
                        {milestone.title}
                      </div>
                      <div className="text-[8px] text-slate-400 font-normal mt-0.5">
                        {milestone.status === "COMPLETED" ? "Completed: " : "Target: "}
                        {format(mDate, "MMM d, yyyy")}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Bars Area */}
              <div className="relative">
                {groupedTasks.map((group) => (
                  <div key={group.id}>
                    {/* Compact User Section Spacer Row */}
                    <div className="h-6 bg-muted/5 border-b border-border/5" />

                    {group.tasks.map(task => {
                      const taskStart = task.plannedStart ? startOfDay(new Date(task.plannedStart)) : null
                      const taskEnd = task.plannedEnd ? startOfDay(new Date(task.plannedEnd)) : null

                      let left = 0
                      let width = 0
                      let visible = false

                      if (taskStart && taskEnd) {
                        // Check if the task interval overlaps with the current month view
                        visible = taskStart <= endDate && taskEnd >= startDate

                        if (visible) {
                          // Determine the visible portion of the task for clipping
                          const displayStart = taskStart < startDate ? startDate : taskStart
                          const displayEnd = taskEnd > endDate ? endDate : taskEnd

                          const startDiff = differenceInCalendarDays(displayStart, startDate)
                          const duration = differenceInCalendarDays(displayEnd, displayStart) + 1
                          left = startDiff * columnWidth
                          width = duration * columnWidth
                        }
                      }

                      const status = task.status
                      const isOverdue = taskEnd && taskEnd < startOfDay(new Date()) && status !== "COMPLETED"

                      const handleDragStart = (e: React.MouseEvent) => {
                        if (!isAdmin || status === "COMPLETED") return
                        e.preventDefault()
                        e.stopPropagation()
                        dragMovedRef.current = false
                        setIsDragging({
                          taskId: task.id,
                          startX: e.clientX,
                          originalStart: task.plannedStart ? new Date(task.plannedStart) : new Date(),
                          originalEnd: task.plannedEnd ? new Date(task.plannedEnd) : new Date(),
                          mode: "extend"
                        })
                      }

                      const handleMoveStart = (e: React.MouseEvent) => {
                        if (!isAdmin || status === "COMPLETED") return
                        // Prevent dragging if it's the right handle (which has its own handler)
                        if ((e.target as HTMLElement).closest('.drag-handle')) return
                        
                        e.preventDefault()
                        e.stopPropagation()
                        dragMovedRef.current = false
                        setIsDragging({
                          taskId: task.id,
                          startX: e.clientX,
                          originalStart: task.plannedStart ? new Date(task.plannedStart) : new Date(),
                          originalEnd: task.plannedEnd ? new Date(task.plannedEnd) : new Date(),
                          mode: "move"
                        })
                      }

                      return (
                        <div key={task.id} className="h-8 border-b border-border/5 relative group/bar">
                          {visible && (
                            <div
                              className={cn(
                                "absolute top-1/2 -translate-y-1/2 h-5 rounded-sm px-2 flex items-center transition-all z-10 border shadow-xs",
                                syncingTasks.has(task.id) && "animate-pulse ring-1 ring-primary/30",
                                isAdmin && status !== "COMPLETED" ? "cursor-move hover:scale-[1.01]" : "cursor-pointer hover:scale-[1.01]",
                                task.lifecycleStatus === "PROPOSED"
                                  ? "bg-amber-500/60 border-amber-400 text-white"
                                  : task.lifecycleStatus === "NEGOTIATING"
                                    ? "bg-orange-500/60 border-orange-400 text-white"
                                    : isOverdue
                                      ? "bg-rose-500/80 border-rose-400 text-white"
                                      : status === "COMPLETED"
                                        ? "bg-emerald-500/80 border-emerald-400 text-white"
                                        : status === "IN_REVIEW"
                                          ? "bg-amber-400/90 border-amber-300 text-white"
                                          : status === "IN_PROGRESS"
                                            ? "bg-blue-500/80 border-blue-400 text-white"
                                            : "bg-slate-400/80 border-slate-300 text-white"
                              )}
                              style={{
                                left: `${Math.max(0, left)}px`,
                                width: `${Math.max(20, width)}px`,
                                borderStyle: task.lifecycleStatus !== "COMMITTED" ? "dashed" : "solid",
                              }}
                              onMouseDown={handleMoveStart}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (dragMovedRef.current) {
                                  dragMovedRef.current = false
                                  return
                                }
                                onTaskClick?.(task)
                              }}
                            >
                              <span className="text-[9px] font-bold truncate whitespace-nowrap pr-2 flex items-center gap-1">
                                {task.lifecycleStatus === "PROPOSED" && "⏳ "}
                                {task.lifecycleStatus === "NEGOTIATING" && "💬 "}
                                {task.committedByOverride && "⚠ "}
                                {task.name}
                              </span>

                              {syncingTasks.has(task.id) && (
                                <RefreshCw className="size-2 absolute -right-4 top-1/2 -translate-y-1/2 animate-spin text-primary" />
                              )}

                              {/* Inner progress bar - subtle overlay */}
                              <div className="absolute bottom-0 left-0 h-0.5 bg-white/20 rounded-full" style={{ width: `${task.progress}%` }} />

                              {/* Drag handle for admin extend */}
                              {isAdmin && status !== "COMPLETED" && (
                                <div
                                  className="absolute right-0 top-0 bottom-0 w-2.5 flex items-center justify-center cursor-ew-resize group/handle z-20 hover:bg-white/20 drag-handle"
                                  onMouseDown={handleDragStart}
                                >
                                  <GripVertical className="size-2 text-white/40 group-hover/handle:text-white/90 transition-colors" />
                                </div>
                              )}

                              {/* Compact Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/bar:block bg-slate-900 text-white text-[8px] px-2 py-1 rounded-sm whitespace-nowrap z-50 border border-white/10">
                                {task.name} • {task.progress}%
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
