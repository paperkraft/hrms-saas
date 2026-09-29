"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, X, Plus, Save, Building2, Crown, Users, Layers, UserPlus } from "lucide-react"
import { updateDepartment, updateDepartmentMember, updateDepartmentLeader } from "@/actions/department"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

type User = { id: string, name: string | null, email: string, avatarUrl?: string | null }
type Department = {
  id: string
  name: string
  description?: string | null
  members: User[]
  teamLeader?: User | null
  parentDepartmentId?: string | null
  parentDepartment?: { id: string, name: string } | null
  subDepartments?: Array<{ id: string, name: string }>
}

type DepartmentOption = { id: string, name: string, parentDepartmentId?: string | null }

export function EditDepartmentDialog({
  department,
  users,
  departments,
  onClose
}: {
  department: Department | null
  users: User[]
  departments: DepartmentOption[]
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedUser, setSelectedUser] = useState<string>("")
  const [selectedLeader, setSelectedLeader] = useState<string>("none")
  const [selectedParentDepartment, setSelectedParentDepartment] = useState<string>("none")

  // Candidates for leadership (Department members + all other users)
  const leaderCandidates = useMemo(() => {
    if (!department) return []
    const map = new Map<string, User>()
    department.members.forEach(u => map.set(u.id, u))
    users.forEach(u => map.set(u.id, u))
    return Array.from(map.values())
  }, [department, users])

  // Filter valid parent department options: exclude self and any sub-departments
  const parentDepartmentOptions = useMemo(() => {
    if (!department) return []
    return departments.filter(d => d.id !== department.id && d.parentDepartmentId !== department.id)
  }, [departments, department])

  useEffect(() => {
    if (department) {
      setName(department.name)
      setDescription(department.description || "")
      setSelectedUser("")
      setSelectedLeader(department.teamLeader?.id || "none")
      setSelectedParentDepartment(department.parentDepartmentId || "none")
    }
  }, [department])

  if (!department) return null

  const currentParentId = department.parentDepartmentId || "none"
  const hasGeneralChanges =
    name.trim() !== department.name ||
    selectedParentDepartment !== currentParentId ||
    description.trim() !== (department.description || "").trim()

  async function handleSaveGeneral(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!department) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error("Department name cannot be empty")
      return
    }

    const parentIdToSave = selectedParentDepartment === "none" ? null : selectedParentDepartment

    setLoading(true)
    const res = await updateDepartment(
      department.id,
      trimmedName,
      parentIdToSave,
      description.trim() || null
    )
    setLoading(false)

    if (res.success) {
      toast.success("Department details updated successfully")
    } else {
      toast.error(res.error || "Failed to update department")
      setSelectedParentDepartment(department.parentDepartmentId || "none")
      setName(department.name)
      setDescription(department.description || "")
    }
  }

  async function handleAddMember() {
    if (!selectedUser) return
    setLoading(true)
    const res = await updateDepartmentMember(selectedUser, department!.id, "add")
    setLoading(false)

    if (res.success) {
      toast.success("Employee placed in this department")
      setSelectedUser("")
    } else {
      toast.error(res.error || "Failed to assign employee")
    }
  }

  async function handleRemoveMember(userId: string) {
    setLoading(true)
    const res = await updateDepartmentMember(userId, department!.id, "remove")
    setLoading(false)

    if (res.success) {
      toast.success("Employee unassigned from department")
    } else {
      toast.error(res.error || "Failed to remove employee")
    }
  }

  async function handleUpdateLeader(newLeaderId: string) {
    setSelectedLeader(newLeaderId)
    setLoading(true)
    const leaderIdToSave = newLeaderId === "none" ? null : newLeaderId

    const res = await updateDepartmentLeader(department!.id, leaderIdToSave)
    setLoading(false)

    if (res.success) {
      toast.success("Department leader updated successfully")
    } else {
      toast.error(res.error || "Failed to update leader")
      setSelectedLeader(department!.teamLeader?.id || "none")
    }
  }

  // Filter out users who are already in this department
  const availableUsers = users.filter(u => !department.members.some(m => m.id === u.id))

  return (
    <Dialog open={!!department} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-xl max-h-[90vh] rounded-md border border-border/80 shadow-2xl bg-card p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-4 sm:px-6 py-3.5 sm:py-5 border-b border-border/70 bg-card pr-12 sm:pr-14 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-md flex items-center justify-center border border-primary/20 bg-primary/10 text-primary shrink-0">
              <Building2 className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm sm:text-base font-bold tracking-tight text-foreground truncate">
                Edit Department: {department.name}
              </DialogTitle>
              <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5 leading-snug">
                Manage hierarchy, team leadership, and assigned employees
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-3.5 sm:p-5 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
          {/* General Information: Name & Parent Department */}
          <form onSubmit={handleSaveGeneral} className="bg-muted/15 border border-border/70 rounded-md p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border/60">
              <Building2 className="size-3.5 sm:size-4 text-primary shrink-0" />
              <h4 className="text-xs font-bold text-foreground">General Configuration</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Department Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Mechanical Design"
                  className="h-9 bg-background border-border/80 rounded-md text-xs font-medium focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Parent Department (Hierarchy)
                </Label>
                <Select
                  value={selectedParentDepartment}
                  onValueChange={(val) => setSelectedParentDepartment(val)}
                  disabled={loading}
                >
                  <SelectTrigger className="h-9 bg-background border-border/80 text-xs font-semibold rounded-md w-full">
                    <SelectValue placeholder="None (Top-Level Department)" />
                  </SelectTrigger>
                  <SelectContent className="max-h-55 rounded-md border-border/80">
                    <SelectItem value="none" className="text-xs font-medium">
                      None (Top-Level Department)
                    </SelectItem>
                    {parentDepartmentOptions.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id} className="text-xs">
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Description (Optional)
              </Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief overview of this department's functions, goals, or responsibilities..."
                className="min-h-[75px] bg-background border-border/80 rounded-md text-xs font-medium focus:ring-primary/20 resize-y"
              />
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                disabled={loading || !hasGeneralChanges}
                className="h-8 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <><Save className="size-3.5" /> Save Changes</>}
              </Button>
            </div>
          </form>

          {/* Department Leader / Sub-Team Leader */}
          <div className="bg-muted/15 border border-border/70 rounded-md p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border/60">
              <Crown className="size-3.5 sm:size-4 text-amber-500 shrink-0" />
              <h4 className="text-xs font-bold text-foreground">
                {selectedParentDepartment !== "none" ? "Sub-Team Leader Assignment" : "Department Leader (TL) Assignment"}
              </h4>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Designated Team Leader
              </Label>
              <Select value={selectedLeader} onValueChange={handleUpdateLeader} disabled={loading}>
                <SelectTrigger className="h-9 bg-background border-border/80 text-xs font-semibold rounded-md w-full">
                  <SelectValue placeholder={selectedParentDepartment !== "none" ? "Select a sub-team leader..." : "Select a leader..."} />
                </SelectTrigger>
                <SelectContent className="max-h-50 rounded-md border-border/80">
                  <SelectItem value="none" className="text-xs text-muted-foreground">No Leader Assigned</SelectItem>
                  {leaderCandidates.map(u => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                  {leaderCandidates.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground text-center">No users available</div>
                  )}
                </SelectContent>
              </Select>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-relaxed">
                Assigning a leader automatically sets them as the reporting manager for all department members.
              </p>
            </div>
          </div>

          {/* Current Members List & Add Member */}
          <div className="bg-muted/15 border border-border/70 rounded-md p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1 pb-1.5 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Users className="size-3.5 sm:size-4 text-primary shrink-0" />
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span>Department Staff</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                    {department.members.length}
                  </span>
                </h4>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">Single department placement</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-relaxed">
              Employees are placed in only one department. Adding an employee here sets or transfers their primary placement to {department.name}.
            </p>

            {/* Quick Add Member row */}
            <div className="flex gap-2">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="h-9 bg-background border-border/80 text-xs font-semibold rounded-md flex-1">
                  <SelectValue placeholder="Add an employee to this unit..." />
                </SelectTrigger>
                <SelectContent className="max-h-50 rounded-md border-border/80">
                  {availableUsers.map(u => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                  {availableUsers.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground text-center">No unassigned employees available</div>
                  )}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAddMember}
                disabled={!selectedUser || loading}
                className="h-9 px-3.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer gap-1.5 shrink-0"
              >
                <UserPlus className="size-3.5" />
                <span>Add</span>
              </Button>
            </div>

            {/* Members Stack List */}
            {department.members.length > 0 ? (
              <div className="border border-border/70 rounded-md divide-y divide-border/40 max-h-47.5 overflow-y-auto bg-background">
                {department.members.map(member => (
                  <div key={member.id} className="flex items-center justify-between p-2.5 px-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="size-7 rounded-full shrink-0 border border-border/60">
                        {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.name || ""} className="object-cover rounded-full" />}
                        <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold uppercase rounded-full flex items-center justify-center size-full">
                          {member.name ? member.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "EM"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-foreground block truncate">{member.name || 'Unnamed'}</span>
                        <span className="text-[10px] text-muted-foreground block truncate">{member.email}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={loading}
                      className="size-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-md cursor-pointer transition-colors"
                      title="Remove from Department"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 border border-border/60 border-dashed rounded-md bg-background">
                <span className="text-xs font-medium text-muted-foreground">No staff members currently assigned to this department</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
