"use client"

import { useState, useMemo } from "react"
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TaskMasterRowActions } from "./task-master-row-actions"
import { usePagination } from "@/hooks/use-pagination"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
  Clock,
  ListChecks,
  Tag,
  Layers,
  Sparkles,
  CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface TaskMasterTableClientProps {
  taskMasters: any[]
  departments: any[]
}

type SortConfig = {
  key: string
  direction: "asc" | "desc" | null
} | null

export function TaskMasterTableClient({ taskMasters, departments }: TaskMasterTableClientProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDeptId, setSelectedDeptId] = useState<string>("ALL")
  const [sortConfig, setSortConfig] = useState<SortConfig>(null)

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" | null = "asc"
    if (sortConfig && sortConfig.key === key) {
      if (sortConfig.direction === "asc") direction = "desc"
      else if (sortConfig.direction === "desc") direction = null
    }
    setSortConfig(direction ? { key, direction } : null)
  }

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="ml-1.5 size-3 text-muted-foreground/40 inline-block" />
    if (sortConfig.direction === "asc") return <ArrowUp className="ml-1.5 size-3 text-primary inline-block" />
    return <ArrowDown className="ml-1.5 size-3 text-primary inline-block" />
  }

  const [durationFilter, setDurationFilter] = useState<"ALL" | "FIXED" | "CONTINUOUS">("ALL")

  // Only top-level departments (no parentDepartmentId)
  const topLevelDepartments = useMemo(() => {
    return (departments || []).filter((d) => !d.parentDepartmentId)
  }, [departments])

  // Helper map: for each top-level dept, get its ID and all its descendant sub-dept IDs
  const deptHierarchyMap = useMemo(() => {
    const map = new Map<string, string[]>()
    
    topLevelDepartments.forEach((topDept) => {
      const subDeptIds: string[] = []
      const findDescendants = (parentId: string) => {
        const children = (departments || []).filter((d) => d.parentDepartmentId === parentId)
        children.forEach((c) => {
          subDeptIds.push(c.id)
          findDescendants(c.id)
        })
      }
      findDescendants(topDept.id)
      map.set(topDept.id, [topDept.id, ...subDeptIds])
    })

    return map
  }, [departments, topLevelDepartments])

  // Filter & sort data
  const processedData = useMemo(() => {
    let data = [...(taskMasters || [])]

    // Department preset filter (Includes top-level department + any of its sub-department templates)
    if (selectedDeptId !== "ALL") {
      const allowedDeptIds = deptHierarchyMap.get(selectedDeptId) || [selectedDeptId]
      data = data.filter((tm) => tm.departmentId && allowedDeptIds.includes(tm.departmentId))
    }

    // Duration filter
    if (durationFilter === "FIXED") {
      data = data.filter((tm) => tm.defaultDurationDays && tm.defaultDurationDays > 0)
    } else if (durationFilter === "CONTINUOUS") {
      data = data.filter((tm) => !tm.defaultDurationDays || tm.defaultDurationDays === 0)
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      data = data.filter((tm) =>
        tm.name.toLowerCase().includes(q) ||
        (tm.activity || "General").toLowerCase().includes(q) ||
        (tm.department?.name || "Global").toLowerCase().includes(q)
      )
    }

    if (sortConfig) {
      data.sort((a, b) => {
        let valA: any = ""
        let valB: any = ""

        if (sortConfig.key === "name") {
          valA = a.name.toLowerCase()
          valB = b.name.toLowerCase()
        } else if (sortConfig.key === "activity") {
          valA = (a.activity || "General").toLowerCase()
          valB = (b.activity || "General").toLowerCase()
        } else if (sortConfig.key === "duration") {
          valA = a.defaultDurationDays ?? 0
          valB = b.defaultDurationDays ?? 0
        } else if (sortConfig.key === "department") {
          valA = (a.department?.name || "Global").toLowerCase()
          valB = (b.department?.name || "Global").toLowerCase()
        }

        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1
        return 0
      })
    }

    return data
  }, [taskMasters, selectedDeptId, deptHierarchyMap, durationFilter, searchQuery, sortConfig])

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems,
    totalItems,
    itemsPerPage,
  } = usePagination(processedData, 15)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  const selectedDepartmentName = useMemo(() => {
    if (selectedDeptId === "ALL") return "All Departments"
    const dept = topLevelDepartments.find((d) => d.id === selectedDeptId) || departments.find((d) => d.id === selectedDeptId)
    return dept?.name || "Selected Department"
  }, [selectedDeptId, topLevelDepartments, departments])

  return (
    <div className="space-y-4">
      {/* ── Search & Filter Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-md border border-border/80 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={`Search within ${selectedDepartmentName}...`}
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-9 h-9 text-xs bg-background/80 border-border/70 focus:bg-background rounded-md"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("")
                setCurrentPage(1)
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground p-1 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Quick Department Chips Toolbar - Top-Level Only */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <Button
            variant={selectedDeptId === "ALL" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setSelectedDeptId("ALL")
              setCurrentPage(1)
            }}
            className="h-8 text-xs font-medium rounded-md px-2.5 cursor-pointer"
          >
            All ({taskMasters.length})
          </Button>

          {topLevelDepartments.map((dept) => {
            const allowedDeptIds = deptHierarchyMap.get(dept.id) || [dept.id]
            const count = (taskMasters || []).filter((t) => t.departmentId && allowedDeptIds.includes(t.departmentId)).length
            const isSelected = selectedDeptId === dept.id
            return (
              <Button
                key={dept.id}
                variant={isSelected ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setSelectedDeptId(dept.id)
                  setCurrentPage(1)
                }}
                className={cn(
                  "h-8 text-xs font-medium rounded-md px-2.5 cursor-pointer whitespace-nowrap",
                  isSelected && "text-primary font-bold"
                )}
              >
                {dept.name} ({count})
              </Button>
            )
          })}
        </div>
      </div>

      {/* ── Main Templates Table ── */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40 border-b border-border/70">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[60px] text-xs font-semibold py-3.5 px-4 text-center">#</TableHead>
                <TableHead
                  className="text-xs font-semibold py-3.5 cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center">
                    <span>Task Template Name</span>
                    {getSortIcon("name")}
                  </div>
                </TableHead>
                <TableHead
                  className="text-xs font-semibold py-3.5 cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort("activity")}
                >
                  <div className="flex items-center">
                    <span>Activity Type</span>
                    {getSortIcon("activity")}
                  </div>
                </TableHead>
                <TableHead
                  className="text-xs font-semibold py-3.5 text-center cursor-pointer select-none hover:bg-muted/50 transition-colors w-[150px]"
                  onClick={() => handleSort("duration")}
                >
                  <div className="flex items-center justify-center">
                    <span>Default Duration</span>
                    {getSortIcon("duration")}
                  </div>
                </TableHead>
                <TableHead
                  className="text-xs font-semibold py-3.5 cursor-pointer select-none hover:bg-muted/50 transition-colors w-[180px]"
                  onClick={() => handleSort("department")}
                >
                  <div className="flex items-center">
                    <span>Department</span>
                    {getSortIcon("department")}
                  </div>
                </TableHead>
                <TableHead className="text-xs font-semibold py-3.5 text-right px-4 w-[90px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((tm: any, index: number) => {
                const isContinuous = !tm.defaultDurationDays || tm.defaultDurationDays === 0
                return (
                  <TableRow
                    key={tm.id}
                    className="group hover:bg-muted/30 transition-colors border-b border-border/60 last:border-0"
                  >
                    <TableCell className="font-mono text-xs font-bold text-muted-foreground/80 px-4 py-3 text-center">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </TableCell>

                    {/* Task Name */}
                    <TableCell className="py-3 max-w-[240px] sm:max-w-md">
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <ListChecks className="size-3.5" />
                        </div>
                        <span className="font-semibold text-xs text-foreground tracking-tight truncate" title={tm.name}>
                          {tm.name}
                        </span>
                      </div>
                    </TableCell>

                    {/* Activity */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1.5">
                        <Tag className="size-3 text-muted-foreground/60 shrink-0" />
                        <span className="text-xs font-medium text-muted-foreground">
                          {tm.activity || "General Activity"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Default Duration */}
                    <TableCell className="text-center py-3">
                      {isContinuous ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-bold px-2 py-0.5 bg-muted text-muted-foreground border-border/60 rounded-sm"
                        >
                          Continuous
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs font-semibold px-2.5 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 rounded-sm gap-1"
                        >
                          <Clock className="size-3" />
                          <span>{tm.defaultDurationDays} {tm.defaultDurationDays === 1 ? "Day" : "Days"}</span>
                        </Badge>
                      )}
                    </TableCell>

                    {/* Department */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-bold px-2 py-0.5 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25 rounded-sm gap-1"
                        >
                          <Building2 className="size-3" />
                          <span>{tm.department?.name || "Global / Universal"}</span>
                        </Badge>
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right px-4 py-3">
                      <TaskMasterRowActions taskMaster={tm} departments={departments} />
                    </TableCell>
                  </TableRow>
                )
              })}

              {paginatedItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center space-y-3">
                      <div className="size-12 rounded-md bg-muted/60 text-muted-foreground flex items-center justify-center">
                        <ListChecks className="size-6 text-muted-foreground/60" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-foreground">No templates found</h3>
                        <p className="text-xs text-muted-foreground">
                          {searchQuery || selectedDeptId !== "ALL"
                            ? `No task templates found in ${selectedDepartmentName} matching "${searchQuery}".`
                            : "Create your first standardized task template or import via Excel."}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Pagination ── */}
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
        />
      </div>
    </div>
  )
}
