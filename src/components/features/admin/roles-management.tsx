"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"
import {
  Shield,
  ShieldCheck,
  Plus,
  Edit,
  Trash2,
  Lock,
  Calculator,
  Users,
  KeyRound,
  CheckCircle2,
  Layers,
  Sparkles,
  Globe
} from "lucide-react"
import { createRole, updateRole, deleteRole } from "@/actions/roles"
import { AVAILABLE_MENUS } from "@/config/navigation"
import { toast } from "sonner"

interface RoleItem {
  id: string
  name: string
  code: string
  description: string | null
  isSystem: boolean
  isPayrollEligible: boolean
  isExternal?: boolean
  allowedMenus: string[]
  permissions?: string[]
  _count: {
    users: number
  }
}

export function RolesManagement({ initialRoles }: { initialRoles: RoleItem[] }) {
  const router = useRouter()
  const [roles, setRoles] = useState<RoleItem[]>(initialRoles)
  const [loading, setLoading] = useState(false)

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null)

  // Form States
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [description, setDescription] = useState("")
  const [isPayrollEligible, setIsPayrollEligible] = useState(true)
  const [isExternal, setIsExternal] = useState(false)
  const [allowedMenus, setAllowedMenus] = useState<string[]>([])
  const [fallbackRoleId, setFallbackRoleId] = useState("")

  const openCreateDialog = () => {
    setName("")
    setCode("")
    setDescription("")
    setIsPayrollEligible(true)
    setIsExternal(false)
    // Default allowed menus to base essential items
    setAllowedMenus([
      "/dashboard",
      "/dashboard/attendance",
      "/dashboard/leaves",
      "/dashboard/profile",
      "/dashboard/projects",
      "/dashboard/holidays",
      "/dashboard/notices",
      "/dashboard/policies"
    ])
    setIsCreateOpen(true)
  }

  const openEditDialog = (role: RoleItem) => {
    setSelectedRole(role)
    setName(role.name)
    setCode(role.code)
    setDescription(role.description || "")
    setIsPayrollEligible(role.isPayrollEligible ?? true)
    setIsExternal(role.isExternal ?? (role.code.includes("EXTERNAL") || role.name.toLowerCase().includes("external")))
    setAllowedMenus(role.allowedMenus || [])
    setIsEditOpen(true)
  }

  const openDeleteDialog = (role: RoleItem) => {
    setSelectedRole(role)
    setFallbackRoleId("")
    setIsDeleteOpen(true)
  }

  const handleToggleMenu = (path: string) => {
    setAllowedMenus(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    )
  }

  const handleSelectAllGroup = (groupPaths: string[]) => {
    const isAllSelected = groupPaths.every(p => allowedMenus.includes(p))
    if (isAllSelected) {
      setAllowedMenus(prev => prev.filter(p => !groupPaths.includes(p)))
    } else {
      setAllowedMenus(prev => Array.from(new Set([...prev, ...groupPaths])))
    }
  }

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !code) {
      toast.error("Role Name and Code are required")
      return
    }

    setLoading(true)
    const res = await createRole({
      name,
      code,
      description,
      isPayrollEligible,
      isExternal,
      allowedMenus,
      permissions: []
    })
    setLoading(false)

    if (res.success && res.data) {
      const created = res.data
      setRoles(prev => [...prev, {
        id: created.id,
        name: created.name,
        code: created.code,
        description: created.description,
        isSystem: created.isSystem,
        isPayrollEligible: created.isPayrollEligible,
        isExternal: created.isExternal,
        allowedMenus: created.allowedMenus,
        permissions: created.permissions || [],
        _count: { users: 0 }
      }])
      toast.success(`Role "${name}" created successfully!`)
      setIsCreateOpen(false)
      router.refresh()
    } else {
      toast.error(res.error || "Failed to create role")
    }
  }

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRole) return

    setLoading(true)
    const res = await updateRole(selectedRole.id, {
      name,
      description,
      isPayrollEligible,
      isExternal,
      allowedMenus
    })
    setLoading(false)

    if (res.success && res.data) {
      const updated = res.data
      setRoles(prev => prev.map(r => r.id === selectedRole.id ? {
        ...r,
        name: updated.name,
        description: updated.description,
        isPayrollEligible: updated.isPayrollEligible,
        isExternal: updated.isExternal,
        allowedMenus: updated.allowedMenus,
      } : r))
      toast.success(`Role "${name}" updated successfully!`)
      setIsEditOpen(false)
      router.refresh()
    } else {
      toast.error(res.error || "Failed to update role")
    }
  }

  const handleDeleteRole = async () => {
    if (!selectedRole) return

    setLoading(true)
    const res = await deleteRole(selectedRole.id, fallbackRoleId || undefined)
    setLoading(false)

    if (res.success) {
      setRoles(prev => prev.filter(r => r.id !== selectedRole.id))
      toast.success(`Role "${selectedRole.name}" deleted successfully!`)
      setIsDeleteOpen(false)
      router.refresh()
    } else {
      toast.error(res.error || "Failed to delete role")
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Page Header Banner ── */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="size-8 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none mb-0.5 sm:mb-1">
              Dynamic Roles & Access Control
            </h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1 sm:line-clamp-none">
              Configure system roles, create custom roles, and assign menu & module access permissions
            </p>
          </div>
        </div>

        <Button
          onClick={openCreateDialog}
          className="h-8 px-3.5 text-xs font-semibold rounded-md shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 cursor-pointer w-full sm:w-auto"
        >
          <Plus className="size-4" />
          Create New Role
        </Button>
      </div>

      {/* ── Role Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map(role => (
          <Card
            key={role.id}
            className="flex flex-col justify-between border border-border/80 rounded-md shadow-2xs hover:border-primary/40 hover:shadow-xs transition-all bg-card"
          >
            <CardHeader className="p-5 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <CardTitle className="text-sm font-bold text-foreground truncate">{role.name}</CardTitle>
                    {role.isSystem && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 inline-flex items-center gap-1">
                        <Lock className="size-2.5" /> System
                      </span>
                    )}
                    {role.isPayrollEligible !== false ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md text-emerald-600 bg-emerald-500/10 border border-emerald-500/20">
                        Payroll Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md text-muted-foreground bg-muted/40 border border-border/60">
                        Payroll Exempt
                      </span>
                    )}
                    {(role.isExternal || role.code.includes("EXTERNAL") || role.name.toLowerCase().includes("external")) && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 inline-flex items-center gap-1">
                        <Globe className="size-2.5" /> External
                      </span>
                    )}
                  </div>
                  <CardDescription className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {role.description || "No description provided."}
                  </CardDescription>
                </div>

                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-muted/40 text-foreground/80 border border-border/70 shrink-0">
                  {role.code}
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-5 pt-0 space-y-3.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/60 font-medium">
                <div className="flex items-center gap-1.5">
                  <Users className="size-3.5 text-primary" />
                  <span>{role._count.users} employee{role._count.users === 1 ? "" : "s"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <KeyRound className="size-3.5 text-primary" />
                  <span>{role.allowedMenus.includes("all") ? "Full Access" : `${role.allowedMenus.length} menus`}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold px-3 gap-1.5 rounded-md border-border/80 hover:bg-muted cursor-pointer"
                  onClick={() => openEditDialog(role)}
                >
                  <Edit className="size-3" />
                  Edit
                </Button>
                {!role.isSystem && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-md cursor-pointer transition-colors"
                    onClick={() => openDeleteDialog(role)}
                    title="Delete Role"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Create Role Dialog ── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl w-[95vw] max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-md border border-border/80 shadow-2xl bg-card">
          <DialogHeader className="px-6 py-5 border-b shrink-0 bg-background/50 border-border/60">
            <DialogTitle className="text-base font-bold tracking-tight text-foreground">
              Create Custom Role
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-medium mt-0.5">
              Define a new organizational role and configure authorized application menus.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateRole} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1 custom-scrollbar min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Role Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Project Lead, HR Executive"
                    value={name}
                    onChange={e => {
                      const val = e.target.value
                      setName(val)
                      if (!code || code === name.toUpperCase().replace(/\s+/g, '_')) {
                        setCode(val.toUpperCase().replace(/\s+/g, '_'))
                      }
                      if (val.toLowerCase().includes("external")) {
                        setIsExternal(true)
                      }
                    }}
                    required
                    className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Role Code <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g. PROJECT_LEAD"
                    value={code}
                    onChange={e => {
                      const val = e.target.value.toUpperCase().replace(/\s+/g, '_')
                      setCode(val)
                      if (val.includes("EXTERNAL")) {
                        setIsExternal(true)
                      }
                    }}
                    required
                    className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20 uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Description</label>
                <Textarea
                  placeholder="Describe the duties, authority, and responsibilities of this role..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="text-xs rounded-md bg-background border-border/80 focus:ring-primary/20 resize-none"
                />
              </div>

              <div className="p-3.5 rounded-md border border-border/70 bg-muted/20 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <label
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer"
                    onClick={() => setIsPayrollEligible(!isPayrollEligible)}
                  >
                    <Calculator className="size-3.5 text-primary" />
                    <span>Attendance Ledger & Payroll Tracking</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Include members of this role in daily attendance logs, working days calculations, and monthly salary processing.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isPayrollEligible}
                  onChange={e => setIsPayrollEligible(e.target.checked)}
                  className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer shrink-0"
                />
              </div>

              <div className="p-3.5 rounded-md border border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <label
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer"
                    onClick={() => setIsExternal(!isExternal)}
                  >
                    <Globe className="size-3.5 text-blue-600 dark:text-blue-400" />
                    <span>External Collaborator / External User Role</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Enforces external collaborator security: hides global Project Overview and Project Documents, restricts task reviews to assigned reviewers, and restricts delegation to department members only.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isExternal}
                  onChange={e => setIsExternal(e.target.checked)}
                  className="size-4 rounded border-border text-blue-600 focus:ring-blue-600 cursor-pointer shrink-0"
                />
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between pb-1 border-b border-border/40">
                  <label className="text-xs font-bold uppercase tracking-wider text-primary">
                    Menu & Feature Access
                  </label>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {allowedMenus.length} selected
                  </span>
                </div>

                <div className="space-y-4 border border-border/70 rounded-md p-3.5 bg-muted/20">
                  {AVAILABLE_MENUS.map(group => {
                    const groupPaths = group.items.map(i => i.path)
                    const isAllInGroup = groupPaths.every(p => allowedMenus.includes(p))

                    return (
                      <div key={group.group} className="space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-border/40">
                          <span className="text-xs font-bold text-foreground/90">{group.group}</span>
                          <button
                            type="button"
                            onClick={() => handleSelectAllGroup(groupPaths)}
                            className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
                          >
                            {isAllInGroup ? "Deselect All" : "Select All"}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {group.items.map(item => {
                            const isChecked = allowedMenus.includes(item.path)
                            return (
                              <label
                                key={item.path}
                                className={`flex items-center gap-2 p-2.5 rounded-md border text-xs cursor-pointer transition-colors ${
                                  isChecked
                                    ? "bg-primary/10 border-primary/40 text-foreground font-medium"
                                    : "bg-background border-border/60 text-muted-foreground hover:bg-muted/40"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleMenu(item.path)}
                                  className="rounded border-border text-primary focus:ring-primary size-3.5"
                                />
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <span className="truncate">{item.title}</span>
                                  {item.path === "/dashboard/external" && (
                                    <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0">
                                      External
                                    </span>
                                  )}
                                  {item.path === "/dashboard/employee" && (
                                    <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 shrink-0">
                                      Employee
                                    </span>
                                  )}
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border/60 bg-muted/20 shrink-0 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="h-9 text-xs font-semibold rounded-md border-border/80 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="h-9 px-5 text-xs font-semibold rounded-md shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
              >
                {loading ? "Creating..." : "Create Role"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Role Dialog ── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl w-[95vw] max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-md border border-border/80 shadow-2xl bg-card">
          <DialogHeader className="px-6 py-5 border-b shrink-0 bg-background/50 border-border/60">
            <DialogTitle className="text-base font-bold tracking-tight text-foreground">
              Edit Role: {selectedRole?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-medium mt-0.5">
              Modify role information and authorized application menus.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateRole} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1 custom-scrollbar min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Role Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Role Code</label>
                  <Input
                    value={selectedRole?.code || ""}
                    disabled
                    className="h-9 text-xs rounded-md bg-muted/50 text-muted-foreground border-border/60 cursor-not-allowed font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Description</label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="text-xs rounded-md bg-background border-border/80 focus:ring-primary/20 resize-none"
                />
              </div>

              <div className="p-3.5 rounded-md border border-border/70 bg-muted/20 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <label
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer"
                    onClick={() => setIsPayrollEligible(!isPayrollEligible)}
                  >
                    <Calculator className="size-3.5 text-primary" />
                    <span>Attendance Ledger & Payroll Tracking</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Include members of this role in daily attendance logs, working days calculations, and monthly salary processing.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isPayrollEligible}
                  onChange={e => setIsPayrollEligible(e.target.checked)}
                  className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer shrink-0"
                />
              </div>

              <div className="p-3.5 rounded-md border border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <label
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer"
                    onClick={() => setIsExternal(!isExternal)}
                  >
                    <Globe className="size-3.5 text-blue-600 dark:text-blue-400" />
                    <span>External Collaborator / External User Role</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Enforces external collaborator security: hides global Project Overview and Project Documents, restricts task reviews to assigned reviewers, and restricts delegation to department members only.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isExternal}
                  onChange={e => setIsExternal(e.target.checked)}
                  className="size-4 rounded border-border text-blue-600 focus:ring-blue-600 cursor-pointer shrink-0"
                />
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between pb-1 border-b border-border/40">
                  <label className="text-xs font-bold uppercase tracking-wider text-primary">
                    Menu & Feature Access
                  </label>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {allowedMenus.length} selected
                  </span>
                </div>

                <div className="space-y-4 border border-border/70 rounded-md p-3.5 bg-muted/20">
                  {AVAILABLE_MENUS.map(group => {
                    const groupPaths = group.items.map(i => i.path)
                    const isAllInGroup = groupPaths.every(p => allowedMenus.includes(p))

                    return (
                      <div key={group.group} className="space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-border/40">
                          <span className="text-xs font-bold text-foreground/90">{group.group}</span>
                          <button
                            type="button"
                            onClick={() => handleSelectAllGroup(groupPaths)}
                            className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
                          >
                            {isAllInGroup ? "Deselect All" : "Select All"}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {group.items.map(item => {
                            const isChecked = allowedMenus.includes(item.path)
                            return (
                              <label
                                key={item.path}
                                className={`flex items-center gap-2 p-2.5 rounded-md border text-xs cursor-pointer transition-colors ${
                                  isChecked
                                    ? "bg-primary/10 border-primary/40 text-foreground font-medium"
                                    : "bg-background border-border/60 text-muted-foreground hover:bg-muted/40"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleMenu(item.path)}
                                  className="rounded border-border text-primary focus:ring-primary size-3.5"
                                />
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <span className="truncate">{item.title}</span>
                                  {item.path === "/dashboard/external" && (
                                    <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0">
                                      External
                                    </span>
                                  )}
                                  {item.path === "/dashboard/employee" && (
                                    <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 shrink-0">
                                      Employee
                                    </span>
                                  )}
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border/60 bg-muted/20 shrink-0 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="h-9 text-xs font-semibold rounded-md border-border/80 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="h-9 px-5 text-xs font-semibold rounded-md shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
              >
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Role Dialog ── */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md rounded-md border border-border/80 shadow-2xl bg-card">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2 text-base font-bold">
              <Trash2 className="size-5" />
              Delete Role: {selectedRole?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-medium">
              Are you sure you want to delete this custom role? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedRole && selectedRole._count.users > 0 && (
            <div className="space-y-3 py-2">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs text-amber-700 dark:text-amber-400 font-medium">
                This role is currently assigned to <strong>{selectedRole._count.users} user(s)</strong>. Please select a fallback role to reassign them to.
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Reassign Users To:</label>
                <select
                  value={fallbackRoleId}
                  onChange={e => setFallbackRoleId(e.target.value)}
                  className="w-full h-9 rounded-md border border-border/80 bg-background px-3 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="">-- Select Fallback Role --</option>
                  {roles.filter(r => r.id !== selectedRole.id).map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              className="h-9 text-xs font-semibold rounded-md border-border/80 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRole}
              disabled={loading || ((selectedRole?._count.users ?? 0) > 0 && !fallbackRoleId)}
              className="h-9 text-xs font-semibold rounded-md shadow-xs cursor-pointer"
            >
              {loading ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
