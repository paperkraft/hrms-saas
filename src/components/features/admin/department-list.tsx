"use client"

import { getInitials } from "@/lib/utils";
import { useState, useMemo } from "react"
import {
  Users,
  Users2,
  Building2,
  Pencil,
  Trash2,
  Search,
  X,
  Crown,
  Layers,
  Loader2
} from "lucide-react"
import { deleteDepartment, syncDepartmentLeadersAsReportingManagers } from "@/actions/department"
import { EditDepartmentDialog } from "./edit-department-dialog"
import { DepartmentDetailsDialog } from "./department-details-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export function DepartmentList({
  departments,
  users,
  canEdit
}: {
  departments: any[],
  users: { id: string, name: string | null, email: string }[];
  canEdit?: boolean;
}) {
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null)
  const [viewingDeptId, setViewingDeptId] = useState<string | null>(null)
  const [deletingDeptId, setDeletingDeptId] = useState<string | null>(null)
  const [fallbackDepartmentId, setFallbackDepartmentId] = useState<string>("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [hierarchyFilter, setHierarchyFilter] = useState<"ALL" | "TOP_LEVEL" | "SUB_DEPT">("ALL")
  const canEditMode = canEdit ?? true;

  async function handleSyncLeaders() {
    setIsSyncing(true)
    try {
      const res = await syncDepartmentLeadersAsReportingManagers()
      if (res.success) {
        toast.success(`Reporting lines synced successfully (${res.count} members linked to department leaders)`)
      } else {
        toast.error(res.error || "Failed to sync reporting lines")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to sync reporting lines")
    } finally {
      setIsSyncing(false)
    }
  }

  const editingDept = departments.find(d => d.id === editingDeptId) || null
  const viewingDept = departments.find(d => d.id === viewingDeptId) || null
  const deletingDept = departments.find(d => d.id === deletingDeptId) || null

  const deletingDeptMemberCount = deletingDept
    ? (deletingDept.members?.length || deletingDept._count?.members || 0)
    : 0

  async function handleDeleteDepartment() {
    if (!deletingDeptId) return

    if (deletingDeptMemberCount > 0 && !fallbackDepartmentId) {
      toast.error("Please select a fallback department to transfer members.")
      return
    }

    setIsDeleting(true)
    try {
      const res = await deleteDepartment(deletingDeptId, fallbackDepartmentId || undefined)
      if (!res.success) {
        toast.error(res.error)
      } else {
        toast.success("Department deleted and members transferred successfully")
        setDeletingDeptId(null)
        setFallbackDepartmentId("")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete department")
    } finally {
      setIsDeleting(false)
    }
  }

  // Filtered Departments
  const filteredDepartments = useMemo(() => {
    return departments.filter(d => {
      const term = searchTerm.toLowerCase()
      const matchesSearch = d.name.toLowerCase().includes(term) ||
        (d.description && d.description.toLowerCase().includes(term)) ||
        (d.parentDepartment?.name && d.parentDepartment.name.toLowerCase().includes(term)) ||
        (d.teamLeader?.name && d.teamLeader.name.toLowerCase().includes(term))

      const matchesHierarchy = hierarchyFilter === "ALL" ? true :
        hierarchyFilter === "TOP_LEVEL" ? !d.parentDepartmentId :
          !!d.parentDepartmentId

      return matchesSearch && matchesHierarchy
    })
  }, [departments, searchTerm, hierarchyFilter])

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Main Container & Filter Toolbar ── */}
      <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-border/70 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 bg-card">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-md flex items-center justify-center border border-primary/20 bg-primary/10 text-primary shrink-0">
              <Building2 className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Department Registry</h3>
              <p className="text-xs text-muted-foreground font-medium">Browse units, team leaders, and assigned employees</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
              <Input
                placeholder="Search departments or leaders..."
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
                { value: "TOP_LEVEL", label: "Top-Level" },
                { value: "SUB_DEPT", label: "Sub-Units" },
              ].map((st) => (
                <button
                  key={st.value}
                  onClick={() => setHierarchyFilter(st.value as any)}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                    hierarchyFilter === st.value
                      ? "bg-card text-foreground font-bold shadow-xs border border-border/60"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Sync Reporting Lines Button */}
            {canEditMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncLeaders}
                disabled={isSyncing}
                className="h-8 px-2.5 text-xs font-semibold rounded-md border-border/80 gap-1.5 shadow-2xs hover:bg-muted cursor-pointer shrink-0"
                title="Sync all designated department leaders as reporting managers for their members"
              >
                {isSyncing ? (
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                ) : (
                  <Users2 className="size-3.5 text-primary" />
                )}
                <span className="hidden sm:inline">Sync Reporting Lines</span>
              </Button>
            )}
          </div>
        </div>

        {/* ── Mobile Cards List View ── */}
        <div className="block md:hidden p-4 space-y-3 bg-muted/10">
          {filteredDepartments.map((dept) => (
            <div
              key={dept.id}
              onClick={() => setViewingDeptId(dept.id)}
              className="bg-card border border-border/80 rounded-md p-4 shadow-2xs hover:border-primary/40 transition-all cursor-pointer space-y-3"
            >
              {/* Top Info Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="size-9 rounded-md shrink-0 border border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs flex items-center justify-center size-full">
                      {getInitials(dept.name || "")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground leading-none truncate">{dept.name}</p>
                    {dept.parentDepartment && (
                      <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 mt-1 inline-flex items-center gap-1">
                        <Layers className="size-3 text-purple-600" /> Parent: {dept.parentDepartment.name}
                      </span>
                    )}
                    {dept.teamLeader ? (
                      <p className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
                        <Crown className="size-3" /> {dept.parentDepartment ? "Sub-TL" : "TL"}: {dept.teamLeader.name}
                      </p>
                    ) : dept.parentDepartment?.teamLeader ? (
                      <p className="text-[10px] text-indigo-600 font-medium mt-1 flex items-center gap-1">
                        <Crown className="size-3 text-indigo-500" /> Parent TL: {dept.parentDepartment.teamLeader.name}
                      </p>
                    ) : null}
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted/50 text-foreground border border-border/70 shrink-0">
                  {dept._count?.members || dept.members?.length || 0} staff
                </span>
              </div>

              {/* Department Description in Mobile */}
              {dept.description && (
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {dept.description}
                </p>
              )}

              {/* Member Avatar Stack row */}
              <div className="flex items-center justify-between pt-2.5 border-t border-border/60">
                <span className="text-xs font-medium text-muted-foreground">
                  Team Members
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {dept.members && dept.members.length > 0 ? (
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {dept.members.slice(0, 4).map((m: any) => (
                        <Avatar key={m.id} className="size-7 rounded-full shrink-0 border-2 border-card">
                          {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name || ""} className="object-cover rounded-full" />}
                          <AvatarFallback className="bg-muted text-muted-foreground text-[8px] font-bold uppercase rounded-full flex items-center justify-center size-full">
                            {m.name ? m.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "EM"}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {dept.members.length > 4 && (
                        <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold border-2 border-card select-none">
                          +{dept.members.length - 4}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">No staff assigned</span>
                  )}
                </div>
              </div>

              {/* Actions Button row */}
              {canEditMode && (
                <div
                  className="flex items-center justify-end gap-1.5 pt-2.5 border-t border-border/60"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs font-semibold text-muted-foreground hover:text-sky-600 hover:bg-sky-500/10 rounded-md transition-all gap-1"
                    onClick={() => setEditingDeptId(dept.id)}
                    title="Edit Department"
                  >
                    <Pencil className="size-3.5" />
                    <span>Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 rounded-md transition-all gap-1"
                    onClick={() => {
                      setDeletingDeptId(dept.id)
                      setFallbackDepartmentId("")
                    }}
                    title="Delete Department"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Delete</span>
                  </Button>
                </div>
              )}
            </div>
          ))}

          {filteredDepartments.length === 0 && (
            <div className="py-16 text-center flex flex-col items-center gap-2 opacity-40">
              <Building2 className="size-8 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider">No departments found</p>
            </div>
          )}
        </div>

        {/* ── Desktop Table View ── */}
        <div className="hidden md:block overflow-x-auto scrollbar-hide">
          <table className="w-full border-collapse text-left">
            <thead className="bg-muted/30 border-b border-border/70 text-xs font-bold text-muted-foreground">
              <tr>
                <th className="py-3 px-5 whitespace-nowrap">Department Unit</th>
                <th className="py-3 px-4 whitespace-nowrap">Hierarchy & Leadership</th>
                <th className="py-3 px-4 whitespace-nowrap">Members Preview</th>
                {canEditMode && <th className="py-3 px-5 text-right whitespace-nowrap">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-xs">
              {filteredDepartments.map((dept) => (
                <tr
                  key={dept.id}
                  onClick={() => setViewingDeptId(dept.id)}
                  className="hover:bg-muted/10 transition-colors group cursor-pointer"
                >
                  {/* Department Name */}
                  <td className="py-3.5 px-5">
                    <div className="flex items-start gap-3 min-w-[200px] max-w-[320px]">
                      <Avatar className="size-9 rounded-full shrink-0 mt-0.5">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs flex items-center justify-center size-full">
                          {getInitials(dept.name || "")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                            {dept.name}
                          </p>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                            #{dept.id.slice(-4).toUpperCase()}
                          </span>
                        </div>
                        {dept.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 leading-tight" title={dept.description}>
                            {dept.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Hierarchy & Leadership */}
                  <td className="py-3.5 px-4">
                    <div className="space-y-1 min-w-[180px]">
                      {dept.parentDepartment ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 inline-flex items-center gap-1">
                          <Layers className="size-2.5 text-purple-600" /> Parent: {dept.parentDepartment.name}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground border border-border/60 inline-flex items-center gap-1">
                          Top-Level Unit
                        </span>
                      )}

                      {dept.teamLeader ? (
                        <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1.5">
                          <Crown className="size-3" />
                          <span>{dept.parentDepartment ? "Sub-TL" : "TL"}: {dept.teamLeader.name}</span>
                        </div>
                      ) : dept.parentDepartment?.teamLeader ? (
                        <div className="text-[11px] text-indigo-600 font-medium flex items-center gap-1.5">
                          <Crown className="size-3 text-indigo-500" />
                          <span>Parent TL: {dept.parentDepartment.teamLeader.name}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/60 italic block">No leader designated</span>
                      )}
                    </div>
                  </td>

                  {/* Member Count & Avatars */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5 min-w-[140px]">
                      {dept.members && dept.members.length > 0 ? (
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {dept.members.slice(0, 3).map((m: any) => (
                            <Avatar key={m.id} className="size-7 rounded-full shrink-0 border-2 border-card">
                              {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name || ""} className="object-cover rounded-full" />}
                              <AvatarFallback className="bg-muted text-muted-foreground text-[8px] font-bold uppercase rounded-full flex items-center justify-center size-full">
                                {m.name ? m.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "EM"}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {dept.members.length > 3 && (
                            <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold border-2 border-card select-none">
                              +{dept.members.length - 3}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Users className="size-4 text-muted-foreground/40" />
                      )}
                      <span className="text-xs font-semibold text-muted-foreground font-mono">
                        ({dept._count?.members || dept.members?.length || 0})
                      </span>
                    </div>
                  </td>

                  {/* Actions */}
                  {canEditMode && (
                    <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-sky-600 hover:bg-sky-500/10 border border-transparent hover:border-sky-500/20 rounded-md cursor-pointer transition-all"
                          onClick={() => setEditingDeptId(dept.id)}
                          title="Edit Department"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-md cursor-pointer transition-all"
                          onClick={() => {
                            setDeletingDeptId(dept.id)
                            setFallbackDepartmentId("")
                          }}
                          title="Delete Department"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}

              {filteredDepartments.length === 0 && (
                <tr>
                  <td colSpan={canEditMode ? 4 : 3} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <Building2 className="size-8 text-muted-foreground" />
                      <p className="text-xs font-semibold uppercase tracking-wider">No departments found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EditDepartmentDialog
        department={editingDept}
        users={users}
        departments={departments}
        onClose={() => setEditingDeptId(null)}
      />

      <DepartmentDetailsDialog
        department={viewingDept}
        onClose={() => setViewingDeptId(null)}
      />

      {/* ── Delete Department & User Transfer Dialog ── */}
      <Dialog open={Boolean(deletingDeptId)} onOpenChange={(open) => { if (!open) setDeletingDeptId(null); }}>
        <DialogContent className="sm:max-w-md w-[95vw] rounded-md border border-border/80 shadow-2xl bg-card p-0 overflow-hidden">
          <DialogHeader className="p-5 border-b border-border/70 bg-card">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-md flex items-center justify-center border border-rose-500/20 bg-rose-500/10 text-rose-600 shrink-0">
                <Trash2 className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold tracking-tight text-rose-600">
                  Delete Department: {deletingDept?.name}
                </DialogTitle>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  Permanent removal and staff reallocation
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to delete this department? This action cannot be reversed.
            </p>

            {deletingDept && deletingDeptMemberCount > 0 && (
              <div className="space-y-3">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs text-amber-700 dark:text-amber-300 font-medium">
                  This department currently has <strong>{deletingDeptMemberCount} member(s)</strong>. Select a fallback department to transfer them to before deleting.
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Transfer Members To:</label>
                  <select
                    value={fallbackDepartmentId}
                    onChange={e => setFallbackDepartmentId(e.target.value)}
                    className="w-full h-9 rounded-md border border-border/80 bg-background px-3 text-xs font-medium focus:ring-primary/20"
                    required
                  >
                    <option value="">-- Select Fallback Department --</option>
                    {departments.filter(d => d.id !== deletingDept.id).map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
              <Button
                variant="outline"
                className="h-9 px-4 text-xs font-semibold rounded-md border-border/80 cursor-pointer"
                onClick={() => setDeletingDeptId(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="h-9 px-5 text-xs font-semibold rounded-md shadow-xs cursor-pointer gap-1.5"
                onClick={handleDeleteDepartment}
                disabled={isDeleting || (deletingDeptMemberCount > 0 && !fallbackDepartmentId)}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Transferring & Deleting...</span>
                  </>
                ) : (
                  "Confirm Delete"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
