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
import { Priority } from "@prisma/client"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { RichTextViewer } from "@/components/ui/rich-text-viewer"
import { toast } from "sonner"

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: Priority;
  departmentId?: string | null;
  targetDepartmentId?: string | null;
  createdAt: Date;
  creator?: { name: string | null; email: string };
  author?: { name: string | null; email: string };
  department?: { name: string } | null;
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
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | Priority>("ALL")
  const [deptFilter, setDeptFilter] = useState("ALL")
  const router = useRouter()

  useEffect(() => {
    setAnnouncements(initialAnnouncements.map(a => ({ ...a, createdAt: new Date(a.createdAt) })))
  }, [initialAnnouncements])

  const [editingId, setEditingId] = useState<string | null>(null)

  // Form State
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [priority, setPriority] = useState<Priority>("LOW")
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
        departmentId: targetDept === "all" ? undefined : targetDept,
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
        departmentId: targetDept === "all" ? undefined : targetDept,
      })

      if (res.success && res.data) {
        toast.success("Announcement broadcasted successfully!")
        setTitle("")
        setContent("")
        setPriority("LOW")
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
    setTargetDept(a.departmentId || a.targetDepartmentId || "all")
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setTitle("")
    setContent("")
    setPriority("LOW")
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
  const urgentCount = announcements.filter(a => a.priority === "URGENT").length
  const highCount = announcements.filter(a => a.priority === "HIGH").length
  const targetedDeptCount = announcements.filter(a => a.departmentId || a.targetDepartmentId).length

  // Filtered Announcements
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter(a => {
      const authorName = a.creator?.name || a.author?.name || ""
      const term = searchTerm.toLowerCase()
      const deptId = a.departmentId || a.targetDepartmentId
      const matchesSearch = a.title.toLowerCase().includes(term) ||
        a.content.toLowerCase().includes(term) ||
        authorName.toLowerCase().includes(term)

      const matchesPriority = priorityFilter === "ALL" ? true : a.priority === priorityFilter
      const matchesDept = deptFilter === "ALL" ? true :
        deptFilter === "ORG_WIDE" ? !deptId :
        deptId === deptFilter

      return matchesSearch && matchesPriority && matchesDept
    })
  }, [announcements, searchTerm, priorityFilter, deptFilter])

  const getPriorityBadge = (p: Priority) => {
    switch (p) {
      case "URGENT":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 border border-rose-500/20 inline-flex items-center gap-1">
            <AlertCircle className="size-3" /> Urgent
          </span>
        )
      case "HIGH":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 inline-flex items-center gap-1">
            <AlertTriangle className="size-3" /> High
          </span>
        )
      case "MEDIUM":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 inline-flex items-center gap-1">
            <Info className="size-3" /> Medium
          </span>
        )
      case "LOW":
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20 inline-flex items-center gap-1">
            <Info className="size-3" /> Low
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
            <span className="text-xs font-semibold text-muted-foreground block">Urgent Alerts</span>
            <span className="text-xl font-bold tracking-tight text-rose-600 font-mono mt-1 block">
              {urgentCount}
            </span>
          </div>
          <div className="p-2.5 rounded-md bg-rose-500/10 text-rose-600 border border-rose-500/20">
            <AlertCircle className="size-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-md p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground block">Dept-Specific Broadcasts</span>
            <span className="text-xl font-bold tracking-tight text-purple-600 font-mono mt-1 block">
              {targetedDeptCount}
            </span>
          </div>
          <div className="p-2.5 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20">
            <Building2 className="size-5" />
          </div>
        </div>
      </div>

      {/* ── Create / Edit Form ── */}
      <div className="bg-card border border-border/80 rounded-md shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-border/70 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-md bg-primary/10 text-primary border border-primary/20">
              {editingId ? <PenIcon className="size-4" /> : <Plus className="size-4" />}
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
                <Select value={priority} onValueChange={(v: Priority) => setPriority(v)}>
                  <SelectTrigger className="w-full h-9 bg-background border-border/80 rounded-md text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-md border-border/80">
                    <SelectItem value="LOW" className="text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Info className="size-3.5" /> Low / General
                      </div>
                    </SelectItem>
                    <SelectItem value="MEDIUM" className="text-xs">
                      <div className="flex items-center gap-1.5 text-sky-600">
                        <Info className="size-3.5" /> Medium
                      </div>
                    </SelectItem>
                    <SelectItem value="HIGH" className="text-xs">
                      <div className="flex items-center gap-1.5 text-amber-600">
                        <AlertTriangle className="size-3.5" /> High / Important
                      </div>
                    </SelectItem>
                    <SelectItem value="URGENT" className="text-xs">
                      <div className="flex items-center gap-1.5 text-rose-600">
                        <AlertCircle className="size-3.5" /> Urgent
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
                          <Building2 className="size-3.5 text-purple-600" /> {d.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Announcement Message</label>
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Compose full announcement details, bullet points, links or instructions..."
                className="min-h-[140px] bg-background border-border/80 rounded-md text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/50">
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="h-8.5 px-3.5 text-xs font-semibold rounded-md border-border/80"
                >
                  Cancel Edit
                </Button>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={loading || !title || !content}
                className="h-8.5 px-4 text-xs font-semibold rounded-md bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs gap-1.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>{editingId ? "Updating..." : "Publishing..."}</span>
                  </>
                ) : (
                  <>
                    <Megaphone className="size-3.5" />
                    <span>{editingId ? "Update Notice" : "Broadcast Notice"}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Feed & Filter Header ── */}
      <div className="bg-card border border-border/80 rounded-md shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/10">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Broadcast History & Feed</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 sm:w-48">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs bg-background border-border/80 rounded-md"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Priority Filter */}
            <Select value={priorityFilter} onValueChange={(v: any) => setPriorityFilter(v)}>
              <SelectTrigger className="h-8 w-28 text-xs bg-background border-border/80 rounded-md font-medium">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent className="rounded-md border-border/80">
                <SelectItem value="ALL" className="text-xs">All Priorities</SelectItem>
                <SelectItem value="URGENT" className="text-xs text-rose-600 font-semibold">Urgent</SelectItem>
                <SelectItem value="HIGH" className="text-xs text-amber-600 font-semibold">High</SelectItem>
                <SelectItem value="MEDIUM" className="text-xs text-sky-600 font-semibold">Medium</SelectItem>
                <SelectItem value="LOW" className="text-xs text-slate-600 font-semibold">Low</SelectItem>
              </SelectContent>
            </Select>

            {/* Dept Filter */}
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="h-8 w-32 text-xs bg-background border-border/80 rounded-md font-medium">
                <SelectValue placeholder="Audience" />
              </SelectTrigger>
              <SelectContent className="rounded-md border-border/80">
                <SelectItem value="ALL" className="text-xs">All Audiences</SelectItem>
                <SelectItem value="ORG_WIDE" className="text-xs">🏢 All Staff</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">📍 {d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Feed List */}
        <div className="divide-y divide-border/60">
          {filteredAnnouncements.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center gap-2 opacity-40">
              <Megaphone className="size-8 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider">No announcements found</p>
            </div>
          ) : (
            filteredAnnouncements.map((a) => {
              const deptName = a.department?.name || a.targetDepartment?.name
              const authorName = a.creator?.name || a.author?.name || "System"
              return (
                <div
                  key={a.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-start gap-3.5 transition-all group hover:bg-muted/10 relative"
                >
                  <div className="flex items-start gap-3 w-full sm:w-auto">
                    <div className={cn(
                      "mt-0.5 size-8 rounded-md flex items-center justify-center shrink-0 border",
                      a.priority === "URGENT" && "bg-rose-500/10 text-rose-600 border-rose-500/20",
                      a.priority === "HIGH" && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                      a.priority === "MEDIUM" && "bg-sky-500/10 text-sky-600 border-sky-500/20",
                      a.priority === "LOW" && "bg-slate-500/10 text-slate-600 border-slate-500/20",
                    )}>
                      {a.priority === "URGENT" && <AlertCircle className="size-4 text-rose-600" />}
                      {a.priority === "HIGH" && <AlertTriangle className="size-4 text-amber-600" />}
                      {a.priority === "MEDIUM" && <Info className="size-4 text-sky-600" />}
                      {a.priority === "LOW" && <Info className="size-4 text-slate-600" />}
                    </div>

                    {/* Mobile Header Title */}
                    <div className="flex sm:hidden flex-1 flex-col gap-1 pr-14">
                      <h4 className="text-xs font-bold tracking-tight text-foreground">
                        {a.title}
                      </h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        {getPriorityBadge(a.priority)}
                        {deptName ? (
                          <span className="w-fit px-2 py-0.5 rounded-md bg-purple-500/10 text-[10px] font-semibold text-purple-700 dark:text-purple-300 border border-purple-500/20">
                            {deptName}
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
                      {deptName ? (
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-[10px] font-semibold text-purple-700 dark:text-purple-300 border border-purple-500/20 inline-flex items-center gap-1">
                          <Building2 className="size-2.5" /> {deptName}
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
                        By {authorName}
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
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
