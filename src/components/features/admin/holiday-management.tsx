"use client"

import { useState, useMemo } from "react"
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Loader2,
  PartyPopper,
  Search,
  Clock,
  Sparkles,
  CalendarCheck,
  CalendarDays,
  X,
  AlertCircle,
  Pencil
} from "lucide-react"
import { format, isToday, isFuture, isPast, differenceInCalendarDays } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addHoliday, updateHoliday, deleteHoliday } from "@/actions/holiday"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Holiday {
  id: string;
  name: string;
  date: Date;
}

interface HolidayManagementProps {
  initialHolidays: any[];
}

export function HolidayManagement({ initialHolidays }: HolidayManagementProps) {
  const [holidays, setHolidays] = useState<Holiday[]>(
    initialHolidays.map(h => ({ ...h, date: new Date(h.date) }))
  )
  const [name, setName] = useState("")
  const [date, setDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UPCOMING" | "PAST">("ALL")

  // Edit State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null)
  const [editName, setEditName] = useState("")
  const [editDate, setEditDate] = useState("")
  const [isEditing, setIsEditing] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !date) return

    setLoading(true)
    const res = await addHoliday(name, new Date(date))
    if (res.success && res.data) {
      setHolidays(prev => [...prev, { ...res.data, date: new Date(res.data.date) }].sort((a, b) => a.date.getTime() - b.date.getTime()))
      setName("")
      setDate("")
      toast.success(`Holiday "${name}" added to calendar!`)
    } else {
      toast.error(res.error || "Failed to add holiday")
    }
    setLoading(false)
  }

  const openEditModal = (holiday: Holiday) => {
    setEditingHoliday(holiday)
    setEditName(holiday.name)
    setEditDate(format(new Date(holiday.date), "yyyy-MM-dd"))
    setEditModalOpen(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingHoliday || !editName || !editDate) return

    setIsEditing(true)
    const res = await updateHoliday(editingHoliday.id, editName, new Date(editDate))
    if (res.success && res.data) {
      setHolidays(prev =>
        prev
          .map(h => (h.id === editingHoliday.id ? { ...res.data, date: new Date(res.data.date) } : h))
          .sort((a, b) => a.date.getTime() - b.date.getTime())
      )
      toast.success(`Holiday "${editName}" updated successfully!`)
      setEditModalOpen(false)
      setEditingHoliday(null)
    } else {
      toast.error(res.error || "Failed to update holiday")
    }
    setIsEditing(false)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const res = await deleteHoliday(id)
    if (res.success) {
      setHolidays(prev => prev.filter(h => h.id !== id))
      toast.success("Holiday removed from company calendar")
    } else {
      toast.error(res.error || "Failed to delete holiday")
    }
    setDeletingId(null)
  }

  // Filtered & Sorted Holidays
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const upcomingCount = holidays.filter(h => {
    const d = new Date(h.date)
    d.setHours(0, 0, 0, 0)
    return d.getTime() >= now.getTime()
  }).length

  const pastCount = holidays.length - upcomingCount

  const nextHoliday = useMemo(() => {
    const upcoming = holidays
      .filter(h => {
        const d = new Date(h.date)
        d.setHours(0, 0, 0, 0)
        return d.getTime() >= now.getTime()
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime())
    return upcoming[0] || null
  }, [holidays])

  const filteredHolidays = useMemo(() => {
    return holidays
      .filter(h => {
        const matchesSearch = h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          format(h.date, "MMMM yyyy").toLowerCase().includes(searchTerm.toLowerCase())

        const hDate = new Date(h.date)
        hDate.setHours(0, 0, 0, 0)

        const isUpcoming = hDate.getTime() >= now.getTime()
        const matchesStatus =
          statusFilter === "ALL" ? true :
          statusFilter === "UPCOMING" ? isUpcoming : !isUpcoming

        return matchesSearch && matchesStatus
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [holidays, searchTerm, statusFilter])

  const getHolidayRelativeBadge = (hDate: Date) => {
    const d = new Date(hDate)
    d.setHours(0, 0, 0, 0)
    const diff = differenceInCalendarDays(d, now)

    if (diff === 0) {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 animate-pulse">
          Today
        </span>
      )
    } else if (diff === 1) {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 border border-sky-500/20">
          Tomorrow
        </span>
      )
    } else if (diff > 1) {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
          In {diff} days
        </span>
      )
    } else {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground border border-border/60">
          Passed
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
            <span className="text-xs font-semibold text-muted-foreground block">Total Holidays</span>
            <span className="text-xl font-bold tracking-tight text-foreground font-mono mt-1 block">
              {holidays.length}
            </span>
          </div>
          <div className="p-2.5 rounded-md bg-primary/10 text-primary border border-primary/20">
            <CalendarDays className="size-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-md p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground block">Upcoming Holidays</span>
            <span className="text-xl font-bold tracking-tight text-emerald-600 font-mono mt-1 block">
              {upcomingCount}
            </span>
          </div>
          <div className="p-2.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <CalendarCheck className="size-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-md p-4 shadow-2xs flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <span className="text-xs font-semibold text-muted-foreground block">Next Recognized Holiday</span>
            <span className="text-xs font-bold text-foreground truncate mt-1 block" title={nextHoliday?.name || "None"}>
              {nextHoliday ? `${nextHoliday.name} (${format(nextHoliday.date, "dd MMM")})` : "No upcoming holidays"}
            </span>
          </div>
          <div className="p-2.5 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0">
            <Sparkles className="size-5" />
          </div>
        </div>
      </div>

      {/* ── Add Holiday Form Card ── */}
      <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-border/70 flex items-center gap-3 bg-card">
          <div className="size-8 rounded-md flex items-center justify-center border border-primary/20 bg-primary/10 text-primary shrink-0">
            <Plus className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Add Public Holiday</h3>
            <p className="text-xs text-muted-foreground font-medium">Register company-wide calendar exclusions and paid holidays</p>
          </div>
        </div>

        <div className="p-5">
          <form onSubmit={handleAdd} className="flex flex-col md:flex-row items-end gap-3.5">
            <div className="flex-1 space-y-1.5 w-full">
              <label className="text-xs font-semibold text-foreground">Holiday Name</label>
              <Input
                placeholder="e.g. Independence Day, Diwali, Christmas"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 bg-background border-border/80 rounded-md text-xs font-medium focus:ring-primary/20"
                required
              />
            </div>
            <div className="flex-1 space-y-1.5 w-full">
              <label className="text-xs font-semibold text-foreground">Holiday Date</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 bg-background border-border/80 rounded-md text-xs font-medium focus:ring-primary/20"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading || !name || !date}
              className="h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-md shadow-xs shrink-0 cursor-pointer gap-1.5 w-full md:w-auto"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              <span>Add Holiday</span>
            </Button>
          </form>
        </div>
      </div>

      {/* ── Holiday Schedule & Filter Bar ── */}
      <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-border/70 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 bg-card">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-md flex items-center justify-center border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 shrink-0">
              <CalendarIcon className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Holiday Schedule</h3>
              <p className="text-xs text-muted-foreground font-medium">Master registry of officially recognized holidays</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
              <Input
                placeholder="Search holidays or month..."
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

            {/* Filter Pills */}
            <div className="flex items-center bg-muted/40 p-1 rounded-md border border-border/70">
              {[
                { value: "ALL", label: "All" },
                { value: "UPCOMING", label: "Upcoming" },
                { value: "PAST", label: "Past" },
              ].map((st) => (
                <button
                  key={st.value}
                  onClick={() => setStatusFilter(st.value as any)}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                    statusFilter === st.value
                      ? "bg-card text-foreground font-bold shadow-xs border border-border/60"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Holiday Cards List ── */}
        {filteredHolidays.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center gap-2 opacity-40">
            <PartyPopper className="size-8 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider">No holidays found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-muted/10">
            {filteredHolidays.map((holiday) => (
              <div
                key={holiday.id}
                className="p-3.5 rounded-md border border-border/80 bg-card shadow-2xs hover:border-primary/40 hover:shadow-xs transition-all flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-12 rounded-md bg-primary/10 border border-primary/20 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold uppercase text-primary leading-none">{format(holiday.date, "MMM")}</span>
                    <span className="text-base font-bold text-primary leading-none mt-0.5">{format(holiday.date, "dd")}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate" title={holiday.name}>
                      {holiday.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {format(holiday.date, "EEEE, yyyy")}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      {getHolidayRelativeBadge(holiday.date)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-transparent hover:border-border/60 rounded-md cursor-pointer transition-colors"
                    onClick={() => openEditModal(holiday)}
                    title="Edit Holiday"
                  >
                    <Pencil className="size-3.5" />
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-md cursor-pointer transition-colors"
                        disabled={deletingId === holiday.id}
                        title="Delete Holiday"
                      >
                        {deletingId === holiday.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-md border border-border/80 shadow-2xl max-w-sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-sm font-bold text-rose-600 flex items-center gap-2">
                          <AlertCircle className="size-4" />
                          Delete Holiday?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-muted-foreground">
                          Are you sure you want to remove <strong>{holiday.name}</strong> ({format(holiday.date, "dd MMMM yyyy")}) from the public holiday calendar?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="h-9 text-xs font-semibold rounded-md border-border/80">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(holiday.id)}
                          className="h-9 text-xs font-semibold rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Holiday
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Edit Holiday Dialog ── */}
      <Dialog
        open={editModalOpen}
        onOpenChange={(open) => {
          setEditModalOpen(open)
          if (!open) {
            setEditingHoliday(null)
          }
        }}
      >
        <DialogContent className="rounded-md border border-border/80 shadow-2xl max-w-sm p-5">
          <form onSubmit={handleUpdate} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <div className="size-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Pencil className="size-3.5" />
                </div>
                Edit Public Holiday
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Modify the holiday title or recognized calendar date.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Holiday Name</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Republic Day"
                  className="h-9 text-xs bg-background border-border/80 rounded-md focus:ring-primary/20"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Holiday Date</label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="h-9 text-xs bg-background border-border/80 rounded-md focus:ring-primary/20"
                  required
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditModalOpen(false)}
                className="h-9 text-xs font-semibold rounded-md border-border/80"
                disabled={isEditing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isEditing || !editName || !editDate}
                className="h-9 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
              >
                {isEditing ? <Loader2 className="size-3.5 animate-spin" /> : null}
                <span>Save Changes</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
