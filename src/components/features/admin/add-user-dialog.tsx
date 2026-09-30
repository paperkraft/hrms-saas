"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  UserPlus,
  Loader2,
  MapPin,
  Building2,
  Crown,
  Star,
  User,
  Mail,
  Lock,
  Shield,
  Briefcase,
  Calendar,
  Phone,
  Droplets,
  Heart,
  UserCheck,
  Globe,
  Check,
  Eye,
  EyeOff,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createUser } from "@/actions/user"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

interface RoleOption {
  id: string
  name: string
  code: string
  allowedMenus?: string[]
  isExternal?: boolean
}

export function AddUserDialog({
  managers,
  departments,
  locations,
  roles = []
}: {
  managers: { id: string, name: string | null, email: string }[],
  departments: { id: string, name: string }[],
  locations: { id: string, name: string, isRemote: boolean }[],
  roles?: RoleOption[]
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [additionalLocationIds, setAdditionalLocationIds] = useState<string[]>([])
  const [workMode, setWorkMode] = useState("OFFICE")

  // Single department placement & Multi-department leadership
  const [selectedDeptId, setSelectedDeptId] = useState<string>("none")
  const [selectedLedDeptIds, setSelectedLedDeptIds] = useState<string[]>([])

  const toggleLedDept = (deptId: string) => {
    setSelectedLedDeptIds(prev =>
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    )
  }
  
  // Multi-role state
  const defaultPrimary = roles.find(r => r.code === "EMPLOYEE")?.id || roles[0]?.id || ""
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([defaultPrimary].filter(Boolean))
  const [primaryRoleId, setPrimaryRoleId] = useState<string>(defaultPrimary)
  const [isExternal, setIsExternal] = useState<boolean>(false)
  const [showPassword, setShowPassword] = useState<boolean>(false)

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds(prev => {
      if (prev.includes(roleId)) {
        if (prev.length === 1) {
          toast.warning("A user must have at least one assigned role.")
          return prev
        }
        const next = prev.filter(id => id !== roleId)
        if (primaryRoleId === roleId) {
          setPrimaryRoleId(next[0] || "")
        }
        return next
      } else {
        const nextRole = roles.find(r => r.id === roleId)
        if (nextRole && (nextRole.isExternal || nextRole.code === "EXTERNAL_USER" || nextRole.code?.includes("EXTERNAL") || nextRole.name?.toLowerCase().includes("external"))) {
          setIsExternal(true)
        }
        return [...prev, roleId]
      }
    })
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    
    // Single primary department placement + multi-department leadership
    const deptId = (!isExternal && selectedDeptId && selectedDeptId !== "none") ? selectedDeptId : null
    const ledIds = (!isExternal) ? selectedLedDeptIds : []

    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      roleDefinitionIds: selectedRoleIds,
      primaryRoleId: primaryRoleId || selectedRoleIds[0],
      roleDefinitionId: primaryRoleId || selectedRoleIds[0],
      role: formData.get("role"),
      designation: formData.get("designation"),
      managerId: formData.get("managerId") === "none" ? null : formData.get("managerId"),
      departmentId: deptId,
      primaryDepartmentId: deptId,
      ledDepartmentIds: ledIds,
      isExternal,
      locationId: formData.get("locationId") === "none" ? null : formData.get("locationId"),
      workMode: formData.get("workMode"),
      dateOfBirth: formData.get("dateOfBirth") ? new Date(formData.get("dateOfBirth") as string) : null,
      joiningDate: formData.get("joiningDate") ? new Date(formData.get("joiningDate") as string) : null,
      additionalLocationIds,
      minOfficeDays: formData.get("minOfficeDays") || 0,
      phoneNumber: formData.get("phoneNumber"),
      bloodGroup: formData.get("bloodGroup"),
      emergencyContactName: formData.get("emergencyContactName"),
      emergencyContactPhone: formData.get("emergencyContactPhone"),
      emergencyContactRelation: formData.get("emergencyContactRelation"),
    }

    const res = await createUser(data as any)
    setLoading(false)

    if (res.success) {
      toast.success("Employee profile created successfully!")
      setOpen(false)
      setAdditionalLocationIds([])
      setSelectedDeptId("none")
      setSelectedLedDeptIds([])
      setIsExternal(false)
    } else {
      setError(res.error || "Failed to create employee")
      toast.error(res.error || "Failed to create employee")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          title="Add New Employee"
          className="h-8 sm:h-9 px-2.5 sm:px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shadow-xs gap-1.5 cursor-pointer shrink-0"
        >
          <UserPlus className="size-3.5 sm:size-4" />
          <span className="hidden sm:inline">Add Employee</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl lg:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-md border border-border/80 shadow-2xl bg-card">
        {/* Dialog Header */}
        <DialogHeader className="px-4 sm:px-6 py-3.5 sm:py-5 pr-12 sm:pr-14 border-b shrink-0 bg-background/50 border-border/60">
          <DialogTitle className="text-sm sm:text-base font-bold tracking-tight text-foreground">
            Add New Employee
          </DialogTitle>
          <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5 leading-relaxed">
            Provision a new account with dynamic role assignment, department allocation, and office location setup.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1 custom-scrollbar min-h-0">
            {/* ── Section 1: Basic Identity & Credentials ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                <User className="size-3.5 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Identity & Credentials
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    Full Name <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    name="name"
                    required
                    placeholder="e.g. John Doe"
                    className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    Work Email <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    name="email"
                    required
                    placeholder="e.g. john.doe@company.com"
                    className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    Initial Password <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      required
                      placeholder="Minimum 6 characters"
                      className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none p-0.5 rounded cursor-pointer"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2 sm:col-span-2 p-2.5 sm:p-3 rounded-md bg-muted/20 border border-border/70">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Shield className="size-3.5 text-primary" />
                      Assigned System Roles <span className="text-rose-500">*</span>
                    </Label>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Multi-role support enabled (click ★ to set primary)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {roles.map(r => {
                      const isSelected = selectedRoleIds.includes(r.id)
                      const isPrimary = primaryRoleId === r.id

                      return (
                        <div
                          key={r.id}
                          onClick={() => toggleRole(r.id)}
                          className={cn(
                            "p-2 sm:p-2.5 rounded-md border text-xs transition-all flex items-center justify-between gap-2 cursor-pointer select-none",
                            isSelected
                              ? "bg-card border-primary/40 ring-1 ring-primary/20 shadow-xs text-foreground"
                              : "bg-background/60 border-border/70 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={cn(
                              "size-4 rounded-[4px] border flex items-center justify-center transition-colors shrink-0",
                              isSelected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-input bg-background"
                            )}>
                              {isSelected && <Check className="size-3 stroke-3" />}
                            </div>
                            <div className="flex flex-col min-w-0 truncate">
                              <span className="font-semibold text-xs leading-tight flex items-center gap-1.5 truncate">
                                {r.name}
                                {isPrimary && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-bold border border-primary/20 flex items-center gap-0.5 shrink-0">
                                    <Star className="size-2.5 fill-primary text-primary" /> Primary
                                  </span>
                                )}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
                                {r.code}
                              </span>
                            </div>
                          </div>

                          {isSelected && !isPrimary && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setPrimaryRoleId(r.id)
                              }}
                              className="text-[10px] text-muted-foreground hover:text-primary font-semibold px-2 py-0.5 rounded hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all cursor-pointer shrink-0"
                              title="Set as Primary Role"
                            >
                              Make Primary
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ── External Collaborator Flag ── */}
                <div className="sm:col-span-2 p-2.5 sm:p-3 rounded-md border border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10 flex items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <label
                      className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer"
                      onClick={() => setIsExternal(!isExternal)}
                    >
                      <Globe className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>External Collaborator / User Account</span>
                    </label>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Restricts access to internal department workflows and sensitive documents.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isExternal}
                    onChange={e => setIsExternal(e.target.checked)}
                    className="size-4 rounded border-border text-blue-600 focus:ring-blue-600 cursor-pointer shrink-0 mt-0.5 sm:mt-0"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    Designation
                  </Label>
                  <Input
                    name="designation"
                    placeholder="e.g. Senior Software Engineer"
                    className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    Date of Birth
                  </Label>
                  <Input
                    type="date"
                    name="dateOfBirth"
                    className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    Joining Date
                  </Label>
                  <Input
                    type="date"
                    name="joiningDate"
                    className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            {/* ── Section 2: Department & Team Leadership ── */}
            {!isExternal ? (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between pb-1 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-3.5 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      Department Assignment
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Placement &amp; leadership
                  </span>
                </div>

                <div className="space-y-3.5 p-3 sm:p-3.5 rounded-md bg-muted/20 border border-border/70">
                  {/* Primary Department Placement */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-primary" />
                        <span>Primary Department Placement</span>
                      </Label>
                      <span className="text-[10px] font-medium text-muted-foreground">Single home dept</span>
                    </div>
                    <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                      <SelectTrigger className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20">
                        <SelectValue placeholder="Select department (or Unassigned)..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-md border-border/70 max-h-56">
                        <SelectItem value="none" className="text-xs text-muted-foreground">None / Unassigned</SelectItem>
                        {departments.map(d => (
                          <SelectItem key={d.id} value={d.id} className="text-xs font-medium">
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      Each employee belongs to exactly one primary department for attendance, leaves, and payroll.
                    </p>
                  </div>

                  {/* Multi-Department Leadership */}
                  <div className="space-y-2 pt-2 border-t border-border/60">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Crown className="size-3.5 text-amber-500" />
                        <span>Departments Led (Team Leader / Head)</span>
                      </Label>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        {selectedLedDeptIds.length} {selectedLedDeptIds.length === 1 ? "Dept" : "Depts"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Select all departments this user leads:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {departments.map(dept => {
                        const isLeading = selectedLedDeptIds.includes(dept.id)
                        const isPrimary = selectedDeptId === dept.id

                        return (
                          <div
                            key={dept.id}
                            onClick={() => toggleLedDept(dept.id)}
                            className={cn(
                              "p-2 sm:p-2.5 rounded-md border text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors select-none",
                              isLeading
                                ? "bg-amber-500/10 border-amber-500/40 text-foreground"
                                : "bg-background/80 border-border/70 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Building2 className={cn("size-3.5 shrink-0", isLeading ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
                              <div className="truncate">
                                <span className={cn("font-medium truncate block", isLeading && "font-bold text-foreground")}>{dept.name}</span>
                                {isPrimary && (
                                  <span className="text-[9px] text-primary font-semibold block">Primary Dept</span>
                                )}
                              </div>
                            </div>
                            <div className={cn(
                              "size-4 rounded-[4px] border flex items-center justify-center transition-colors shrink-0",
                              isLeading
                                ? "bg-amber-500 border-amber-500 text-white"
                                : "border-input bg-background"
                            )}>
                              {isLeading && <Check className="size-3 stroke-3" />}
                            </div>
                          </div>
                        )
                      })}
                      {departments.length === 0 && (
                        <div className="col-span-2 text-center py-3 text-xs text-muted-foreground">
                          No departments available
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-md border border-dashed border-blue-500/30 bg-blue-500/5 flex items-center gap-2.5 text-blue-700 dark:text-blue-300 text-xs">
                <Globe className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span>Department assignment is hidden and disabled for external collaborator accounts.</span>
              </div>
            )}

            {/* ── Section 3: Reporting & Hierarchy ── */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                <UserCheck className="size-3.5 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Hierarchy & Reporting
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Direct Reporting Manager</Label>
                <Select name="managerId" defaultValue="none">
                  <SelectTrigger className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20">
                    <SelectValue placeholder="None (Direct / Top Level)" />
                  </SelectTrigger>
                  <SelectContent className="rounded-md border border-border/70">
                    <SelectItem value="none" className="text-xs">None (Direct / Top Level)</SelectItem>
                    {managers.map(m => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">
                        {m.name ? `${m.name} (${m.email})` : m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Section 4: Work Setup & Office Locations ── */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                <MapPin className="size-3.5 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Work Setup & Locations
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Work Mode</Label>
                  <Select name="workMode" value={workMode} onValueChange={setWorkMode}>
                    <SelectTrigger className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-md shadow-lg border-border/70">
                      <SelectItem value="OFFICE" className="text-xs">On-site (Office)</SelectItem>
                      <SelectItem value="REMOTE" className="text-xs">Remote</SelectItem>
                      <SelectItem value="HYBRID" className="text-xs">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Primary Office / Hub</Label>
                  <Select name="locationId" defaultValue="none">
                    <SelectTrigger className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-md shadow-lg border-border/70">
                      <SelectItem value="none" className="text-xs">Default Office</SelectItem>
                      {locations.map(l => (
                        <SelectItem key={l.id} value={l.id} className="text-xs">{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Additional Allowed Punch Locations */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">
                    Additional Allowed Punch Locations
                  </Label>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {additionalLocationIds.length} location{additionalLocationIds.length === 1 ? "" : "s"} selected
                  </span>
                </div>

                <div className="border border-border/70 rounded-md p-2.5 sm:p-3 bg-muted/20 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                  {locations.map(loc => {
                    const isChecked = additionalLocationIds.includes(loc.id)
                    return (
                      <label
                        key={loc.id}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer transition-colors",
                          isChecked
                            ? "bg-primary/10 border-primary/40 text-foreground font-medium"
                            : "bg-background border-border/60 text-muted-foreground hover:bg-muted/40"
                        )}
                      >
                        <Checkbox
                          id={`add-loc-${loc.id}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setAdditionalLocationIds(prev => [...prev, loc.id])
                            } else {
                              setAdditionalLocationIds(prev => prev.filter(id => id !== loc.id))
                            }
                          }}
                        />
                        <span className="truncate flex items-center gap-1.5">
                          <MapPin className="size-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{loc.name}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-relaxed">
                  Employees can punch in/out from these additional branches in addition to their primary hub.
                </p>
              </div>
            </div>

            {/* ── Section 5: Contact & Emergency Information ── */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                <Phone className="size-3.5 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Contact & Emergency Details
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Phone Number</Label>
                  <Input
                    name="phoneNumber"
                    placeholder="e.g. 98XXXXXXXX"
                    maxLength={10}
                    className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Blood Group</Label>
                  <Input
                    name="bloodGroup"
                    placeholder="e.g. O+, A+, B+, AB-"
                    className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Emergency Contact Name</Label>
                  <Input
                    name="emergencyContactName"
                    placeholder="e.g. Jane Doe"
                    className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Emergency Phone</Label>
                  <Input
                    name="emergencyContactPhone"
                    placeholder="e.g. 98XXXXXXXX"
                    maxLength={10}
                    className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold text-foreground">Relationship</Label>
                  <Input
                    name="emergencyContactRelation"
                    placeholder="e.g. Spouse, Parent, Sibling"
                    className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20 w-full sm:max-w-sm"
                  />
                </div>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20 text-xs font-medium text-rose-600">
                {error}
              </div>
            )}
          </div>

          {/* ── Dialog Footer ── */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border/60 bg-muted/20 shrink-0 flex items-center justify-end gap-2.5 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-9 text-xs font-semibold rounded-md border-border/80 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-9 px-4 sm:px-5 text-xs font-semibold rounded-md shadow-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <UserPlus className="size-3.5" />
              )}
              <span>{loading ? "Creating..." : "Create Employee"}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
