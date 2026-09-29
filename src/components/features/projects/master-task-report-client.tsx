"use client"

import React, { useState, useRef, useMemo, useDeferredValue } from "react"
import {
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetTitle,
} from "@/components/ui"
import { format, differenceInCalendarDays } from "date-fns"
import { List, LayoutGrid, Calendar, User, Users, Search, Filter, RotateCcw, CheckCircle2, Clock, X, ChevronDown, LayoutDashboard, Target, FolderKanban, CheckSquare, Download, ArrowUpDown, ArrowUp, ArrowDown, AtSign, ChevronsUpDown } from "lucide-react"
import { TaskStatusBadge } from "@/components/features/projects/task-status-badge"
import { TaskRowActions } from "@/components/features/projects/task-row-actions"
import { TaskDetailsDialog } from "@/components/features/projects/task-details-dialog"
import { KanbanBoard } from "@/components/features/projects/kanban-board"
import { GanttChartView } from "@/components/features/projects/gantt-chart-view"
import { cn, stripHtml } from "@/lib/utils"
import { usePagination } from "@/hooks/use-pagination"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { CreateTaskDialog } from "./create-task-dialog"
import { ExportButton } from "@/components/ui/export-button"
import Link from "next/link"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { getLatestTask } from "@/actions/projects/tasks"

function getHumanStatus(status: string | undefined, lifecycleStatus: string | undefined): string {
  if (lifecycleStatus === "PROPOSED" || lifecycleStatus === "NEGOTIATING") {
    return "proposed discussing"
  }
  if (!status) return ""
  switch (status) {
    case "COMPLETED": return "completed done"
    case "IN_PROGRESS": return "in progress working"
    case "IN_REVIEW": return "in review"
    case "ON_HOLD": return "on hold"
    case "TODO": return "to do todo"
    default: return status.replace("_", " ").toLowerCase()
  }
}

interface MasterTaskReportClientProps {
  tasks: any[]
  members: any[]
  allMembers?: any[]
  allProjects?: { id: string, name: string }[]
  allDepartments?: any[]
  isAdmin: boolean
  isTL: boolean
  userDepartmentId?: string | null
  ledDepartmentId?: string | null
  ledDepartmentIds?: string[]
  currentUserId: string
  isExternal?: boolean
}

export function MasterTaskReportClient({
  tasks = [],
  members = [],
  allMembers = [],
  allProjects = [],
  allDepartments = [],
  isAdmin,
  isTL,
  userDepartmentId,
  ledDepartmentId,
  ledDepartmentIds,
  currentUserId,
  isExternal,
}: MasterTaskReportClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [viewMode, setViewMode] = useState<"list" | "board" | "gantt">("list")
  const [scope, setScope] = useState<"my" | "mentioned" | "team" | "all">(isAdmin && !isExternal ? "all" : "my")

  // Auto-open task if ?taskId= parameter is present in URL
  React.useEffect(() => {
    const taskId = searchParams?.get("taskId")
    if (!taskId) return

    const foundTask = tasks.find((t: any) => t.id === taskId)
    if (foundTask) {
      setSelectedTask(foundTask)
    } else {
      getLatestTask(taskId)
        .then((res) => {
          if (res.success && res.data) {
            setSelectedTask(res.data)
          }
        })
        .catch(() => {})
    }
  }, [searchParams, tasks])
  const mentionedTaskIdSet = useMemo(() => {
    const set = new Set<string>()
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i]
      if (
        t.mentionedUserIds?.includes(currentUserId) ||
        t.comments?.some((c: any) => c.mentionedUserIds?.includes(currentUserId))
      ) {
        set.add(t.id)
      }
    }
    return set
  }, [tasks, currentUserId])
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [userFilter, setUserFilter] = useState<string>("all")
  const [deptFilter, setDeptFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<string>("all")
  const [hideCompleted, setHideCompleted] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const ledDepartmentIdsList = ledDepartmentIds ?? (ledDepartmentId ? [ledDepartmentId] : [])

  // Compute the entire hierarchy family (parent department + all child and sibling sub-departments) as an O(1) Set
  const departmentFamilyIds = useMemo(() => {
    const baseDeptIds = new Set<string>()
    if (userDepartmentId) baseDeptIds.add(userDepartmentId)
    if (ledDepartmentId) baseDeptIds.add(ledDepartmentId)
    if (ledDepartmentIds) {
      ledDepartmentIds.forEach(id => baseDeptIds.add(id))
    }

    // Find all root parent IDs for the base departments
    const rootParentIds = new Set<string>()
    baseDeptIds.forEach(deptId => {
      const found = allDepartments.find(d => d.id === deptId)
      if (found?.parentDepartmentId) {
        rootParentIds.add(found.parentDepartmentId)
      } else {
        rootParentIds.add(deptId)
      }
    });

    // Also include any parentDepartment from allDepartments where user's dept is a child
    allDepartments.forEach(d => {
      if (baseDeptIds.has(d.id)) {
        if (d.parentDepartmentId) rootParentIds.add(d.parentDepartmentId)
      }
    })

    // Now collect the root parent IDs AND all sub-departments that belong to any of these root parent IDs
    const familyDeptIds = new Set<string>(baseDeptIds)
    rootParentIds.forEach(rootId => {
      familyDeptIds.add(rootId)
      allDepartments.forEach(d => {
        if (d.id === rootId || d.parentDepartmentId === rootId) {
          familyDeptIds.add(d.id)
        }
      })
    })

    return familyDeptIds
  }, [userDepartmentId, ledDepartmentId, ledDepartmentIds, allDepartments])

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    } else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      setSortConfig(null)
      return
    }
    setSortConfig({ key, direction })
  }

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

  const handleTaskClickWithTouchCheck = (task: any) => {
    if (isScrollingRef.current) return
    setSelectedTask(task)
  }


  // Memoized filtering logic
  const filteredTasks = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase()

    return tasks.filter(task => {
      const isMentioned = mentionedTaskIdSet.has(task.id)

      // External user isolation: External users can see tasks they created, are assigned to, are designated reviewer on, or are tagged/mentioned in description or comments
      if (isExternal) {
        const isSelfCreated = task.createdById === currentUserId
        const isAssignedToMe = task.assignedToId === currentUserId
        const isReviewerOnTask = task.reviewerId === currentUserId
        if (!isSelfCreated && !isAssignedToMe && !isReviewerOnTask && !isMentioned) {
          return false
        }
      }

      // 1. Scope Filtering
      if (scope === "my") {
        if (isExternal) {
          const isRelated = task.assignedToId === currentUserId || task.createdById === currentUserId || task.reviewerId === currentUserId
          if (!isRelated) return false
        } else {
          if (task.assignedToId !== currentUserId) return false
        }
      } else if (scope === "mentioned") {
        if (!isMentioned) return false
      } else if (scope === "team") {
        const taskDeptId = task.departmentId || task.assignedTo?.departmentId
        const taskParentDeptId = task.department?.parentDepartmentId || task.assignedTo?.department?.parentDepartmentId

        const isMyDept = taskDeptId ? (
          departmentFamilyIds.has(taskDeptId) ||
          (taskParentDeptId && departmentFamilyIds.has(taskParentDeptId))
        ) : false
        const isMySub = task.assignedTo?.managerId === currentUserId
        if (!isMyDept && !isMySub) return false
      }

      // 2. Attribute Filtering
      if (projectFilter !== "all" && task.projectId !== projectFilter) return false
      if (statusFilter !== "all") {
        if (statusFilter === "PROPOSED") {
          if (task.lifecycleStatus !== "PROPOSED" && task.lifecycleStatus !== "NEGOTIATING") return false
        } else {
          if (task.status !== statusFilter) return false
          if (task.lifecycleStatus === "PROPOSED" || task.lifecycleStatus === "NEGOTIATING") return false
        }
      }
      if (userFilter !== "all" && task.assignedToId !== userFilter) return false
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false
      if (isAdmin && deptFilter !== "all" && task.departmentId !== deptFilter) return false
      if (hideCompleted && task.status === "COMPLETED") return false

      // 3. Date Presets
      if (dateFilter !== "all") {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const taskEnd = task.plannedEnd ? new Date(task.plannedEnd) : null

        if (!taskEnd) return false

        if (dateFilter === "overdue") {
          if (task.status === "COMPLETED" || taskEnd >= today) return false
        } else if (dateFilter === "today") {
          const isSameDay = format(taskEnd, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")
          if (!isSameDay) return false
        } else if (dateFilter === "week") {
          const diff = differenceInCalendarDays(taskEnd, today)
          if (diff < 0 || diff > 7) return false
        }
      }

      // 4. Text Search
      if (query) {
        const matchesName = task.name?.toLowerCase().includes(query)
        const matchesDesc = task.description?.toLowerCase().includes(query)
        const matchesMember = task.assignedTo?.name?.toLowerCase().includes(query)
        const matchesPriority = task.priority?.toLowerCase().includes(query)
        const matchesStatus = getHumanStatus(task.status, task.lifecycleStatus).includes(query)
        const matchesActivity = task.activity?.toLowerCase().includes(query)
        const matchesTaskNumber = task.taskNumber ? String(task.taskNumber).includes(query.replace("#", "")) : false
        const matchesProject = task.project?.name?.toLowerCase().includes(query)

        if (!matchesName && !matchesDesc && !matchesMember && !matchesPriority && !matchesStatus && !matchesActivity && !matchesTaskNumber && !matchesProject) return false
      }

      return true
    })
  }, [
    tasks,
    mentionedTaskIdSet,
    isExternal,
    currentUserId,
    scope,
    departmentFamilyIds,
    projectFilter,
    statusFilter,
    userFilter,
    priorityFilter,
    isAdmin,
    deptFilter,
    hideCompleted,
    dateFilter,
    deferredSearchQuery
  ])

  // Stable sort for list view (Latest Created > Name > ID)
  const sortedTasksForDisplay = React.useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      if (sortConfig) {
        const { key, direction } = sortConfig
        let aVal = ""
        let bVal = ""

        if (key === "project") {
          aVal = String(a.project?.name || "").toLowerCase()
          bVal = String(b.project?.name || "").toLowerCase()
        } else if (key === "assignedTo") {
          aVal = String(a.assignedTo?.name || "").toLowerCase()
          bVal = String(b.assignedTo?.name || "").toLowerCase()
        } else {
          aVal = String(a[key] || "").toLowerCase()
          bVal = String(b[key] || "").toLowerCase()
        }

        if (aVal < bVal) return direction === "asc" ? -1 : 1
        if (aVal > bVal) return direction === "asc" ? 1 : -1
      }

      const timeA = a.createdAt ? Date.parse(a.createdAt) : 0
      const timeB = b.createdAt ? Date.parse(b.createdAt) : 0
      return (
        timeB - timeA ||
        (a.name || "").localeCompare(b.name || "") ||
        (a.id || "").localeCompare(b.id || "")
      )
    })
  }, [filteredTasks, sortConfig])

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems: paginatedTasks,
    totalItems,
  } = usePagination(sortedTasksForDisplay, itemsPerPage)

  const activeFiltersCount = [
    projectFilter !== "all",
    statusFilter !== "all",
    userFilter !== "all",
    deptFilter !== "all",
    priorityFilter !== "all",
    dateFilter !== "all",
    hideCompleted
  ].filter(Boolean).length

  const renderFilterContent = (isMobile = false) => (
    <div className={cn(
      "w-full max-h-full overflow-hidden flex flex-col",
      isMobile ? "bg-background h-full" : "bg-card border border-border/80 shadow-2xl rounded-md"
    )}>
      {/* Drag Handle Indicator for mobile */}
      {isMobile && (
        <div className="flex justify-center py-2 shrink-0 bg-muted/10">
          <div className="w-12 h-1 rounded-full bg-muted-foreground/30" />
        </div>
      )}

      {/* Popover/Sheet Header */}
      <div className="px-4 py-3 bg-background/90 backdrop-blur-xs border-b border-border/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
            <Filter className="size-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground leading-none">Filter Tasks</h3>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
              Refine by status, priority, people, or timeline
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={() => {
                setProjectFilter("all")
                setStatusFilter("all")
                setUserFilter("all")
                setDeptFilter("all")
                setPriorityFilter("all")
                setDateFilter("all")
                setHideCompleted(false)
              }}
              className="text-[10px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
            >
              Reset All
            </button>
          )}
          {isMobile && (
            <SheetClose asChild>
              <button className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors cursor-pointer">
                <X className="size-4" />
              </button>
            </SheetClose>
          )}
        </div>
      </div>

      <div className={cn(
        "p-3.5 overflow-y-auto custom-scrollbar flex-1 space-y-3",
        isMobile ? "max-h-[70vh] pb-8" : "max-h-[calc(100vh-220px)] sm:max-h-[480px]"
      )}>
        {/* Section 1: Classification & Urgency */}
        <div className="bg-muted/15 border border-border/70 rounded-md p-3 space-y-2.5">
          <div className="flex items-center gap-1.5 pb-1 border-b border-border/50">
            <LayoutDashboard className="size-3 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Status & Priority</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-foreground">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs font-semibold px-2.5 bg-background border-border/80 rounded-md focus:ring-primary/20">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="border-border/80 shadow-xl rounded-md max-h-[220px]">
                  <SelectItem value="all" className="text-xs font-semibold">All Statuses</SelectItem>
                  <SelectItem value="PROPOSED" className="text-xs font-semibold text-amber-600">Proposed / Discussing</SelectItem>
                  <SelectItem value="TODO" className="text-xs font-semibold text-slate-600">To Do</SelectItem>
                  <SelectItem value="IN_PROGRESS" className="text-xs font-semibold text-blue-600">In Progress</SelectItem>
                  <SelectItem value="IN_REVIEW" className="text-xs font-semibold text-purple-600">In Review</SelectItem>
                  <SelectItem value="COMPLETED" className="text-xs font-semibold text-emerald-600">Completed</SelectItem>
                  <SelectItem value="ON_HOLD" className="text-xs font-semibold text-rose-600">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-foreground">Priority</label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-8 text-xs font-semibold px-2.5 bg-background border-border/80 rounded-md focus:ring-primary/20">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent className="border-border/80 shadow-xl rounded-md">
                  <SelectItem value="all" className="text-xs font-semibold">All Priorities</SelectItem>
                  <SelectItem value="LOW" className="text-xs font-bold text-slate-500">Low Priority</SelectItem>
                  <SelectItem value="MEDIUM" className="text-xs font-bold text-blue-500">Medium Priority</SelectItem>
                  <SelectItem value="HIGH" className="text-xs font-bold text-amber-500">High Priority</SelectItem>
                  <SelectItem value="URGENT" className="text-xs font-bold text-rose-500">Urgent Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Section 2: Project Scope & Timeline */}
        <div className="bg-muted/15 border border-border/70 rounded-md p-3 space-y-2.5">
          <div className="flex items-center gap-1.5 pb-1 border-b border-border/50">
            <FolderKanban className="size-3 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Project & Timeline</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-foreground">Project Context</label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="h-8 text-xs font-semibold px-2.5 bg-background border-border/80 rounded-md focus:ring-primary/20">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent className="border-border/80 shadow-xl rounded-md max-h-[220px]">
                  <SelectItem value="all" className="text-xs font-semibold">All Projects</SelectItem>
                  {allProjects.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-xs font-semibold">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-foreground">Due Timeline</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="h-8 text-xs font-semibold px-2.5 bg-background border-border/80 rounded-md focus:ring-primary/20">
                  <SelectValue placeholder="Any Time" />
                </SelectTrigger>
                <SelectContent className="border-border/80 shadow-xl rounded-md">
                  <SelectItem value="all" className="text-xs font-semibold">Any Time</SelectItem>
                  <SelectItem value="overdue" className="text-xs font-bold text-rose-600">Overdue Tasks</SelectItem>
                  <SelectItem value="today" className="text-xs font-bold text-blue-600">Due Today</SelectItem>
                  <SelectItem value="week" className="text-xs font-bold text-amber-600">Due This Week</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Section 3: People & Departments */}
        <div className="bg-muted/15 border border-border/70 rounded-md p-3 space-y-2.5">
          <div className="flex items-center gap-1.5 pb-1 border-b border-border/50">
            <Users className="size-3 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">People & Department</span>
          </div>

          <div className={cn("grid gap-2.5", isAdmin ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-foreground">Assigned Member</label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="h-8 text-xs font-semibold px-2.5 bg-background border-border/80 rounded-md focus:ring-primary/20">
                  <SelectValue placeholder="All Members" />
                </SelectTrigger>
                <SelectContent className="border-border/80 shadow-xl rounded-md max-h-[220px]">
                  <SelectItem value="all" className="text-xs font-semibold">All Team Members</SelectItem>
                  {members.map((m: any) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs font-semibold">{m.name || m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isAdmin && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">Department</label>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="h-8 text-xs font-semibold px-2.5 bg-background border-border/80 rounded-md focus:ring-primary/20">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent className="border-border/80 shadow-xl rounded-md max-h-[220px]">
                    <SelectItem value="all" className="text-xs font-semibold">All Departments</SelectItem>
                    {allDepartments.map((d: any) => (
                      <SelectItem key={d.id} value={d.id} className="text-xs font-semibold">{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Hide Completed Tasks Card */}
        <button
          type="button"
          onClick={() => setHideCompleted(!hideCompleted)}
          className={cn(
            "flex items-center justify-between w-full p-2.5 rounded-md text-left transition-all border cursor-pointer",
            hideCompleted
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
              : "bg-muted/15 border-border/70 text-foreground hover:bg-muted/30"
          )}
        >
          <div className="flex items-center gap-2">
            <div className={cn(
              "size-6 rounded-md flex items-center justify-center shrink-0 border",
              hideCompleted ? "bg-emerald-500 text-white border-emerald-600" : "bg-muted text-muted-foreground border-border/80"
            )}>
              {hideCompleted ? <CheckCircle2 className="size-3.5" /> : <Clock className="size-3.5" />}
            </div>
            <div>
              <span className="text-xs font-bold block leading-none">Hide Completed Tasks</span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Only show active, proposed, and in-review tasks
              </span>
            </div>
          </div>

          <div className={cn(
            "size-4.5 rounded-md border flex items-center justify-center transition-all shrink-0 ml-2",
            hideCompleted ? "bg-emerald-500 border-emerald-600 text-white" : "border-border/80 bg-background"
          )}>
            {hideCompleted && <CheckCircle2 className="size-3" />}
          </div>
        </button>
      </div>

      {/* Pinned Bottom Footer Actions */}
      <div className="shrink-0 p-3 bg-background/95 border-t border-border/60 flex items-center justify-between gap-2.5">
        <button
          type="button"
          disabled={activeFiltersCount === 0}
          onClick={() => {
            setProjectFilter("all")
            setStatusFilter("all")
            setUserFilter("all")
            setDeptFilter("all")
            setPriorityFilter("all")
            setDateFilter("all")
            setHideCompleted(false)
          }}
          className={cn(
            "h-9 px-3 text-xs font-semibold rounded-md border transition-colors cursor-pointer",
            activeFiltersCount > 0
              ? "text-rose-600 border-rose-500/30 hover:bg-rose-500/10 bg-rose-500/5"
              : "text-muted-foreground/40 border-border/40 opacity-50 cursor-not-allowed"
          )}
        >
          Reset
        </button>

        {isMobile ? (
          <SheetClose asChild>
            <Button className="h-9 text-xs font-bold uppercase tracking-wider px-4 rounded-md flex-1 cursor-pointer">
              Apply Filters ({filteredTasks.length})
            </Button>
          </SheetClose>
        ) : (
          <Button
            onClick={() => setFilterPopoverOpen(false)}
            className="h-9 text-xs font-bold uppercase tracking-wider px-4 rounded-md flex-1 cursor-pointer"
          >
            Apply Filters ({filteredTasks.length})
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* ── Executive Header Banner ── */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="size-8 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <CheckSquare className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none mb-0.5 sm:mb-1">
              Task Management
            </h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1 sm:line-clamp-none">
              Strategic project tracking, task execution, and milestone analytics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-muted/40 p-1 rounded-md border border-border/70">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                viewMode === "list" ? "bg-card text-foreground font-bold shadow-xs border border-border/60" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <List className="size-3.5" />
              <span>List</span>
            </button>
            <button
              onClick={() => setViewMode("board")}
              className={cn(
                "hidden sm:flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                viewMode === "board" ? "bg-card text-foreground font-bold shadow-xs border border-border/60" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <LayoutGrid className="size-3.5" />
              <span>Board</span>
            </button>
            <button
              onClick={() => setViewMode("gantt")}
              className={cn(
                "hidden sm:flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                viewMode === "gantt" ? "bg-card text-foreground font-bold shadow-xs border border-border/60" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <Calendar className="size-3.5" />
              <span>Gantt</span>
            </button>
          </div>

          <div className="w-px h-6 bg-border/60 mx-0.5 hidden sm:block" />

          <CreateTaskDialog
            projects={allProjects}
            members={members as any}
            departments={allDepartments as any}
            isTLorAdmin={isAdmin || isTL}
            currentUserId={currentUserId}
            userDepartment={ledDepartmentId ?? userDepartmentId ?? undefined}
            allMembers={allMembers}
            isExternal={isExternal}
          />

          <ExportButton
            filename={`task-report-${new Date().toISOString().split('T')[0]}`}
            title="Tasks"
            subtitle={`Scope: ${scope.toUpperCase()} · ${filteredTasks.length} tasks · Exported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
            columns={[
              { header: "Task ID", key: "taskNumber", format: (v) => v ? `#${v}` : "" },
              { header: "Project", key: "project", format: (_, row) => row.project?.name || "" },
              { header: "Task", key: "name", format: (v) => v || "" },
              { header: "Activity", key: "activity", format: (v) => v || "" },
              { header: "Assigned To", key: "assignedTo", format: (_, row) => row.assignedTo?.name || "Unassigned" },
              { header: "Priority", key: "priority", format: (v) => v || "" },
              { header: "Status", key: "status", format: (v) => (v || "").replace("_", " ") },
              { header: "Planned Start", key: "plannedStart", format: (v) => v ? format(new Date(v), "dd MMM yyyy") : "" },
              { header: "Planned End", key: "plannedEnd", format: (v) => v ? format(new Date(v), "dd MMM yyyy") : "" },
              { header: "Actual End", key: "actualEnd", format: (v) => v ? format(new Date(v), "dd MMM yyyy") : "" },
              { header: "Progress %", key: "progress", format: (v) => `${v ?? 0}%` },
              { header: "TL Approved", key: "tlApproved", format: (v) => v ? "Yes" : "No" },
              { header: "Admin Approved", key: "adminApproved", format: (v) => v ? "Yes" : "No" },
            ]}
            rows={filteredTasks}
          />
        </div>
      </div>

      {/* ── Main View Container ── */}
      <div className="space-y-0 bg-card rounded-md border border-border/80 overflow-hidden shadow-2xs">
        {/* Control Header (Tabs and Search/Filters) */}
        <div className="border-b border-border/70 bg-muted/10 p-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <Tabs value={scope} onValueChange={(v: any) => setScope(v)} className="w-full lg:w-auto shrink-0">
              <TabsList className="bg-muted/40 border border-border/70 h-9 gap-1 p-1 w-full lg:w-auto overflow-x-auto flex-nowrap no-scrollbar justify-start rounded-md">
                <TabsTrigger value="my" className="text-xs font-semibold px-3 h-7 gap-1.5 rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs shrink-0 cursor-pointer">
                  <User className="size-3.5" />
                  <span className="whitespace-nowrap hidden sm:inline">My Tasks</span>
                  <span className="whitespace-nowrap inline sm:hidden">My</span>
                </TabsTrigger>
                <TabsTrigger value="mentioned" className="text-xs font-semibold px-3 h-7 gap-1.5 rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs shrink-0 cursor-pointer">
                  <AtSign className="size-3.5 text-blue-500" />
                  <span className="whitespace-nowrap hidden sm:inline">Mentioned Tasks</span>
                  <span className="whitespace-nowrap inline sm:hidden">Mentioned</span>
                </TabsTrigger>
                {!isAdmin && (!isExternal || (members && members.length > 1)) && (
                  <TabsTrigger value="team" className="text-xs font-semibold px-3 h-7 gap-1.5 rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs shrink-0 cursor-pointer">
                    <Users className="size-3.5" />
                    <span className="whitespace-nowrap hidden sm:inline">Team Tasks</span>
                    <span className="whitespace-nowrap inline sm:hidden">Team</span>
                  </TabsTrigger>
                )}
                {!isExternal && (
                  <TabsTrigger value="all" className="text-xs font-semibold px-3 h-7 gap-1.5 rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs shrink-0 cursor-pointer">
                    <Search className="size-3.5" />
                    <span className="whitespace-nowrap hidden sm:inline">All Project Tasks</span>
                    <span className="whitespace-nowrap inline sm:hidden">All Project</span>
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2.5 flex-1 max-w-2xl lg:justify-end">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
                <Input
                  placeholder="Search tasks, assignees, activities, or project..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 bg-background text-xs placeholder:text-muted-foreground/40 rounded-md border-border/80 focus:ring-primary/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {(isAdmin || isTL) && (
                <>
                  {/* Desktop Popover View */}
                  <div className="hidden md:block">
                    <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-9 gap-2 text-xs font-semibold px-3.5 rounded-md border-border/80 transition-all cursor-pointer",
                            activeFiltersCount > 0 && "bg-primary/10 border-primary/30 text-primary font-bold"
                          )}
                        >
                          <Filter className="size-3.5" />
                          <span>Filters</span>
                          {activeFiltersCount > 0 && (
                            <span className="flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                              {activeFiltersCount}
                            </span>
                          )}
                          <ChevronDown className="size-3 ml-0.5 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        collisionPadding={16}
                        sideOffset={8}
                        className="p-0 border-border/80 rounded-md shadow-2xl w-[calc(100vw-32px)] sm:w-[380px] md:w-[400px] max-w-[420px] max-h-[min(80vh,520px)] flex flex-col overflow-hidden"
                      >
                        {renderFilterContent(false)}
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Tablet & Mobile Sheet View */}
                  <div className="block md:hidden">
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-9 gap-2 text-xs font-semibold px-3.5 rounded-md border-border/80 transition-all cursor-pointer",
                            activeFiltersCount > 0 && "bg-primary/10 border-primary/30 text-primary font-bold"
                          )}
                        >
                          <Filter className="size-3.5" />
                          <span>Filters</span>
                          {activeFiltersCount > 0 && (
                            <span className="flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                              {activeFiltersCount}
                            </span>
                          )}
                          <ChevronDown className="size-3 ml-0.5 opacity-50" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="bottom" className="p-0 border-t border-border/80 rounded-t-xl max-h-[85vh] overflow-hidden flex flex-col" showCloseButton={false}>
                        <SheetTitle className="sr-only">Advanced Filters</SheetTitle>
                        {renderFilterContent(true)}
                      </SheetContent>
                    </Sheet>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Active Filter Tags */}
          {activeFiltersCount > 0 && (
            <div className="pt-2.5 flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">Active:</span>
              {projectFilter !== "all" && (
                <Badge
                  variant="secondary"
                  className="h-6 text-[10px] font-semibold gap-1 pr-1.5 bg-primary/10 text-primary border border-primary/20 rounded-md cursor-pointer hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/20 transition-colors"
                  onClick={() => setProjectFilter("all")}
                >
                  Project: {allProjects.find(p => p.id === projectFilter)?.name}
                  <X className="size-3" />
                </Badge>
              )}
              {statusFilter !== "all" && (
                <Badge
                  variant="secondary"
                  className="h-6 text-[10px] font-semibold gap-1 pr-1.5 bg-primary/10 text-primary border border-primary/20 rounded-md cursor-pointer hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/20 transition-colors"
                  onClick={() => setStatusFilter("all")}
                >
                  Status: {statusFilter}
                  <X className="size-3" />
                </Badge>
              )}
              {userFilter !== "all" && (
                <Badge
                  variant="secondary"
                  className="h-6 text-[10px] font-semibold gap-1 pr-1.5 bg-primary/10 text-primary border border-primary/20 rounded-md cursor-pointer hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/20 transition-colors"
                  onClick={() => setUserFilter("all")}
                >
                  Assignee: {members.find((m: any) => m.id === userFilter)?.name}
                  <X className="size-3" />
                </Badge>
              )}
              {priorityFilter !== "all" && (
                <Badge
                  variant="secondary"
                  className="h-6 text-[10px] font-semibold gap-1 pr-1.5 bg-primary/10 text-primary border border-primary/20 rounded-md cursor-pointer hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/20 transition-colors"
                  onClick={() => setPriorityFilter("all")}
                >
                  Priority: {priorityFilter}
                  <X className="size-3" />
                </Badge>
              )}
              {dateFilter !== "all" && (
                <Badge
                  variant="secondary"
                  className="h-6 text-[10px] font-semibold gap-1 pr-1.5 bg-primary/10 text-primary border border-primary/20 rounded-md cursor-pointer hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/20 transition-colors"
                  onClick={() => setDateFilter("all")}
                >
                  Timeline: {dateFilter.replace("_", " ")}
                  <X className="size-3" />
                </Badge>
              )}
              {deptFilter !== "all" && (
                <Badge
                  variant="secondary"
                  className="h-6 text-[10px] font-semibold gap-1 pr-1.5 bg-primary/10 text-primary border border-primary/20 rounded-md cursor-pointer hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/20 transition-colors"
                  onClick={() => setDeptFilter("all")}
                >
                  Dept: {allDepartments.find(d => d.id === deptFilter)?.name}
                  <X className="size-3" />
                </Badge>
              )}
              {hideCompleted && (
                <Badge
                  variant="secondary"
                  className="h-6 text-[10px] font-semibold gap-1 pr-1.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-md cursor-pointer hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/20 transition-colors"
                  onClick={() => setHideCompleted(false)}
                >
                  Hidden Completed
                  <X className="size-3" />
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="w-full">
        {viewMode === "list" ? (
          <>
            {filteredTasks.length > 0 ? (
              <>
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-muted/40 border-y border-border/70">
                      <tr>
                        <th
                          className="text-xs font-semibold text-muted-foreground text-left py-3 px-4 w-32.5 cursor-pointer hover:bg-muted/60 hover:text-foreground transition-colors select-none group"
                          onClick={() => handleSort("project")}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Project</span>
                            {sortConfig?.key === "project" ? (
                              sortConfig.direction === "asc" ? (
                                <ArrowUp className="size-3.5 text-primary shrink-0" />
                              ) : (
                                <ArrowDown className="size-3.5 text-primary shrink-0" />
                              )
                            ) : (
                              <ChevronsUpDown className="size-3.5 text-muted-foreground/40 group-hover:text-foreground/70 transition-colors shrink-0" />
                            )}
                          </div>
                        </th>
                        <th
                          className="text-xs font-semibold text-muted-foreground text-left py-3 px-2 w-55 cursor-pointer hover:bg-muted/60 hover:text-foreground transition-colors select-none group"
                          onClick={() => handleSort("name")}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Task</span>
                            {sortConfig?.key === "name" ? (
                              sortConfig.direction === "asc" ? (
                                <ArrowUp className="size-3.5 text-primary shrink-0" />
                              ) : (
                                <ArrowDown className="size-3.5 text-primary shrink-0" />
                              )
                            ) : (
                              <ChevronsUpDown className="size-3.5 text-muted-foreground/40 group-hover:text-foreground/70 transition-colors shrink-0" />
                            )}
                          </div>
                        </th>
                        <th
                          className="text-xs font-semibold text-muted-foreground text-left py-3 px-2 w-37.5 cursor-pointer hover:bg-muted/60 hover:text-foreground transition-colors select-none group"
                          onClick={() => handleSort("activity")}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Activity</span>
                            {sortConfig?.key === "activity" ? (
                              sortConfig.direction === "asc" ? (
                                <ArrowUp className="size-3.5 text-primary shrink-0" />
                              ) : (
                                <ArrowDown className="size-3.5 text-primary shrink-0" />
                              )
                            ) : (
                              <ChevronsUpDown className="size-3.5 text-muted-foreground/40 group-hover:text-foreground/70 transition-colors shrink-0" />
                            )}
                          </div>
                        </th>
                        <th
                          className="text-xs font-semibold text-muted-foreground text-left py-3 px-2 w-30 whitespace-nowrap cursor-pointer hover:bg-muted/60 hover:text-foreground transition-colors select-none group"
                          onClick={() => handleSort("assignedTo")}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Assigned To</span>
                            {sortConfig?.key === "assignedTo" ? (
                              sortConfig.direction === "asc" ? (
                                <ArrowUp className="size-3.5 text-primary shrink-0" />
                              ) : (
                                <ArrowDown className="size-3.5 text-primary shrink-0" />
                              )
                            ) : (
                              <ChevronsUpDown className="size-3.5 text-muted-foreground/40 group-hover:text-foreground/70 transition-colors shrink-0" />
                            )}
                          </div>
                        </th>
                        <th
                          className="text-xs font-semibold text-muted-foreground text-left py-3 px-2 w-20 cursor-pointer hover:bg-muted/60 hover:text-foreground transition-colors select-none group"
                          onClick={() => handleSort("priority")}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Priority</span>
                            {sortConfig?.key === "priority" ? (
                              sortConfig.direction === "asc" ? (
                                <ArrowUp className="size-3.5 text-primary shrink-0" />
                              ) : (
                                <ArrowDown className="size-3.5 text-primary shrink-0" />
                              )
                            ) : (
                              <ChevronsUpDown className="size-3.5 text-muted-foreground/40 group-hover:text-foreground/70 transition-colors shrink-0" />
                            )}
                          </div>
                        </th>
                        <th
                          className="text-xs font-semibold text-muted-foreground text-left py-3 px-2 w-27.5 cursor-pointer hover:bg-muted/60 hover:text-foreground transition-colors select-none group"
                          onClick={() => handleSort("status")}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Status</span>
                            {sortConfig?.key === "status" ? (
                              sortConfig.direction === "asc" ? (
                                <ArrowUp className="size-3.5 text-primary shrink-0" />
                              ) : (
                                <ArrowDown className="size-3.5 text-primary shrink-0" />
                              )
                            ) : (
                              <ChevronsUpDown className="size-3.5 text-muted-foreground/40 group-hover:text-foreground/70 transition-colors shrink-0" />
                            )}
                          </div>
                        </th>
                        <th className="text-xs font-semibold text-muted-foreground text-left py-3 px-2 w-30 whitespace-nowrap">Planned Schedule</th>
                        <th className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 text-left py-3 px-2 w-22.5 whitespace-nowrap">Actual End</th>
                        <th className="text-xs font-semibold text-muted-foreground text-center py-3 px-2 w-17.5">Progress</th>
                        <th className="text-xs font-semibold text-muted-foreground text-right py-3 px-4 w-12.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {paginatedTasks.map((task: any) => (
                        <tr
                          key={task.id}
                          className="hover:bg-muted/5 transition-colors cursor-pointer group border-b border-border/10"
                          onTouchStart={handleTouchStart}
                          onTouchMove={handleTouchMove}
                          onClick={() => handleTaskClickWithTouchCheck(task)}
                        >
                          <td className="py-2.5 px-4 text-[11px] font-bold text-foreground/80">
                            {task.projectId && !isExternal ? (
                              <Link
                                href={`/dashboard/projects/${task.projectId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:text-primary hover:underline transition-colors block w-full"
                              >
                                {task.project?.name || "Global"}
                              </Link>
                            ) : (
                              <span>{task.project?.name || "Global"}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2">
                            <div className="flex flex-col gap-0.5 overflow-hidden max-w-55">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {task.taskNumber && (
                                  <span className="text-[9px] font-black tabular-nums text-indigo-500/80 shrink-0">#{task.taskNumber}</span>
                                )}
                                <span className="text-[11px] font-bold text-primary group-hover:underline truncate">{task.name}</span>
                                {task.committedByOverride && (
                                  <span className="text-[8px] font-black uppercase tracking-widest px-1 py-0.5 rounded-xs bg-rose-50 border border-rose-100 text-rose-600 shrink-0" title="Force committed by Manager/TL">
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
                              {task.description && <span className="text-[10px] text-muted-foreground truncate">{stripHtml(task.description)}</span>}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-[11px] font-medium text-foreground/70 whitespace-nowrap">{task.activity || "-"}</td>
                          <td className="py-2.5 px-2 text-[11px] font-medium whitespace-nowrap">{task.assignedTo?.name || "Unassigned"}</td>
                          <td className="py-2.5 px-2">
                            <Badge variant="outline" className={cn("rounded-full border px-2 py-0 h-5 text-[9px] font-bold gap-1.5 shrink-0 transition-colors", task.priority === "URGENT" ? "text-rose-600 bg-rose-50 border-rose-100" : task.priority === "HIGH" ? "text-orange-600 bg-orange-50 border-orange-100" : task.priority === "MEDIUM" ? "text-amber-600 bg-amber-50 border-amber-100" : "text-emerald-600 bg-emerald-50 border-emerald-100")}>
                              {task.priority}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-2 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
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
                              {task.status === "IN_REVIEW" && (
                                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tight">
                                  {task.adminApproved ? "Admin Approved" :
                                    task.tlApproved ? "TL Approved · Awaiting Admin" :
                                      task.subTlApproved ? "Sub-TL Approved · Awaiting TL" :
                                        (task.department?.parentDepartmentId || task.reviewerId ? "Pending Sub-TL" : "Pending TL Approval")}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1" title="Start Date">
                                <span className="text-[9px] font-medium text-muted-foreground/60 w-7">Start:</span>
                                <span className="text-[10px] font-bold text-foreground/80 tabular-nums">
                                  {task.plannedStart ? format(new Date(task.plannedStart), "MMM d, yyyy") : "-"}
                                </span>
                              </div>
                              {(() => {
                                const isOverdue = task.status !== "COMPLETED" && task.plannedEnd && differenceInCalendarDays(new Date(task.plannedEnd), new Date()) < 0;
                                return (
                                  <div className={cn("flex items-center gap-1", isOverdue && "animate-pulse-soft")} title="Planned End">
                                    <span className={cn("text-[9px] font-medium w-7", isOverdue ? "text-rose-600" : "text-muted-foreground/60")}>End:</span>
                                    <span className={cn("text-[10px] font-bold tabular-nums", isOverdue ? "text-rose-600" : "text-foreground/80")}>
                                      {task.plannedEnd ? format(new Date(task.plannedEnd), "MMM d, yyyy") : "-"}
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-[10px] font-bold text-emerald-600 tabular-nums whitespace-nowrap">
                            {task.actualEnd ? format(new Date(task.actualEnd), "MMM d, yyyy") : "-"}
                          </td>
                          <td className="py-2.5 px-2">
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${task.progress}%` }} />
                              </div>
                              <span className="text-[10px] font-bold">{task.progress}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const isAssignee = task.assignedToId === currentUserId;
                              const isManager = task.assignedTo?.managerId === currentUserId;
                              const isDeptLeader = ledDepartmentIdsList.length > 0 && (
                                (task.departmentId && ledDepartmentIdsList.includes(task.departmentId)) ||
                                (task.assignedTo?.departmentId && ledDepartmentIdsList.includes(task.assignedTo.departmentId)) ||
                                (task.department?.parentDepartmentId && ledDepartmentIdsList.includes(task.department.parentDepartmentId)) ||
                                (task.assignedTo?.department?.parentDepartmentId && ledDepartmentIdsList.includes(task.assignedTo.department.parentDepartmentId))
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="lg:hidden grid grid-cols-1 gap-4 p-1 bg-muted/5 border-t border-border/10">
                  {paginatedTasks.map((task: any) => {
                    const isAssignee = task.assignedToId === currentUserId;
                    const isManager = task.assignedTo?.managerId === currentUserId;
                    const isDeptLeader = ledDepartmentIdsList.length > 0 && (
                      (task.departmentId && ledDepartmentIdsList.includes(task.departmentId)) ||
                      (task.assignedTo?.departmentId && ledDepartmentIdsList.includes(task.assignedTo.departmentId)) ||
                      (task.department?.parentDepartmentId && ledDepartmentIdsList.includes(task.department.parentDepartmentId)) ||
                      (task.assignedTo?.department?.parentDepartmentId && ledDepartmentIdsList.includes(task.assignedTo.department.parentDepartmentId))
                    );
                    const hasTaskAuthority = isAdmin || isDeptLeader || isManager;
                    const showActions = hasTaskAuthority || (isAssignee && !["COMPLETED", "IN_REVIEW"].includes(task.status));
                    const isOverdue = task.status !== "COMPLETED" && task.plannedEnd && differenceInCalendarDays(new Date(task.plannedEnd), new Date()) < 0;

                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "bg-card transition-all p-3.5 rounded-md border shadow-sm space-y-1 relative group",
                          task.status === "IN_REVIEW"
                            ? "border-amber-500 bg-amber-50/10 dark:bg-amber-950/20 shadow-md shadow-amber-500/5"
                            : "border-border/40"
                        )}
                      >
                        {/* Upper row: Project name & Actions */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[9px] font-extrabold text-muted-foreground/80 uppercase tracking-widest truncate max-w-50">
                            {task.projectId && !isExternal ? (
                              <Link
                                href={`/dashboard/projects/${task.projectId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:text-primary hover:underline transition-colors"
                              >
                                {task.project?.name || "Global"}
                              </Link>
                            ) : (
                              <span>{task.project?.name || "Global"}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {showActions && (
                              <TaskRowActions
                                task={task}
                                members={members}
                                allMembers={allMembers}
                              />
                            )}
                          </div>
                        </div>

                        {/* Title & description */}
                        <div
                          className="space-y-0.5 cursor-pointer group/title"
                          onTouchStart={handleTouchStart}
                          onTouchMove={handleTouchMove}
                          onClick={() => handleTaskClickWithTouchCheck(task)}
                        >
                          <div className="flex items-start gap-1.5 min-w-0">
                            {task.taskNumber && (
                              <span className="text-[9px] font-bold tabular-nums text-indigo-500/80 bg-indigo-50 dark:bg-indigo-950/30 px-1 py-0.5 rounded-xs shrink-0 mt-0.5">
                                #{task.taskNumber}
                              </span>
                            )}
                            <h4 className="text-[11px] font-bold text-primary leading-tight group-hover/title:underline line-clamp-2 flex-1">
                              {task.name}
                            </h4>
                            {task.committedByOverride && (
                              <span className="text-[8px] font-black uppercase tracking-widest px-1 py-0.5 rounded-xs bg-rose-50 border border-rose-100 text-rose-600 shrink-0">
                                Forced
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-[10px] text-muted-foreground line-clamp-2">
                              {stripHtml(task.description)}
                            </p>
                          )}
                        </div>
                        {/* Middle row: Assignee & Priority */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/10">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-medium text-muted-foreground">Assigned:</span>
                            <span className="text-[10px] font-bold text-foreground/80">{task.assignedTo?.name || "Unassigned"}</span>
                          </div>
                          <Badge variant="outline" className={cn("rounded-full border px-2 py-0 h-4 text-[8px] font-bold gap-1 transition-colors shrink-0", task.priority === "URGENT" ? "text-rose-600 bg-rose-50 border-rose-100" : task.priority === "HIGH" ? "text-orange-600 bg-orange-50 border-orange-100" : task.priority === "MEDIUM" ? "text-amber-600 bg-amber-50 border-amber-100" : "text-emerald-600 bg-emerald-50 border-emerald-100")}>
                            {task.priority}
                          </Badge>
                        </div>

                        {/* Bottom row: Status, Due/End date, Progress */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/10 items-end">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                              {task.lifecycleStatus === "PROPOSED" ? (
                                <div className="text-amber-600 font-bold flex items-center gap-1">
                                  <span className="text-[9px] uppercase tracking-widest">⏳ Proposed</span>
                                </div>
                              ) : task.lifecycleStatus === "NEGOTIATING" ? (
                                <div className="text-amber-500 font-bold flex items-center gap-1">
                                  <span className="text-[9px] uppercase tracking-widest">💬 Discussing</span>
                                </div>
                              ) : (
                                <TaskStatusBadge status={task.status} />
                              )}
                            </div>
                            <div className="text-[9px] font-bold tabular-nums">
                              {task.status === "COMPLETED" && task.actualEnd ? (
                                <span className="text-emerald-600 font-bold">End: {format(new Date(task.actualEnd), "dd MMM yy")}</span>
                              ) : task.plannedEnd ? (
                                <span className={cn(isOverdue ? "text-rose-600" : "text-muted-foreground/70")}>
                                  Due: {format(new Date(task.plannedEnd), "dd MMM yy")}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50">No Due Date</span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[9px] font-bold text-primary/80 tabular-nums">
                              {task.progress}%
                            </span>
                            <div className="w-full max-w-20 h-1 bg-muted rounded-full overflow-hidden border border-border/10">
                              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${task.progress}%` }} />
                            </div>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>

                <DataTablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(page) => setCurrentPage(page)}
                  totalItems={totalItems}
                  itemsPerPage={itemsPerPage}
                  onPageSizeChange={(size) => {
                    setItemsPerPage(size)
                    setCurrentPage(1)
                  }}
                  showOnlyNavigationOnMobile={true}
                />
              </>
            ) : (
              <div className="py-24 text-center">
                <div className="flex flex-col items-center gap-4 select-none">
                  <div className="size-16 rounded-full bg-muted/30 border-2 border-dashed border-border/40 flex items-center justify-center">
                    <CheckSquare className="size-8 text-muted-foreground/40" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground uppercase tracking-widest">No tasks found</p>
                    <p className="text-xs text-muted-foreground font-medium">
                      {activeFiltersCount > 0
                        ? "No tasks match your current filter criteria."
                        : "There are no tasks assigned in this workspace yet."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : viewMode === "board" ? (
          <div>
            <KanbanBoard
              initialTasks={filteredTasks}
              members={members}
              allMembers={allMembers}
              onTaskClick={setSelectedTask}
            />
          </div>
        ) : (
          <div className="h-187.5">
            <GanttChartView
              tasks={filteredTasks}
              members={members}
              onTaskClick={setSelectedTask}
              groupBy="project"
              isAdmin={isAdmin || isTL}
            />
          </div>
        )}
      </div>

      <TaskDetailsDialog
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTask(null)
            if (searchParams?.get("taskId")) {
              const newParams = new URLSearchParams(searchParams.toString())
              newParams.delete("taskId")
              const newQuery = newParams.toString()
              router.replace(newQuery ? `${pathname}?${newQuery}` : pathname)
            }
          }
        }}
        members={members}
        allMembers={allMembers}
      />
    </div>
  )
}
