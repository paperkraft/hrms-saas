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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDistanceToNow, format } from "date-fns"
import {
  History,
  Info,
  CheckCircle2,
  XCircle,
  PlayCircle,
  Trash2,
  Edit,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  FolderKanban,
  CheckSquare,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ActivityDeleteButton } from "@/components/features/projects/activity-delete-button"
import Link from "next/link"
import { bulkDeleteActivityLogs } from "@/actions/activity"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

type ActionFilter = "ALL" | "CREATE" | "UPDATE" | "STATUS" | "DELETE"

function getActionStyle(action: string) {
  const a = action.toUpperCase()
  if (a.includes("CREATE")) {
    return {
      color: "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
      icon: <CheckCircle2 className="size-3" />
    }
  }
  if (a.includes("UPDATE") || a.includes("EDIT")) {
    return {
      color: "text-blue-700 dark:text-blue-300 bg-blue-500/10 border-blue-500/25",
      icon: <Edit className="size-3" />
    }
  }
  if (a.includes("DELETE") || a.includes("REMOVE")) {
    return {
      color: "text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/25",
      icon: <Trash2 className="size-3" />
    }
  }
  if (a.includes("APPROVE")) {
    return {
      color: "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
      icon: <CheckCircle2 className="size-3" />
    }
  }
  if (a.includes("REJECT")) {
    return {
      color: "text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/25",
      icon: <XCircle className="size-3" />
    }
  }
  if (a.includes("STATUS")) {
    return {
      color: "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/25",
      icon: <PlayCircle className="size-3" />
    }
  }
  return {
    color: "text-slate-700 dark:text-slate-300 bg-slate-500/10 border-slate-500/25",
    icon: <Info className="size-3" />
  }
}

export function ActivityTableClient({
  logs,
  isArchive,
  sortBy,
  sortOrder,
  page,
  totalPages,
  pageSize,
  total,
}: {
  logs: any[]
  isArchive: boolean
  sortBy: string
  sortOrder: string
  page: number
  totalPages: number
  pageSize: number
  total: number
}) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [actionFilter, setActionFilter] = useState<ActionFilter>("ALL")

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredLogs.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredLogs.map(log => log.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} activity logs?`)) return

    setIsDeleting(true)
    const result = await bulkDeleteActivityLogs(selectedIds)
    if (result.success) {
      toast.success(`${selectedIds.length} logs deleted successfully`)
      setSelectedIds([])
      router.refresh()
    } else {
      toast.error(result.error || "Failed to delete logs")
    }
    setIsDeleting(false)
  }

  // Filter logs locally based on search and action tab
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Action filter
      if (actionFilter === "CREATE" && !log.action.toUpperCase().includes("CREATE")) return false
      if (actionFilter === "UPDATE" && !(log.action.toUpperCase().includes("UPDATE") || log.action.toUpperCase().includes("EDIT"))) return false
      if (actionFilter === "STATUS" && !log.action.toUpperCase().includes("STATUS")) return false
      if (actionFilter === "DELETE" && !(log.action.toUpperCase().includes("DELETE") || log.action.toUpperCase().includes("REMOVE"))) return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const userName = log.user?.name?.toLowerCase() || ""
        const userEmail = log.user?.email?.toLowerCase() || ""
        const action = log.action?.toLowerCase() || ""
        const projectName = log.project?.name?.toLowerCase() || ""
        const taskName = log.task?.name?.toLowerCase() || ""
        const details = log.details?.toLowerCase() || ""

        return userName.includes(q) || userEmail.includes(q) || action.includes(q) || projectName.includes(q) || taskName.includes(q) || details.includes(q)
      }

      return true
    })
  }, [logs, actionFilter, searchQuery])

  const SortableHeader = ({ field, label, className = "" }: { field: string, label: string, className?: string }) => {
    const isSorted = sortBy === field
    const newSortOrder = isSorted && sortOrder === "asc" ? "desc" : "asc"
    const href = `?tab=${isArchive ? "archive" : "active"}&page=1&sortBy=${field}&sortOrder=${newSortOrder}`

    return (
      <TableHead className={cn("text-xs font-semibold py-3.5 hover:bg-muted/50 transition-colors", className)}>
        <Link href={href} className="flex items-center gap-1.5 w-full h-full">
          {label}
          {isSorted ? (
            sortOrder === "asc" ? <ArrowUp className="size-3 text-primary" /> : <ArrowDown className="size-3 text-primary" />
          ) : (
            <ArrowUpDown className="size-3 text-muted-foreground/50 hover:text-muted-foreground" />
          )}
        </Link>
      </TableHead>
    )
  }

  return (
    <div className="space-y-3">
      {/* ── Search & Action Filters Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-md border border-border/80 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by user, action, project, task, details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-background/80 border-border/70 focus:bg-background rounded-md"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground p-1 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Action Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <Button
            variant={actionFilter === "ALL" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActionFilter("ALL")}
            className="h-8 text-xs font-medium rounded-md px-2.5 cursor-pointer"
          >
            All
          </Button>
          <Button
            variant={actionFilter === "CREATE" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActionFilter("CREATE")}
            className="h-8 text-xs font-medium rounded-md px-2.5 text-emerald-600 dark:text-emerald-400 cursor-pointer"
          >
            Create
          </Button>
          <Button
            variant={actionFilter === "UPDATE" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActionFilter("UPDATE")}
            className="h-8 text-xs font-medium rounded-md px-2.5 text-blue-600 dark:text-blue-400 cursor-pointer"
          >
            Update
          </Button>
          <Button
            variant={actionFilter === "STATUS" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActionFilter("STATUS")}
            className="h-8 text-xs font-medium rounded-md px-2.5 text-amber-600 dark:text-amber-400 cursor-pointer"
          >
            Status
          </Button>
          <Button
            variant={actionFilter === "DELETE" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActionFilter("DELETE")}
            className="h-8 text-xs font-medium rounded-md px-2.5 text-rose-600 dark:text-rose-400 cursor-pointer"
          >
            Delete
          </Button>
        </div>
      </div>

      {/* ── Bulk Delete Banner ── */}
      {!isArchive && selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3.5 bg-destructive/10 border border-destructive/20 rounded-md animate-fade-in">
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="text-xs rounded-sm">
              {selectedIds.length}
            </Badge>
            <span className="text-xs font-semibold text-foreground">activity logs selected</span>
          </div>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleBulkDelete}
            disabled={isDeleting}
            className="h-8 px-3 text-xs font-semibold gap-1.5 cursor-pointer rounded-md shadow-xs"
          >
            <Trash2 className="size-3.5" />
            {isDeleting ? "Deleting..." : "Delete Selected"}
          </Button>
        </div>
      )}

      {/* ── Main Activity Logs Table ── */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40 border-b border-border/70">
              <TableRow className="hover:bg-transparent">
                {!isArchive && (
                  <TableHead className="w-[44px] px-4 py-3.5">
                    <Checkbox 
                      checked={filteredLogs.length > 0 && selectedIds.length === filteredLogs.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                )}
                <SortableHeader field="createdAt" label="Timestamp" className={cn("w-[170px]", isArchive ? "px-4" : "")} />
                <SortableHeader field="user" label="User Identity" className="w-[200px]" />
                <SortableHeader field="action" label="Action" className="w-[140px]" />
                <TableHead className="text-xs font-semibold py-3.5">Entity & Details</TableHead>
                {!isArchive && (
                  <TableHead className="text-xs font-semibold py-3.5 w-[70px] text-right pr-4">Action</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log: any) => {
                const style = getActionStyle(log.action)
                const isSelected = selectedIds.includes(log.id)

                return (
                  <TableRow 
                    key={log.id} 
                    className={cn(
                      "group hover:bg-muted/30 transition-colors border-b border-border/60 last:border-0",
                      isSelected && "bg-primary/5"
                    )}
                  >
                    {!isArchive && (
                      <TableCell className="px-4 py-3.5">
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(log.id)}
                          aria-label="Select row"
                        />
                      </TableCell>
                    )}
                    
                    {/* Timestamp */}
                    <TableCell className={cn("py-3.5", isArchive ? "px-4" : "")}>
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-foreground tabular-nums">
                          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {format(new Date(log.createdAt), "MMM dd, yyyy • HH:mm")}
                        </div>
                      </div>
                    </TableCell>

                    {/* User Identity */}
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8 rounded-full border border-border shrink-0">
                          {log.user?.avatarUrl && (
                            <AvatarImage src={log.user.avatarUrl} alt={log.user.name || "User"} className="object-cover" />
                          )}
                          <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                            {log.user?.name ? log.user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-foreground truncate max-w-[150px]">
                            {log.user?.name || "System User"}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                            {log.user?.email || "No email"}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Action Badge */}
                    <TableCell className="py-3.5">
                      <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm gap-1.5 border shadow-none", style.color)}>
                        {style.icon}
                        <span>{log.action.replace(/_/g, " ")}</span>
                      </Badge>
                    </TableCell>

                    {/* Entity & Details */}
                    <TableCell className="py-3.5">
                      <div className="space-y-1 max-w-xl">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {log.project && (
                            <Badge variant="secondary" className="text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 rounded-sm h-5 gap-1">
                              <FolderKanban className="size-3" />
                              <span>Project: {log.project.name}</span>
                            </Badge>
                          )}
                          {log.task && (
                            <Badge variant="secondary" className="text-[10px] font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 rounded-sm h-5 gap-1">
                              <CheckSquare className="size-3" />
                              <span>Task: {log.task.name}</span>
                            </Badge>
                          )}
                        </div>
                        <p
                          className="text-xs text-muted-foreground font-medium leading-relaxed italic line-clamp-2"
                          title={log.details}
                        >
                          &ldquo;{log.details}&rdquo;
                        </p>
                      </div>
                    </TableCell>

                    {/* Actions */}
                    {!isArchive && (
                      <TableCell className="py-3.5 text-right pr-4">
                        <ActivityDeleteButton id={log.id} />
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}

              {filteredLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isArchive ? 4 : 6} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center space-y-3">
                      <div className="size-12 rounded-md bg-muted/60 text-muted-foreground flex items-center justify-center">
                        <History className="size-6 text-muted-foreground/60" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-foreground">No activity recorded</h3>
                        <p className="text-xs text-muted-foreground">
                          {searchQuery || actionFilter !== "ALL"
                            ? "No activity logs matched your current filter criteria."
                            : "Activities will appear here as your team interacts with projects and tasks."}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Pagination Footer ── */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-border/70 bg-muted/20">
            <p className="text-xs text-muted-foreground font-medium">
              Showing <span className="font-bold text-foreground">{(page - 1) * pageSize + 1}</span> to{" "}
              <span className="font-bold text-foreground">{Math.min(page * pageSize, total)}</span> of{" "}
              <span className="font-bold text-foreground">{total}</span> entries
            </p>
            <div className="flex items-center gap-1.5">
              {page > 1 ? (
                <Link 
                  href={`?tab=${isArchive ? "archive" : "active"}&sortBy=${sortBy}&sortOrder=${sortOrder}&page=${page - 1}`}
                  className="px-3 py-1.5 rounded-md border border-border/80 text-xs font-semibold hover:bg-muted transition-colors"
                >
                  Previous
                </Link>
              ) : (
                <span className="px-3 py-1.5 rounded-md border border-border/40 text-xs font-semibold text-muted-foreground/40 cursor-not-allowed">
                  Previous
                </span>
              )}
              
              <span className="text-xs font-medium text-muted-foreground px-2">
                Page {page} of {totalPages}
              </span>

              {page < totalPages ? (
                <Link 
                  href={`?tab=${isArchive ? "archive" : "active"}&sortBy=${sortBy}&sortOrder=${sortOrder}&page=${page + 1}`}
                  className="px-3 py-1.5 rounded-md border border-border/80 text-xs font-semibold hover:bg-muted transition-colors"
                >
                  Next
                </Link>
              ) : (
                <span className="px-3 py-1.5 rounded-md border border-border/40 text-xs font-semibold text-muted-foreground/40 cursor-not-allowed">
                  Next
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
