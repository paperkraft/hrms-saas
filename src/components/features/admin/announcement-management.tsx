"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Megaphone,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Info,
  AlertTriangle,
  Globe,
  Calendar,
  User as UserIcon,
  PenIcon,
  Search,
  X,
  Building2,
  Radio,
  Sparkles,
  Layers
} from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createAnnouncement, deleteAnnouncement, updateAnnouncement } from "@/actions/announcement"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { AnnouncementPriority } from "@prisma/client"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { RichTextViewer } from "@/components/ui/rich-text-viewer"
import { toast } from "sonner"

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  targetDepartmentId?: string | null;
  isActive: boolean;
  createdAt: Date;
  author: { name: string | null; email: string };
  targetDepartment?: { name: string } | null;
}

interface AnnouncementManagementProps {
  initialAnnouncements: Announcement[];
  departments: { id: string; name: string }[];
}

export function AnnouncementManagement({ initialAnnouncements, departments }: AnnouncementManagementProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>(
    initialAnnouncements.map(a => ({ ...a, createdAt: new Date(a.createdAt) }))
  )
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | "INFO" | "WARNING" | "CRITICAL">("ALL")
  const [deptFilter, setDeptFilter] = useState("ALL")
  const router = useRouter()

  useEffect(() => {
    setAnnouncements(initialAnnouncements.map(a => ({ ...a, createdAt: new Date(a.createdAt) })))
  }, [initialAnnouncements])

  const [editingId, setEditingId] = useState<string | null>(null)

  // Form State
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [priority, setPriority] = useState<AnnouncementPriority>("INFO")
  const [targetDept, setTargetDept] = useState("all")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !content) return

    setLoading(true)
    if (editingId) {
      const res = await updateAnnouncement(editingId, {
        title,
        content,
        priority,
        targetDepartmentId: targetDept === "all" ? undefined : targetDept,
      })

      if (res.success) {
        toast.success("Announcement updated successfully!")
        handleCancelEdit()
        router.refresh()
      } else {
        toast.error(res.error || "Failed to update announcement")
      }
    } else {
      const res = await createAnnouncement({
        title,
        content,
        priority,
        targetDepartmentId: targetDept === "all" ? undefined : targetDept,
      })

      if (res.success && res.data) {
        toast.success("Announcement broadcasted successfully!")
        setTitle("")
        setContent("")
        setPriority("INFO")
        setTargetDept("all")
        router.refresh()
      } else {
        toast.error(res.error || "Failed to create announcement")
      }
    }
    setLoading(false)
  }

  const handleEdit = (a: Announcement) => {
    setEditingId(a.id)
    setTitle(a.title)
    setContent(a.content)
    setPriority(a.priority)
    setTargetDept(a.targetDepartmentId || "all")
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setTitle("")
    setContent("")
    setPriority("INFO")
    setTargetDept("all")
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const res = await deleteAnnouncement(id)
    if (res.success) {
      setAnnouncements(prev => prev.filter(a => a.id !== id))
      toast.success("Announcement deleted successfully!")
    } else {
      toast.error(res.error || "Failed to delete announcement")
    }
    setDeletingId(null)
  }

  // Summary Metrics
  const criticalCount = announcements.filter(a => a.priority === "CRITICAL").length
  const warningCount = announcements.filter(a => a.priority === "WARNING").length
  const targetedDeptCount = announcements.filter(a => a.targetDepartmentId).length

  // Filtered Announcements
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter(a => {
      const term = searchTerm.toLowerCase()
      const matchesSearch = a.title.toLowerCase().includes(term) ||
        a.content.toLowerCase().includes(term) ||
        (a.author?.name && a.author.name.toLowerCase().includes(term))

      const matchesPriority = priorityFilter === "ALL" ? true : a.priority === priorityFilter
      const matchesDept = deptFilter === "ALL" ? true :
        deptFilter === "ORG_WIDE" ? !a.targetDepartmentId :
        a.targetDepartmentId === deptFilter

      return matchesSearch && matchesPriority && matchesDept
    })
  }, [announcements, searchTerm, priorityFilter, deptFilter])

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "CRITICAL":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 border border-rose-500/20 inline-flex items-center gap-1">
            <AlertCircle className="size-3" /> Critical
          </span>
        )
      case "WARNING":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 inline-flex items-center gap-1">
            <AlertTriangle className="size-3" /> Warning
          </span>
        )
      case "INFO":
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 inline-flex items-center gap-1">
            <Info className="size-3" /> Information
          </span>
        )
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Summary Counters ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border/80 rounded-md p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground block">Total Broadcasts</span>
            <span className="text-xl font-bold tracking-tight text-foreground font-mono mt-1 block">
              {announcements.length}
            </span>
          </div>
          <div className="p-2.5 rounded-md bg-primary/10 text-primary border border-primary/20">
            <Megaphone className="size-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-md p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground block">Critical / Warnings</span>
            <span className="text-xl font-bold tracking-tight text-rose-600 font-mono mt-1 block">
              {criticalCount + warningCount}
            </span>
          </div>
          <div className="p-2.5 rounded-md bg-rose-500/10 text-rose-600 border border-rose-500/20">
            <AlertCircle className="size-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-md p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground block">Department Targeted</span>
            <span className="text-xl font-bold tracking-tight text-purple-600 font-mono mt-1 block">
              {targetedDeptCount}
            </span>
          </div>
          <div className="p-2.5 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20">
            <Building2 className="size-5" />
          </div>
        </div>
      </div>

      {/* ── Broadcast Form Card ── */}
      <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-border/70 flex items-center justify-between bg-card">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-md flex items-center justify-center border border-primary/20 bg-primary/10 text-primary shrink-0">
              <Radio className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">
                {editingId ? "Edit Announcement" : "Broadcast Announcement"}
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                {editingId ? "Update existing announcement contents and audience" : "Publish organization-wide or department-specific news"}
              </p>
            </div>
          </div>

          {editingId && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
              Editing Mode
            </span>
          )}
        </div>

        <div className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              <div className="space-y-1.5 md:col-span-6">
                <label className="text-xs font-semibold text-foreground">Announcement Title</label>
                <Input
                  placeholder="e.g. Office maintenance schedule, Team quarterly review"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9 bg-background border-border/80 rounded-md text-xs font-medium focus:ring-primary/20"
                  required
                />
              </div>

              <div className="space-y-1.5 md:col-span-3">
                <label className="text-xs font-semibold text-foreground">Priority Level</label>
                <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                  <SelectTrigger className="w-full h-9 bg-background border-border/80 rounded-md text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-md border-border/80">
                    <SelectItem value="INFO" className="text-xs">
                      <div className="flex items-center gap-1.5 text-sky-600">
                        <Info className="size-3.5" /> Info
                      </div>
                    </SelectItem>
                    <SelectItem value="WARNING" className="text-xs">
                      <div className="flex items-center gap-1.5 text-amber-600">
                        <AlertTriangle className="size-3.5" /> Warning
                      </div>
                    </SelectItem>
                    <SelectItem value="CRITICAL" className="text-xs">
                      <div className="flex items-center gap-1.5 text-rose-600">
                        <AlertCircle className="size-3.5" /> Critical
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 md:col-span-3">
                <label className="text-xs font-semibold text-foreground">Target Audience</label>
                <Select value={targetDept} onValueChange={setTargetDept}>
                  <SelectTrigger className="w-full h-9 bg-background border-border/80 rounded-md text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-md border-border/80">
                    <SelectItem value="all" className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <Globe className="size-3.5 text-primary" /> All Departments
                      </div>
                    </SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id} className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="size-3.5 text-muted-foreground" /> {d.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Message Content</label>
              <RichTextEditor
                placeholder="Write full announcement details..."
                value={content}
                onChange={setContent}
                className="min-h-[120px] bg-background border border-border/80 rounded-md text-xs font-medium shadow-none focus-within:ring-2 focus-within:ring-primary/10 focus-within:border-primary/40"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-1">
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                  className="h-9 px-5 font-semibold text-xs rounded-md border-border/80 cursor-pointer"
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={loading || !title || !content}
                className="h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-md shadow-xs transition-colors cursor-pointer gap-1.5"
              >
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <>{editingId ? "Update Announcement" : <><Plus className="size-3.5" /> Publish Announcement</>}</>}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Announcements Registry & Filter Toolbar ── */}
      <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-border/70 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 bg-card">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-md flex items-center justify-center border border-sky-500/20 bg-sky-500/10 text-sky-600 shrink-0">
              <Globe className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Announcement Registry</h3>
              <p className="text-xs text-muted-foreground font-medium">Active broadcasts across the organization</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
              <Input
                placeholder="Search announcements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-8 text-xs bg-background border-border/80 rounded-md focus:ring-primary/20"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded-md transition-colors cursor-pointer"
                >
                  <X className="size-3 text-muted-foreground/50" />
                </button>
              )}
            </div>

            {/* Priority Filter Pills */}
            <div className="flex items-center bg-muted/40 p-1 rounded-md border border-border/70">
              {[
                { value: "ALL", label: "All" },
                { value: "INFO", label: "Info" },
                { value: "WARNING", label: "Warning" },
                { value: "CRITICAL", label: "Critical" },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriorityFilter(p.value as any)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                    priorityFilter === p.value
                      ? "bg-card text-foreground font-bold shadow-xs border border-border/60"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Department Filter */}
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="h-8 text-xs font-semibold bg-background border-border/80 rounded-md min-w-[130px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent className="rounded-md border-border/80">
                <SelectItem value="ALL" className="text-xs">All Audiences</SelectItem>
                <SelectItem value="ORG_WIDE" className="text-xs">Company-wide</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Announcements List ── */}
        <div className="divide-y divide-border/40">
          {filteredAnnouncements.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center gap-2 opacity-40">
              <Megaphone className="size-8 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider">No announcements found</p>
            </div>
          ) : (
            filteredAnnouncements.map((a) => (
              <div
                key={a.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row items-start gap-3.5 transition-all group hover:bg-muted/10 relative"
              >
                <div className="flex items-start gap-3 w-full sm:w-auto">
                  <div className={cn(
                    "mt-0.5 size-8 rounded-md flex items-center justify-center shrink-0 border",
                    a.priority === "CRITICAL" && "bg-rose-500/10 text-rose-600 border-rose-500/20",
                    a.priority === "WARNING" && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                    a.priority === "INFO" && "bg-sky-500/10 text-sky-600 border-sky-500/20",
                  )}>
                    {a.priority === "CRITICAL" && <AlertCircle className="size-4 text-rose-600" />}
                    {a.priority === "WARNING" && <AlertTriangle className="size-4 text-amber-600" />}
                    {a.priority === "INFO" && <Info className="size-4 text-sky-600" />}
                  </div>

                  {/* Mobile Header Title */}
                  <div className="flex sm:hidden flex-1 flex-col gap-1 pr-14">
                    <h4 className="text-xs font-bold tracking-tight text-foreground">
                      {a.title}
                    </h4>
                    <div className="flex items-center gap-2 flex-wrap">
                      {getPriorityBadge(a.priority)}
                      {a.targetDepartment ? (
                        <span className="w-fit px-2 py-0.5 rounded-md bg-purple-500/10 text-[10px] font-semibold text-purple-700 dark:text-purple-300 border border-purple-500/20">
                          {a.targetDepartment.name}
                        </span>
                      ) : (
                        <span className="w-fit px-2 py-0.5 rounded-md bg-muted/50 text-[10px] font-semibold text-muted-foreground border border-border/60">
                          All Staff
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-1.5 min-w-0 w-full mt-1 sm:mt-0">
                  {/* Desktop Header Title */}
                  <div className="hidden sm:flex items-center gap-2.5 flex-wrap">
                    <h4 className="text-sm font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                      {a.title}
                    </h4>
                    {getPriorityBadge(a.priority)}
                    {a.targetDepartment ? (
                      <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-[10px] font-semibold text-purple-700 dark:text-purple-300 border border-purple-500/20 inline-flex items-center gap-1">
                        <Building2 className="size-2.5" /> {a.targetDepartment.name}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-muted/50 text-[10px] font-semibold text-muted-foreground border border-border/60 inline-flex items-center gap-1">
                        <Globe className="size-2.5" /> All Staff
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground leading-relaxed font-medium pt-0.5">
                    <RichTextViewer content={a.content} />
                  </div>

                  <div className="flex flex-wrap items-center gap-3.5 pt-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                      <Calendar className="size-3 text-muted-foreground/70" />
                      {format(new Date(a.createdAt), "PPP p")}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                      <UserIcon className="size-3 text-muted-foreground/70" />
                      By {a.author?.name || "System"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 absolute top-4 right-4 sm:relative sm:top-0 sm:right-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-sky-600 hover:bg-sky-500/10 border border-transparent hover:border-sky-500/20 rounded-md cursor-pointer transition-all"
                    onClick={() => handleEdit(a)}
                    title="Edit Announcement"
                  >
                    <PenIcon className="size-3.5" />
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-md cursor-pointer transition-all"
                        disabled={deletingId === a.id}
                        title="Delete Announcement"
                      >
                        {deletingId === a.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-md border border-border/80 shadow-2xl max-w-sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-sm font-bold text-rose-600 flex items-center gap-2">
                          <AlertCircle className="size-4" />
                          Delete Announcement?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-muted-foreground">
                          Are you sure you want to delete <strong>&quot;{a.title}&quot;</strong>? This announcement will be removed from all staff dashboard feeds.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="h-9 text-xs font-semibold rounded-md border-border/80">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(a.id)}
                          className="h-9 text-xs font-semibold rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Broadcast
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
