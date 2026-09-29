"use client"

import { useRef } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui"
import { cn, stripHtml } from "@/lib/utils"
import { format, differenceInCalendarDays } from "date-fns"
import { TaskRowActions } from "./task-row-actions"
import { TaskStatusBadge } from "./task-status-badge"
import { usePagination } from "@/hooks/use-pagination"
import { DataTablePagination } from "@/components/ui/data-table-pagination"

import { CheckSquare } from "lucide-react"

export function TaskListView({
  tasks,
  isAdmin,
  isTL,
  userDepartment,
  ledDepartment,
  ledDepartmentIds,
  currentUserId,
  members,
  allMembers,
  onTaskClick,
}: {
  tasks: any[];
  isAdmin: boolean;
  isTL: boolean;
  userDepartment?: string;
  ledDepartment?: string;
  ledDepartmentIds?: string[];
  currentUserId: string;
  members: any[];
  allMembers?: any[];
  onTaskClick?: (task: any) => void;
}) {
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

  const handleRowClick = (task: any) => {
    if (isScrollingRef.current) return
    onTaskClick?.(task)
  }

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems: paginatedTasks,
    totalItems,
    itemsPerPage
  } = usePagination(tasks, 10)

  return (
    <div className="bg-white dark:bg-card/50 rounded-sm border flex flex-col h-full min-h-[400px]">
      {tasks.length > 0 ? (
        <>
          <div className="flex-1 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent border-b border-border/70">
                  <TableHead className="text-xs font-semibold text-muted-foreground pl-4">Task & Description</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Assigned To</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Activity</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Priority</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Start Date</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Planned End</TableHead>
                  <TableHead className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Actual End</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground text-center">Progress</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground text-right pr-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTasks.map((task) => (
                  <TableRow
                    key={task.id}
                    className="group hover:bg-muted/10 border-b border-border/30 last:border-0 transition-colors cursor-pointer"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onClick={() => handleRowClick(task)}
                  >
                    <TableCell className="max-w-[220px] pl-4">
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {task.taskNumber && (
                            <span className="text-[9px] font-black tabular-nums text-indigo-500/80 shrink-0">#{task.taskNumber}</span>
                          )}
                          <span className="text-[11px] font-bold text-primary group-hover:underline transition-all truncate" title={task.name}>
                            {task.name}
                          </span>
                          {task.committedByOverride && (
                            <span className="text-[8px] font-black uppercase tracking-widest px-1 py-0.5 rounded-[2px] bg-rose-50 border border-rose-100 text-rose-600 shrink-0" title="Force committed by Manager/TL">
                              ⚠ Forced
                            </span>
                          )}
                        </div>
                        {task.department?.name && (
                          <span className="text-[9px] text-muted-foreground/80 font-medium truncate flex items-center gap-1">
                            {task.department.parentDepartment ? (
                              <>
                                <span>{task.department.parentDepartment.name}</span>
                                <span className="text-muted-foreground/40">›</span>
                                <span className="text-primary font-semibold">{task.department.name}</span>
                              </>
                            ) : (
                              <span>{task.department.name}</span>
                            )}
                          </span>
                        )}
                        {task.description && (
                          <span className="text-[10px] text-muted-foreground truncate" title={stripHtml(task.description)}>
                            {stripHtml(task.description)}
                          </span>
                        )}
                      </div>
                    </TableCell>
 
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-6 border shrink-0">
                          {task.assignedTo?.avatarUrl && (
                            <AvatarImage src={task.assignedTo.avatarUrl} alt={task.assignedTo.name || "U"} className="object-cover" />
                          )}
                          <AvatarFallback className="text-[8px] font-black uppercase bg-muted">
                            {task.assignedTo?.name ? task.assignedTo.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("") : "U"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[11px] font-medium text-foreground/70">
                          {task.assignedTo?.name || "Unassigned"}
                        </span>
                      </div>
                    </TableCell>
 
                    <TableCell>
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {task.activity || "-"}
                      </span>
                    </TableCell>
 
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full border px-2 py-0 h-5 text-[9px] font-bold gap-1.5 shrink-0 transition-colors",
                          task.priority === "URGENT" ? "text-rose-600 bg-rose-50 border-rose-100" :
                            task.priority === "HIGH" ? "text-orange-600 bg-orange-50 border-orange-100" :
                              task.priority === "MEDIUM" ? "text-amber-600 bg-amber-50 border-amber-100" :
                                "text-emerald-600 bg-emerald-50 border-emerald-100"
                        )}
                      >
                        {task.priority}
                      </Badge>
                    </TableCell>
 
                    <TableCell>
                      {task.lifecycleStatus === "PROPOSED" ? (
                        <div className="text-amber-600 font-bold flex items-center gap-1">
                          <span className="text-[10px] uppercase tracking-widest">⏳ Proposed</span>
                        </div>
                      ) : task.lifecycleStatus === "NEGOTIATING" ? (
                        <div className="text-amber-500 font-bold flex items-center gap-1">
                          <span className="text-[10px] uppercase tracking-widest">💬 Discussing</span>
                        </div>
                      ) : (
                        <TaskStatusBadge status={task.status} />
                      )}
                    </TableCell>

                    <TableCell className="text-[10px] tabular-nums text-muted-foreground">
                      {task.plannedStart ? format(new Date(task.plannedStart), "dd-MM-yyyy") : "-"}
                    </TableCell>

                    {(() => {
                      const isOverdue = task.status !== "COMPLETED" && task.plannedEnd && differenceInCalendarDays(new Date(task.plannedEnd), new Date()) < 0;
                      return (
                        <TableCell className={cn(
                          "text-[10px] tabular-nums font-medium",
                          isOverdue ? "text-rose-600 animate-pulse-soft" : "text-muted-foreground"
                        )}>
                          {task.plannedEnd ? format(new Date(task.plannedEnd), "dd-MM-yyyy") : "-"}
                        </TableCell>
                      );
                    })()}

                    <TableCell className="text-[10px] tabular-nums font-bold text-emerald-600">
                      {task.actualEnd ? format(new Date(task.actualEnd), "dd-MM-yyyy") : "-"}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col items-center gap-1 min-w-[60px]">
                        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${task.progress}%` }} />
                        </div>
                        <span className="text-[10px] font-bold tabular-nums">{task.progress}%</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const isAssignee = task.assignedToId === currentUserId;
                        const isManager = task.assignedTo?.managerId === currentUserId;
                        const availableLedDepartmentIds = ledDepartmentIds ?? (ledDepartment ? [ledDepartment] : []);
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            showOnlyNavigationOnMobile={true}
          />
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="size-16 rounded-full bg-muted/30 border-2 border-dashed border-border/40 flex items-center justify-center">
            <CheckSquare className="size-8 text-muted-foreground/40" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-foreground uppercase tracking-widest">No tasks identified</p>
            <p className="text-xs text-muted-foreground font-medium">Start by adding tasks to this project to track progress.</p>
          </div>
        </div>
      )}
    </div>
  )
}
