"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { OrgUser, OrgDepartment, OrgData } from "@/actions/org-chart"
import {
  ChevronDown,
  ChevronRight,
  User,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize,
  List,
  Building2,
  Users,
  Network,
  Layers,
  Crown,
  Mail,
  ChevronUp,
  X,
  ExternalLink,
  ArrowRight,
  Workflow
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn, getInitials } from "@/lib/utils"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet"

/* =========================================================================
   1. USER PROFILE PREVIEW MODAL
   ========================================================================= */
interface MemberProfileDialogProps {
  user: OrgUser | null
  allUsers: OrgUser[]
  allDepartments: OrgDepartment[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onFocusUserInReporting?: (user: OrgUser) => void
}

function MemberProfileDialog({
  user,
  allUsers,
  allDepartments,
  open,
  onOpenChange,
  onFocusUserInReporting
}: MemberProfileDialogProps) {
  if (!user) return null

  const isLeader = !!(user.ledDepartments && user.ledDepartments.length > 0) || !!(user.departments && user.departments.some(d => d.isLeader))
  const isInactive = user.status === "INACTIVE"
  const departmentName = user.department?.name || "General"
  const parentDeptName = user.department?.parentDepartment?.name

  const directReports = allUsers.filter((u) => u.managerId === user.id && u.status !== "RESIGNED" && u.status !== "TERMINATED")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-border/80 shadow-2xl rounded-md">
        <DialogHeader className="sr-only">
          <DialogTitle>{user.name || user.email}</DialogTitle>
          <DialogDescription>Staff member profile and reporting details</DialogDescription>
        </DialogHeader>

        {/* Header Gradient */}
        <div className="relative h-28 bg-gradient-to-r from-primary/25 via-indigo-500/20 to-primary/10 border-b border-border/40 p-4 flex items-end">
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            {isInactive && (
              <Badge variant="outline" className="bg-muted text-muted-foreground font-bold text-[9px] uppercase tracking-wider border-border/80">
                Inactive / On Leave
              </Badge>
            )}
            {isLeader && (
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-[9px] uppercase tracking-wider gap-1 border-0 shadow-xs">
                <Crown className="w-3 h-3" /> Team Leader
              </Badge>
            )}
            <Badge variant="outline" className="bg-background/90 backdrop-blur-xs text-[9px] font-bold uppercase tracking-wider">
              {user.role}
            </Badge>
          </div>
        </div>

        {/* Profile Details */}
        <div className="p-6 pt-0 relative space-y-4">
          <div className="flex items-end justify-between -mt-12 mb-2">
            <Avatar className={cn("w-20 h-20 rounded-full ring-4 ring-background border border-border shadow-lg", isInactive && "grayscale opacity-80")}>
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name || ""} className="object-cover" />}
              <AvatarFallback className="bg-primary text-primary-foreground font-black text-xl">
                {getInitials(user.name || user.email)}
              </AvatarFallback>
            </Avatar>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground tracking-tight">{user.name || "Unnamed Staff"}</h3>
              {isInactive && (
                <Badge variant="outline" className="text-[8px] font-bold bg-muted text-muted-foreground border-border/80 uppercase">
                  Inactive
                </Badge>
              )}
            </div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">{user.designation || user.role}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
              <Mail className="w-3.5 h-3.5" />
              <a href={`mailto:${user.email}`} className="hover:underline hover:text-foreground">
                {user.email}
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-border/50">
            <div className="p-3 rounded-md bg-muted/30 border border-border/40">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Department</p>
              <div className="text-xs font-bold text-foreground truncate">
                {parentDeptName ? `${parentDeptName} › ${departmentName}` : departmentName}
              </div>
            </div>

            <div className="p-3 rounded-md bg-muted/30 border border-border/40">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Reports To</p>
              <div className="text-xs font-bold text-foreground truncate">
                {user.manager ? user.manager.name : "Company Leadership"}
              </div>
            </div>
          </div>

          {directReports.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center justify-between">
                <span>Direct Reports</span>
                <span className="font-bold text-foreground">{directReports.length} team members</span>
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                {directReports.map((report) => (
                  <Badge key={report.id} variant="secondary" className={cn("text-[10px] font-medium py-1 px-2.5 gap-1.5 rounded-md", report.status === "INACTIVE" && "opacity-75 grayscale")}>
                    <Avatar className="w-4 h-4 rounded-full">
                      {report.avatarUrl && <AvatarImage src={report.avatarUrl} />}
                      <AvatarFallback className="text-[7px]">{getInitials(report.name || "")}</AvatarFallback>
                    </Avatar>
                    <span>{report.name}</span>
                    {report.status === "INACTIVE" && <span className="text-[8px] text-muted-foreground">(Inactive)</span>}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {onFocusUserInReporting && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs font-bold gap-2 rounded-md h-9 hover:bg-primary hover:text-primary-foreground transition-all"
                onClick={() => {
                  onOpenChange(false)
                  onFocusUserInReporting(user)
                }}
              >
                <Workflow className="w-4 h-4 text-primary" /> View in Reporting Lines Tree
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* =========================================================================
   2. DEPARTMENT ROSTER DRAWER (SLIDING SHEET)
   ========================================================================= */
interface DepartmentRosterSheetProps {
  department: OrgDepartment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectMember: (user: OrgUser) => void
}

function DepartmentRosterSheet({
  department,
  open,
  onOpenChange,
  onSelectMember
}: DepartmentRosterSheetProps) {
  const [search, setSearch] = useState("")

  if (!department) return null

  const isSubDept = !!department.parentDepartmentId
  const teamLeader = department.teamLeader
  const isLeaderInactive = teamLeader?.status === "INACTIVE"
  const members = department.members

  const filteredMembers = members.filter((m) => {
    if (!search) return true
    const q = search.toLowerCase()
    return m.name?.toLowerCase().includes(q) || m.designation?.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full p-0 flex flex-col h-full max-h-screen overflow-hidden bg-card border-l border-border/80 shadow-2xl">
        {/* Drawer Header */}
        <div
          className={cn(
            "p-6 pb-5 border-b shrink-0",
            isSubDept
              ? "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20"
              : "bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border-primary/20"
          )}
        >
          <SheetHeader className="text-left space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-[9px] font-black uppercase px-2 py-0.5 rounded-full border",
                  isSubDept
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    : "bg-primary/10 text-primary border-primary/30"
                )}
              >
                {isSubDept ? "Sub-Department Roster" : "Department Roster"}
              </Badge>
              <span className="text-xs font-bold text-muted-foreground">{members.length} Total Members</span>
            </div>

            <SheetTitle className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              {isSubDept ? <Layers className="size-4.5 text-emerald-600" /> : <Building2 className="size-4.5 text-primary" />}
              <span>{department.name}</span>
            </SheetTitle>

            <SheetDescription className="text-xs text-muted-foreground mt-1">
              {department.parentDepartment
                ? `Part of ${department.parentDepartment.name}`
                : `Department roster and staff list`}
            </SheetDescription>
          </SheetHeader>

          {/* Department Head Spotlight */}
          {teamLeader && (
            <div className={cn(
              "mt-4 p-3 rounded-md border shadow-xs flex items-center justify-between gap-3",
              isLeaderInactive
                ? "bg-muted/40 border-dashed border-muted-foreground/30 opacity-80 grayscale hover:grayscale-0 hover:opacity-100"
                : "bg-background/80 border-border/60"
            )}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative">
                  <Avatar className="size-10 rounded-full ring-2 ring-primary/20">
                    {teamLeader.avatarUrl && <AvatarImage src={teamLeader.avatarUrl} alt={teamLeader.name || ""} />}
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {getInitials(teamLeader.name || teamLeader.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 size-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[8px] shadow-xs">
                    ★
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-foreground truncate">{teamLeader.name || teamLeader.email}</p>
                    <Badge className="text-[7.5px] font-black uppercase px-1 py-0 h-3.5 bg-amber-500/10 text-amber-600 border-amber-500/30">
                      Leader
                    </Badge>
                    {isLeaderInactive && (
                      <Badge variant="outline" className="text-[7px] font-bold bg-muted text-muted-foreground border-border/80 uppercase">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                    {teamLeader.designation || teamLeader.role}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] font-bold text-primary shrink-0"
                onClick={() => {
                  onSelectMember({
                    id: teamLeader.id,
                    name: teamLeader.name,
                    email: teamLeader.email,
                    role: teamLeader.role,
                    status: teamLeader.status,
                    designation: teamLeader.designation,
                    avatarUrl: teamLeader.avatarUrl,
                    managerId: null,
                    department: { name: department.name }
                  })
                }}
              >
                Profile
              </Button>
            </div>
          )}
        </div>

        {/* Search & Filter */}
        <div className="p-4 border-b border-border/60 bg-muted/10 shrink-0">
          <div className="relative">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search members by name, title, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8.5 text-xs pl-8.5 bg-background rounded-md border-border"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* Members List with Inside Smooth Scrolling */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar">
          <div className="space-y-2">
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => {
                const isLeaderOfDept = member.id === department.teamLeaderId
                const isMemberInactive = member.status === "INACTIVE"

                return (
                  <div
                    key={member.id}
                    onClick={() => {
                      onOpenChange(false)
                      onSelectMember(member)
                    }}
                    className={cn(
                      "p-3 rounded-md border transition-all cursor-pointer flex items-center justify-between gap-3 group",
                      isMemberInactive
                        ? "bg-muted/20 border-dashed border-muted-foreground/30 opacity-75 grayscale hover:grayscale-0 hover:opacity-100"
                        : isLeaderOfDept
                          ? "bg-primary/[0.03] border-primary/30 hover:border-primary hover:bg-primary/[0.06]"
                          : "bg-card border-border/60 hover:border-primary/40 hover:bg-muted/30 hover:shadow-xs"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="size-9 rounded-full ring-1 ring-border shrink-0">
                        {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.name || ""} />}
                        <AvatarFallback className="text-[10px] font-bold bg-muted text-foreground">
                          {getInitials(member.name || member.email)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                            {member.name || "Unnamed Staff"}
                          </p>
                          {isLeaderOfDept && (
                            <Badge className="text-[7.5px] font-black uppercase px-1 py-0 h-3.5 bg-amber-500/10 text-amber-600 border-amber-500/30">
                              Leader
                            </Badge>
                          )}
                          {isMemberInactive && (
                            <Badge variant="outline" className="text-[7px] font-bold bg-muted text-muted-foreground border-border/80 uppercase">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                          {member.designation || member.role}
                        </p>
                        <p className="text-[9.5px] text-muted-foreground/70 truncate mt-0.5">{member.email}</p>
                      </div>
                    </div>

                    <ArrowRight className="size-3.5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                )
              })
            ) : (
              <div className="text-center py-12 text-muted-foreground text-xs font-medium">
                No members found matching "{search}"
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* =========================================================================
   3. HIGH-END DEPARTMENT HIERARCHY TREE NODE
   ========================================================================= */
interface DepartmentTreeNodeProps {
  department: OrgDepartment
  allDepartments: OrgDepartment[]
  level: number
  layout: "vertical" | "horizontal"
  onSelectMember: (user: OrgUser) => void
  onOpenRoster: (dept: OrgDepartment) => void
  searchQuery?: string
}

const DepartmentTreeNode = ({
  department,
  allDepartments,
  level,
  layout,
  onSelectMember,
  onOpenRoster,
  searchQuery = ""
}: DepartmentTreeNodeProps) => {
  const [isExpanded, setIsExpanded] = useState(true)

  const children = useMemo(
    () => allDepartments.filter((d) => d.parentDepartmentId === department.id),
    [allDepartments, department.id]
  )

  const isSubDept = !!department.parentDepartmentId
  const isVertical = layout === "vertical"
  const hasChildren = children.length > 0

  const teamLeader = department.teamLeader
  const isLeaderInactive = teamLeader?.status === "INACTIVE"
  const directMembers = department.members

  // Avatar preview stack (up to 4 members)
  const avatarStack = useMemo(() => directMembers.slice(0, 4), [directMembers])

  return (
    <div className={cn("flex relative", isVertical ? "flex-col items-center" : "flex-row items-center")}>
      {/* Department Node Card */}
      <div
        className={cn(
          "relative group rounded-md border bg-card/95 backdrop-blur-md shadow-md transition-all duration-300 z-10 select-none",
          "hover:shadow-2xl hover:-translate-y-1.5 animate-fade-in-up",
          "w-80",
          isSubDept
            ? "border-emerald-500/30 hover:border-emerald-500/70 shadow-emerald-500/5 ring-1 ring-emerald-500/10"
            : "border-primary/40 hover:border-primary shadow-primary/10 ring-1 ring-primary/15"
        )}
        style={{ animationDelay: `${level * 40}ms` }}
      >
        {/* Top Header Banner with Gradient Accent */}
        <div
          className={cn(
            "p-3.5 px-4 rounded-t-md border-b flex items-center justify-between gap-2",
            isSubDept
              ? "bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/20"
              : "bg-gradient-to-r from-primary/20 via-primary/5 to-transparent border-primary/20"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={cn(
                "size-8 rounded-md flex items-center justify-center shrink-0 border shadow-xs",
                isSubDept
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-primary/15 border-primary/30 text-primary"
              )}
            >
              {isSubDept ? <Layers className="size-4" /> : <Building2 className="size-4" />}
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-black tracking-tight text-foreground truncate" title={department.name}>
                {department.name}
              </h4>
              <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                {isSubDept ? "Sub-Department" : "Parent Department"}
              </p>
            </div>
          </div>

          <Badge
            variant="outline"
            className={cn(
              "text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full border shadow-xs shrink-0",
              isSubDept
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                : "bg-primary/10 text-primary border-primary/30"
            )}
          >
            {directMembers.length} Staff
          </Badge>
        </div>

        {/* Card Body */}
        <div className="p-4 space-y-3.5">
          {/* Department Description (if any) */}
          {department.description && (
            <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed bg-muted/20 p-2 rounded-sm border border-border/50" title={department.description}>
              {department.description}
            </p>
          )}

          {/* Department Head Spotlight */}
          <div>
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/70 flex items-center gap-1">
                <Crown className={cn("size-2.5", isSubDept ? "text-emerald-500" : "text-amber-500")} />
                {isSubDept ? "Sub-Team Leader" : "Department Head"}
              </span>
              {teamLeader && (
                <div className="flex items-center gap-1">
                  {isLeaderInactive && (
                    <Badge variant="outline" className="text-[7px] font-bold px-1 py-0 bg-muted text-muted-foreground border-border/80 uppercase">
                      Inactive
                    </Badge>
                  )}
                  <span className="text-[8px] font-bold text-muted-foreground/60">{teamLeader.role}</span>
                </div>
              )}
            </div>

            {teamLeader ? (
              <div
                onClick={() =>
                  onSelectMember({
                    id: teamLeader.id,
                    name: teamLeader.name,
                    email: teamLeader.email,
                    role: teamLeader.role,
                    status: teamLeader.status,
                    designation: teamLeader.designation,
                    avatarUrl: teamLeader.avatarUrl,
                    managerId: null,
                    department: { name: department.name }
                  })
                }
                className={cn(
                  "flex items-center gap-2.5 p-2.5 rounded-md border transition-all cursor-pointer shadow-xs group/leader",
                  isLeaderInactive
                    ? "bg-muted/40 border-dashed border-muted-foreground/30 opacity-80 grayscale hover:grayscale-0 hover:opacity-100"
                    : "bg-muted/20 hover:bg-primary/5 hover:border-primary/40 border-border/50"
                )}
              >
                <div className="relative">
                  <Avatar className="size-9 rounded-full ring-2 ring-background border border-border shrink-0">
                    {teamLeader.avatarUrl && <AvatarImage src={teamLeader.avatarUrl} alt={teamLeader.name || ""} />}
                    <AvatarFallback className="text-[9.5px] font-black bg-primary/10 text-primary">
                      {getInitials(teamLeader.name || teamLeader.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "absolute -bottom-1 -right-1 size-4 rounded-full flex items-center justify-center text-white text-[7.5px] shadow-xs",
                      isSubDept ? "bg-emerald-600" : "bg-amber-500"
                    )}
                  >
                    ★
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-foreground truncate group-hover/leader:text-primary transition-colors">
                      {teamLeader.name || teamLeader.email}
                    </p>
                    {isLeaderInactive && (
                      <Badge variant="outline" className="text-[7px] font-bold bg-muted text-muted-foreground border-border/80 uppercase">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                    {teamLeader.designation || "Department Leader"}
                  </p>
                </div>

                <ExternalLink className="size-3 text-muted-foreground/40 group-hover/leader:text-primary shrink-0 opacity-0 group-hover/leader:opacity-100 transition-opacity" />
              </div>
            ) : (
              <div className="p-3 rounded-md bg-muted/10 border border-dashed border-border/60 text-center">
                <p className="text-[10px] text-muted-foreground/60 italic">No designated leader</p>
              </div>
            )}
          </div>

          {/* Members Bar & Action */}
          <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
            {/* Avatar Stack */}
            <div
              onClick={() => onOpenRoster(department)}
              className="flex items-center gap-1.5 min-w-0 cursor-pointer hover:opacity-85 transition-opacity"
              title={`Click to view all ${directMembers.length} department members`}
            >
              {avatarStack.length > 0 ? (
                <div className="flex items-center -space-x-2 shrink-0">
                  {avatarStack.map((m) => (
                    <Avatar key={m.id} className={cn("size-6 rounded-full ring-2 ring-card border border-border shrink-0", m.status === "INACTIVE" && "grayscale opacity-60")}>
                      {m.avatarUrl && <AvatarImage src={m.avatarUrl} />}
                      <AvatarFallback className="text-[7px] font-bold">{getInitials(m.name || "")}</AvatarFallback>
                    </Avatar>
                  ))}
                  {directMembers.length > 4 && (
                    <div className="size-6 rounded-full bg-muted border border-border flex items-center justify-center text-[7.5px] font-bold text-muted-foreground ring-2 ring-card">
                      +{directMembers.length - 4}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-[9.5px] text-muted-foreground/60 italic">No direct members</span>
              )}
            </div>

            {/* View Full Roster Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenRoster(department)}
              className="h-7 text-[10px] font-bold px-2.5 rounded-md border-border/60 hover:bg-primary hover:text-primary-foreground transition-all gap-1.5 shrink-0"
            >
              <Users className="size-3" />
              <span>Roster ({directMembers.length})</span>
            </Button>
          </div>
        </div>

        {/* Sub-Department Branch Toggle Pill (Anchored on bottom border) */}
        {hasChildren && (
          <div
            className={cn(
              "absolute z-20 transition-transform",
              isVertical
                ? "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2"
                : "right-0 top-1/2 translate-x-1/2 -translate-y-1/2"
            )}
          >
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md border transition-all",
                isExpanded
                  ? "bg-card hover:bg-primary hover:text-primary-foreground text-foreground border-border"
                  : "bg-primary text-primary-foreground border-primary hover:scale-105"
              )}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="size-3" />
                  <span>{children.length} Sub-Dept{children.length > 1 ? "s" : ""}</span>
                </>
              ) : (
                <>
                  <ChevronDown className="size-3" />
                  <span>+{children.length} Sub-Dept{children.length > 1 ? "s" : ""}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Sub-Departments Tree Branch */}
      {isExpanded && hasChildren && (
        isVertical ? (
          <div className="flex flex-col items-center">
            {/* 1. Stem down from parent card */}
            <div className="w-0.5 h-10 bg-primary/40 shrink-0" />

            {/* 2. Sibling Row */}
            <div className="flex flex-row items-start justify-center">
              {children.map((child, idx) => (
                <div key={child.id} className="relative px-6 flex flex-col items-center">
                  {/* Continuous Horizontal Bus Line */}
                  {children.length > 1 && (
                    <div
                      className={cn(
                        "absolute top-0 h-0.5 bg-primary/40",
                        idx === 0
                          ? "left-1/2 right-0"
                          : idx === children.length - 1
                            ? "left-0 right-1/2"
                            : "left-0 right-0"
                      )}
                    />
                  )}

                  {/* Drop line into child card */}
                  <div className="w-0.5 h-10 bg-primary/40 shrink-0" />

                  <DepartmentTreeNode
                    department={child}
                    allDepartments={allDepartments}
                    level={level + 1}
                    layout={layout}
                    onSelectMember={onSelectMember}
                    onOpenRoster={onOpenRoster}
                    searchQuery={searchQuery}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-row items-center">
            {/* 1. Stem right from parent card */}
            <div className="h-0.5 w-10 bg-primary/40 shrink-0" />

            {/* 2. Sibling Column */}
            <div className="flex flex-col items-start justify-center">
              {children.map((child, idx) => (
                <div key={child.id} className="relative py-4 flex flex-row items-center">
                  {/* Continuous Vertical Bus Line */}
                  {children.length > 1 && (
                    <div
                      className={cn(
                        "absolute left-0 w-0.5 bg-primary/40",
                        idx === 0
                          ? "top-1/2 bottom-0"
                          : idx === children.length - 1
                            ? "top-0 bottom-1/2"
                            : "top-0 bottom-0"
                      )}
                    />
                  )}

                  {/* Branch line into child card */}
                  <div className="h-0.5 w-10 bg-primary/40 shrink-0" />

                  <DepartmentTreeNode
                    department={child}
                    allDepartments={allDepartments}
                    level={level + 1}
                    layout={layout}
                    onSelectMember={onSelectMember}
                    onOpenRoster={onOpenRoster}
                    searchQuery={searchQuery}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}

/* =========================================================================
   4. HIGH-END REPORTING LINES TREE NODE
   ========================================================================= */
interface ReportingTreeNodeProps {
  user: OrgUser
  allUsers: OrgUser[]
  level: number
  layout: "vertical" | "horizontal"
  onSelectMember: (user: OrgUser) => void
}

const ReportingTreeNode = ({ user, allUsers, level, layout, onSelectMember }: ReportingTreeNodeProps) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const children = useMemo(() => allUsers.filter((u) => u.managerId === user.id && u.status !== "RESIGNED" && u.status !== "TERMINATED"), [allUsers, user.id])
  const hasChildren = children.length > 0
  const isVertical = layout === "vertical"
  const isLeader = !!(user.ledDepartments && user.ledDepartments.length > 0) || !!(user.departments && user.departments.some(d => d.isLeader))
  const isInactive = user.status === "INACTIVE"

  return (
    <div className={cn("flex relative", isVertical ? "flex-col items-center" : "flex-row items-center")}>
      {/* Employee Executive Card */}
      <div
        className={cn(
          "relative group rounded-md border bg-card/95 backdrop-blur-md shadow-md transition-all duration-300 z-10 select-none",
          "hover:shadow-2xl hover:border-primary hover:-translate-y-1.5 animate-fade-in-up",
          isInactive
            ? "border-dashed border-muted-foreground/40 bg-muted/30 opacity-75 grayscale hover:grayscale-0 hover:opacity-100 ring-1 ring-muted-foreground/20"
            : isLeader
              ? "border-amber-500/40 ring-1 ring-amber-500/15"
              : "border-border/80",
          "w-72"
        )}
        style={{ animationDelay: `${level * 35}ms` }}
      >
        {/* Top Header Banner with Role & Dept (perfectly matched to rounded-t-md) */}
        <div
          className={cn(
            "p-3 px-3.5 rounded-t-md border-b flex items-center justify-between gap-2",
            isInactive
              ? "bg-gradient-to-r from-muted/60 via-muted/30 to-transparent border-border/60"
              : user.role === "ADMIN" || user.role === "SYSTEM_ADMIN"
                ? "bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/20"
                : isLeader
                  ? "bg-gradient-to-r from-primary/20 via-primary/5 to-transparent border-primary/20"
                  : "bg-gradient-to-r from-muted/40 via-muted/20 to-transparent border-border/40"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn(
                "size-6 rounded-md flex items-center justify-center shrink-0 border shadow-xs",
                isInactive
                  ? "bg-muted text-muted-foreground border-border"
                  : isLeader
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400"
                    : "bg-primary/15 border-primary/30 text-primary"
              )}
            >
              {isLeader ? <Crown className="size-3" /> : <User className="size-3" />}
            </div>
            <span className="text-[10px] font-bold text-foreground truncate">
              {user.department?.name || "General"}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isInactive && (
              <Badge
                variant="outline"
                className="text-[7.5px] font-bold uppercase px-1.5 py-0.5 rounded-full border bg-muted text-muted-foreground border-border/80 shadow-xs"
              >
                Inactive
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn(
                "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border shadow-xs",
                isInactive
                  ? "bg-muted/40 text-muted-foreground border-border/50"
                  : isLeader
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                    : "bg-muted/40 text-muted-foreground border-border/50"
              )}
            >
              {user.role}
            </Badge>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-3.5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Avatar className={cn("size-11 rounded-full ring-2 ring-background border border-border shadow-xs", isInactive && "grayscale opacity-80")}>
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name || ""} className="object-cover" />}
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-black uppercase">
                  {getInitials(user.name || user.email)}
                </AvatarFallback>
              </Avatar>
              {isLeader && (
                <div
                  className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[7.5px] shadow-xs"
                  title="Team Leader"
                >
                  ★
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div
                onClick={() => onSelectMember(user)}
                className="cursor-pointer group/title flex items-center justify-between"
              >
                <h4 className="text-xs font-bold text-foreground tracking-tight truncate group-hover/title:text-primary transition-colors">
                  {user.name || "Unknown Staff"}
                </h4>
              </div>
              <p className={cn("text-[10px] font-semibold uppercase tracking-wider truncate", isInactive ? "text-muted-foreground" : "text-primary")}>
                {user.designation || user.role}
              </p>
              <p className="text-[9px] text-muted-foreground/70 truncate mt-0.5">{user.email}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-border/50 flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectMember(user)}
              className="h-6.5 px-2.5 text-[9px] font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-all rounded-md"
            >
              Profile
            </Button>
          </div>
        </div>

        {/* Expand/Collapse Pill on Connector */}
        {hasChildren && (
          <div
            className={cn(
              "absolute z-20 transition-transform",
              isVertical
                ? "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2"
                : "right-0 top-1/2 translate-x-1/2 -translate-y-1/2"
            )}
          >
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[8.5px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md border transition-all",
                isExpanded
                  ? "bg-card hover:bg-primary hover:text-primary-foreground text-foreground border-border"
                  : "bg-primary text-primary-foreground border-primary hover:scale-105"
              )}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="size-3" />
                  <span>{children.length} Reports</span>
                </>
              ) : (
                <>
                  <ChevronDown className="size-3" />
                  <span>+{children.length} Reports</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Direct Reports Tree Branch */}
      {isExpanded && hasChildren && (
        isVertical ? (
          <div className="flex flex-col items-center">
            {/* 1. Stem down from parent card */}
            <div className="w-0.5 h-10 bg-primary/40 shrink-0" />

            {/* 2. Sibling Row */}
            <div className="flex flex-row items-start justify-center">
              {children.map((child, idx) => (
                <div key={child.id} className="relative px-6 flex flex-col items-center">
                  {/* Continuous Horizontal Bus Line */}
                  {children.length > 1 && (
                    <div
                      className={cn(
                        "absolute top-0 h-0.5 bg-primary/40",
                        idx === 0
                          ? "left-1/2 right-0"
                          : idx === children.length - 1
                            ? "left-0 right-1/2"
                            : "left-0 right-0"
                      )}
                    />
                  )}

                  {/* Drop line into child card */}
                  <div className="w-0.5 h-10 bg-primary/40 shrink-0" />

                  <ReportingTreeNode
                    user={child}
                    allUsers={allUsers}
                    level={level + 1}
                    layout={layout}
                    onSelectMember={onSelectMember}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-row items-center">
            {/* 1. Stem right from parent card */}
            <div className="h-0.5 w-10 bg-primary/40 shrink-0" />

            {/* 2. Sibling Column */}
            <div className="flex flex-col items-start justify-center">
              {children.map((child, idx) => (
                <div key={child.id} className="relative py-4 flex flex-row items-center">
                  {/* Continuous Vertical Bus Line */}
                  {children.length > 1 && (
                    <div
                      className={cn(
                        "absolute left-0 w-0.5 bg-primary/40",
                        idx === 0
                          ? "top-1/2 bottom-0"
                          : idx === children.length - 1
                            ? "top-0 bottom-1/2"
                            : "top-0 bottom-0"
                      )}
                    />
                  )}

                  {/* Branch line into child card */}
                  <div className="h-0.5 w-10 bg-primary/40 shrink-0" />

                  <ReportingTreeNode
                    user={child}
                    allUsers={allUsers}
                    level={level + 1}
                    layout={layout}
                    onSelectMember={onSelectMember}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}

/* =========================================================================
   5. DIRECTORY ACCORDION LIST ITEMS (FOR LIST MODE / MOBILE)
   ========================================================================= */
interface SubDeptAccordionItemProps {
  subDept: OrgDepartment
  onSelectMember: (user: OrgUser) => void
}

const SubDeptAccordionItem = ({ subDept, onSelectMember }: SubDeptAccordionItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const teamMembers = useMemo(
    () => subDept.members.filter((m) => m.id !== subDept.teamLeaderId),
    [subDept.members, subDept.teamLeaderId]
  )
  const isLeaderInactive = subDept.teamLeader?.status === "INACTIVE"

  return (
    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/[0.02] shadow-xs overflow-hidden">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors flex items-center justify-between gap-2 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Layers className="size-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold text-foreground truncate">{subDept.name}</span>
          <Badge variant="outline" className="text-[8px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 shrink-0">
            {subDept.members.length} members
          </Badge>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {subDept.teamLeader && (
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              Sub-TL: <span className="font-semibold text-foreground">{subDept.teamLeader.name}</span>
              {isLeaderInactive && " (Inactive)"}
            </span>
          )}
          <div className="size-6 rounded-md flex items-center justify-center hover:bg-emerald-500/20 transition-colors">
            {isExpanded ? <ChevronDown className="size-3.5 text-emerald-600" /> : <ChevronRight className="size-3.5 text-emerald-600" />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 pt-2.5 space-y-2.5 border-t border-emerald-500/20 bg-background/60 animate-fade-in">
          {/* Sub-Team Leader */}
          {subDept.teamLeader && (
            <div
              onClick={() =>
                onSelectMember({
                  id: subDept.teamLeader!.id,
                  name: subDept.teamLeader!.name,
                  email: subDept.teamLeader!.email,
                  role: subDept.teamLeader!.role,
                  status: subDept.teamLeader!.status,
                  designation: subDept.teamLeader!.designation,
                  avatarUrl: subDept.teamLeader!.avatarUrl,
                  managerId: null,
                  department: { name: subDept.name }
                })
              }
              className={cn(
                "flex items-center gap-2.5 p-2 rounded-md border transition-colors cursor-pointer",
                isLeaderInactive
                  ? "border-dashed border-muted-foreground/30 bg-muted/40 opacity-80 grayscale hover:grayscale-0 hover:opacity-100"
                  : "border-emerald-500/30 bg-emerald-500/[0.04] hover:bg-emerald-500/10"
              )}
            >
              <Avatar className="size-7 rounded-full ring-1 ring-emerald-500/30 shrink-0">
                {subDept.teamLeader.avatarUrl && <AvatarImage src={subDept.teamLeader.avatarUrl} />}
                <AvatarFallback className="text-[8px] font-bold bg-emerald-500/20 text-emerald-700">
                  {getInitials(subDept.teamLeader.name || subDept.teamLeader.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] font-bold text-foreground truncate">{subDept.teamLeader.name}</p>
                  <Badge className="text-[7px] font-black uppercase px-1 py-0 h-3 bg-emerald-600 text-white">Sub-TL</Badge>
                  {isLeaderInactive && (
                    <Badge variant="outline" className="text-[7px] font-bold bg-muted text-muted-foreground border-border/80 uppercase">
                      Inactive
                    </Badge>
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground truncate">{subDept.teamLeader.designation || subDept.teamLeader.role}</p>
              </div>
            </div>
          )}

          {/* Members Grid */}
          {teamMembers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
              {teamMembers.map((m) => {
                const isMemberInactive = m.status === "INACTIVE"
                return (
                  <div
                    key={m.id}
                    onClick={() => onSelectMember(m)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-md border transition-all cursor-pointer group",
                      isMemberInactive
                        ? "border-dashed border-muted-foreground/30 bg-muted/30 opacity-75 grayscale hover:grayscale-0 hover:opacity-100"
                        : "border-border/50 hover:border-emerald-500/40 bg-card hover:bg-muted/20"
                    )}
                  >
                    <Avatar className="size-6 rounded-full shrink-0">
                      {m.avatarUrl && <AvatarImage src={m.avatarUrl} />}
                      <AvatarFallback className="text-[7px] font-bold">{getInitials(m.name || "")}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="text-[10.5px] font-bold text-foreground truncate group-hover:text-emerald-600 transition-colors">
                          {m.name}
                        </p>
                        {isMemberInactive && (
                          <Badge variant="outline" className="text-[6.5px] font-bold bg-muted text-muted-foreground border-border/80 px-1 py-0">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-[8.5px] text-muted-foreground truncate">{m.designation || m.role}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            !subDept.teamLeader && (
              <p className="text-[10px] text-muted-foreground/60 italic py-1 text-center">No members assigned</p>
            )
          )}
        </div>
      )}
    </div>
  )
}

interface DeptAccordionItemProps {
  dept: OrgDepartment
  allDepartments: OrgDepartment[]
  onSelectMember: (user: OrgUser) => void
  onOpenRoster: (dept: OrgDepartment) => void
}

const DeptAccordionItem = ({ dept, allDepartments, onSelectMember, onOpenRoster }: DeptAccordionItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const children = useMemo(() => allDepartments.filter((d) => d.parentDepartmentId === dept.id), [allDepartments, dept.id])
  const teamMembers = useMemo(() => dept.members.filter((m) => m.id !== dept.teamLeaderId), [dept.members, dept.teamLeaderId])
  const isLeaderInactive = dept.teamLeader?.status === "INACTIVE"

  return (
    <div className="rounded-md border border-border bg-card shadow-xs overflow-hidden">
      {/* Department Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 bg-muted/15 hover:bg-muted/25 transition-colors border-b border-border/60 flex items-center justify-between gap-3 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="size-10 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
            <Building2 className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-foreground truncate">{dept.name}</h4>
              <Badge variant="outline" className="text-[8.5px] font-black uppercase px-2 py-0.5 bg-primary/10 text-primary border-primary/20">
                {dept.members.length} Staff
              </Badge>
              {children.length > 0 && (
                <Badge variant="outline" className="text-[8.5px] font-bold bg-muted/50 text-muted-foreground border-border/50">
                  {children.length} Sub-Depts
                </Badge>
              )}
            </div>
            {dept.teamLeader && (
              <p className="text-[10.5px] text-muted-foreground mt-0.5">
                Head: <span className="font-semibold text-foreground">{dept.teamLeader.name}</span> ({dept.teamLeader.designation || dept.teamLeader.role})
                {isLeaderInactive && " (Inactive)"}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onOpenRoster(dept)
            }}
            className="h-8 text-xs font-bold rounded-md gap-1.5"
          >
            <Users className="size-3.5 text-primary" />
            <span>Roster</span>
          </Button>

          <div className="size-8 rounded-md border border-border/60 hover:bg-muted text-muted-foreground hover:text-primary transition-colors flex items-center justify-center">
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </div>
        </div>
      </div>

      {/* Accordion Body */}
      {isExpanded && (
        <div className="p-4 space-y-4 animate-fade-in bg-background/50">
          {/* Department Head Profile */}
          {dept.teamLeader && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70 px-1 mb-2">
                Department Leadership
              </p>
              <div
                onClick={() =>
                  onSelectMember({
                    id: dept.teamLeader!.id,
                    name: dept.teamLeader!.name,
                    email: dept.teamLeader!.email,
                    role: dept.teamLeader!.role,
                    status: dept.teamLeader!.status,
                    designation: dept.teamLeader!.designation,
                    avatarUrl: dept.teamLeader!.avatarUrl,
                    managerId: null,
                    department: { name: dept.name }
                  })
                }
                className={cn(
                  "flex items-center gap-3 p-3 rounded-md border transition-colors cursor-pointer shadow-xs",
                  isLeaderInactive
                    ? "border-dashed border-muted-foreground/30 bg-muted/40 opacity-80 grayscale hover:grayscale-0 hover:opacity-100"
                    : "border-primary/30 bg-primary/[0.03] hover:bg-primary/[0.08]"
                )}
              >
                <Avatar className="size-9 rounded-full ring-2 ring-primary/20 shrink-0">
                  {dept.teamLeader.avatarUrl && <AvatarImage src={dept.teamLeader.avatarUrl} />}
                  <AvatarFallback className="text-[9.5px] font-black bg-primary/10 text-primary">
                    {getInitials(dept.teamLeader.name || dept.teamLeader.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-foreground truncate">{dept.teamLeader.name || dept.teamLeader.email}</p>
                    <Badge className="text-[7.5px] font-black uppercase px-1.5 py-0 h-4 bg-amber-500 text-white gap-0.5">
                      <Crown className="size-2.5" /> Head
                    </Badge>
                    {isLeaderInactive && (
                      <Badge variant="outline" className="text-[7px] font-bold bg-muted text-muted-foreground border-border/80 uppercase">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <p className="text-[9.5px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                    {dept.teamLeader.designation || dept.teamLeader.role}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sub-Departments Accordion */}
          {children.length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70 px-1">
                Sub-Departments ({children.length})
              </p>
              <div className="space-y-2">
                {children.map((sub) => (
                  <SubDeptAccordionItem key={sub.id} subDept={sub} onSelectMember={onSelectMember} />
                ))}
              </div>
            </div>
          )}

          {/* Direct Team Members */}
          {teamMembers.length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70 px-1">
                Direct Team Members ({teamMembers.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {teamMembers.map((m) => {
                  const isMemberInactive = m.status === "INACTIVE"
                  return (
                    <div
                      key={m.id}
                      onClick={() => onSelectMember(m)}
                      className={cn(
                        "flex items-center gap-2.5 p-2 rounded-md border transition-all cursor-pointer group",
                        isMemberInactive
                          ? "border-dashed border-muted-foreground/30 bg-muted/30 opacity-75 grayscale hover:grayscale-0 hover:opacity-100"
                          : "border-border/50 hover:border-primary/40 bg-card hover:bg-muted/20"
                      )}
                    >
                      <Avatar className="size-7 rounded-full shrink-0">
                        {m.avatarUrl && <AvatarImage src={m.avatarUrl} />}
                        <AvatarFallback className="text-[8px] font-bold">{getInitials(m.name || "")}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="text-[11px] font-bold text-foreground truncate group-hover:text-primary transition-colors">
                            {m.name}
                          </p>
                          {isMemberInactive && (
                            <Badge variant="outline" className="text-[6.5px] font-bold bg-muted text-muted-foreground border-border/80 px-1 py-0">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <p className="text-[9px] text-muted-foreground truncate">{m.designation || m.role}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface ReportingAccordionItemProps {
  user: OrgUser
  allUsers: OrgUser[]
  onSelectMember: (user: OrgUser) => void
  level?: number
}

const ReportingAccordionItem = ({ user, allUsers, onSelectMember, level = 0 }: ReportingAccordionItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const directReports = useMemo(() => allUsers.filter((u) => u.managerId === user.id && u.status !== "RESIGNED" && u.status !== "TERMINATED"), [allUsers, user.id])
  const hasReports = directReports.length > 0
  const isLeader = !!(user.ledDepartments && user.ledDepartments.length > 0) || !!(user.departments && user.departments.some(d => d.isLeader))
  const isInactive = user.status === "INACTIVE"

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "p-3 rounded-md border bg-card hover:border-primary/50 transition-all flex items-center justify-between gap-3 shadow-xs",
          isInactive
            ? "border-dashed border-muted-foreground/30 bg-muted/20 opacity-75 grayscale hover:grayscale-0 hover:opacity-100"
            : isLeader
              ? "border-amber-500/30 bg-amber-500/[0.02]"
              : ""
        )}
      >
        <div
          onClick={() => onSelectMember(user)}
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group"
        >
          <div className="relative shrink-0">
            <Avatar className="size-9 rounded-full ring-1 ring-border">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} />}
              <AvatarFallback className="text-[9px] font-bold">{getInitials(user.name || "")}</AvatarFallback>
            </Avatar>
            {isLeader && (
              <div className="absolute -top-1 -left-1 size-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <Crown className="size-2" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                {user.name || "Unknown Staff"}
              </p>
              <Badge variant="outline" className="text-[7.5px] font-bold px-1.5 py-0 h-3.5">
                {user.department?.name || "General"}
              </Badge>
              {isInactive && (
                <Badge variant="outline" className="text-[7px] font-bold bg-muted text-muted-foreground border-border/80 uppercase">
                  Inactive
                </Badge>
              )}
            </div>
            <p className={cn("text-[9.5px] uppercase tracking-wider truncate", isInactive ? "text-muted-foreground" : "text-muted-foreground")}>
              {user.designation || user.role}
            </p>
          </div>
        </div>

        {hasReports && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-md border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <span>{directReports.length} Reports</span>
            {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </button>
        )}
      </div>

      {isExpanded && hasReports && (
        <div className="pl-6 border-l-2 border-primary/20 ml-4 space-y-1.5 pt-1">
          {directReports.map((report) => (
            <ReportingAccordionItem
              key={report.id}
              user={report}
              allUsers={allUsers}
              onSelectMember={onSelectMember}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   6. MAIN ORGANIZATION CHART COMPONENT
   ========================================================================= */
export function OrgChart({
  initialData,
  mode = "reporting",
  departmentsOnly
}: {
  initialData: OrgData | OrgUser[]
  mode?: "departments" | "reporting" | "both"
  departmentsOnly?: boolean
}) {
  const effectiveMode = departmentsOnly ? "departments" : mode
  const [hierarchyMode, setHierarchyMode] = useState<"departments" | "reporting">(
    effectiveMode === "departments" ? "departments" : "reporting"
  )
  const [search, setSearch] = useState("")
  const [selectedParentDeptFilter, setSelectedParentDeptFilter] = useState<string>("ALL")
  const [zoom, setZoom] = useState(1)
  const [layout, setLayout] = useState<"vertical" | "horizontal">("vertical")
  const [viewMode, setViewMode] = useState<"chart" | "list">("chart")

  // Modals & Drawers State
  const [selectedProfileUser, setSelectedProfileUser] = useState<OrgUser | null>(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [selectedRosterDept, setSelectedRosterDept] = useState<OrgDepartment | null>(null)
  const [isRosterOpen, setIsRosterOpen] = useState(false)

  // Canvas Pan/Zoom References
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [startX, setStartX] = useState(0)
  const [startY, setStartY] = useState(0)

  // Normalize initialData
  const users: OrgUser[] = useMemo(() => {
    if (Array.isArray(initialData)) return initialData
    return initialData.users || []
  }, [initialData])

  const departments: OrgDepartment[] = useMemo(() => {
    if (Array.isArray(initialData)) return []
    return initialData.departments || []
  }, [initialData])

  // Synchronous refs for smooth cursor-anchored wheel zooming
  const zoomRef = useRef(zoom)
  const positionRef = useRef(position)

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    positionRef.current = position
  }, [position])

  // Native wheel zoom listener with precise cursor anchoring
  useEffect(() => {
    const container = containerRef.current
    if (!container || viewMode !== "chart") return

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault()

      const rect = container.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const containerCenterX = rect.width / 2
      const containerCenterY = rect.height / 2

      const mouseOffsetX = mouseX - containerCenterX
      const mouseOffsetY = mouseY - containerCenterY

      const currentZoom = zoomRef.current
      const currentPos = positionRef.current

      // Proportional exponential factor
      const zoomFactor = Math.exp(-e.deltaY * 0.0018)
      const nextZoom = Math.min(2.5, Math.max(0.3, currentZoom * zoomFactor))

      if (Math.abs(nextZoom - currentZoom) < 0.0001) return

      const scaleRatio = nextZoom / currentZoom

      // Fixed point formula
      const nextPosX = mouseOffsetX - (mouseOffsetX - currentPos.x) * scaleRatio
      const nextPosY = mouseOffsetY - (mouseOffsetY - currentPos.y) * scaleRatio

      zoomRef.current = nextZoom
      positionRef.current = { x: nextPosX, y: nextPosY }

      setZoom(nextZoom)
      setPosition({ x: nextPosX, y: nextPosY })
    }

    container.addEventListener("wheel", handleNativeWheel, { passive: false })
    return () => {
      container.removeEventListener("wheel", handleNativeWheel)
    }
  }, [viewMode])

  // Global grabbing cursor during active drag
  useEffect(() => {
    if (isDragging) {
      const prevUserSelect = document.body.style.userSelect
      const prevCursor = document.body.style.cursor
      document.body.style.userSelect = "none"
      document.body.style.cursor = "grabbing"

      return () => {
        document.body.style.userSelect = prevUserSelect
        document.body.style.cursor = prevCursor
      }
    }
  }, [isDragging])

  // Pointer drag event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, select, textarea, [role="button"]')) return

    e.preventDefault()
    setIsDragging(true)
    setStartX(e.clientX - position.x)
    setStartY(e.clientY - position.y)

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch (_) { }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    e.preventDefault()
    setPosition({
      x: e.clientX - startX,
      y: e.clientY - startY
    })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false)
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
      } catch (_) { }
    }
  }

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false)
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
      } catch (_) { }
    }
  }

  // Zoom Button Helper
  const handleZoomButton = (delta: number) => {
    const currentZoom = zoomRef.current
    const currentPos = positionRef.current
    const nextZoom = Math.min(2.5, Math.max(0.3, currentZoom + delta))
    const scaleRatio = nextZoom / currentZoom

    const nextPos = {
      x: currentPos.x * scaleRatio,
      y: currentPos.y * scaleRatio
    }

    zoomRef.current = nextZoom
    positionRef.current = nextPos
    setZoom(nextZoom)
    setPosition(nextPos)
  }

  const handleResetCanvas = () => {
    zoomRef.current = 1
    positionRef.current = { x: 0, y: 0 }
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }

  // Open member details modal
  const handleSelectMember = useCallback((user: OrgUser) => {
    setSelectedProfileUser(user)
    setIsProfileOpen(true)
  }, [])

  // Open department roster sheet
  const handleOpenRoster = useCallback((dept: OrgDepartment) => {
    setSelectedRosterDept(dept)
    setIsRosterOpen(true)
  }, [])

  // Switch to Reporting Lines and center
  const handleFocusUserInReporting = useCallback((user: OrgUser) => {
    setHierarchyMode("reporting")
    setSearch(user.name || user.email)
    handleResetCanvas()
  }, [])

  // Top-level Parent Departments
  const parentDepartments = useMemo(() => {
    return departments.filter((d) => !d.parentDepartmentId)
  }, [departments])

  // Filtered Root Departments (considering department filter and search)
  const rootDepartments = useMemo(() => {
    let list = parentDepartments

    if (selectedParentDeptFilter !== "ALL") {
      list = list.filter((d) => d.id === selectedParentDeptFilter)
    }

    if (search) {
      const q = search.toLowerCase()
      list = departments.filter((d) => {
        const matchesName = d.name.toLowerCase().includes(q)
        const matchesLeader = d.teamLeader?.name?.toLowerCase().includes(q)
        const matchesMember = d.members.some((m) => m.name?.toLowerCase().includes(q) || m.designation?.toLowerCase().includes(q))
        return matchesName || matchesLeader || matchesMember
      })
    }

    return list
  }, [parentDepartments, departments, selectedParentDeptFilter, search])

  // Filtered Root Users for Reporting Lines
  const rootUsers = useMemo(() => {
    if (search) {
      const q = search.toLowerCase()
      return users.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.designation?.toLowerCase().includes(q) ||
          u.department?.name.toLowerCase().includes(q)
      )
    }
    return users.filter((u) => !u.managerId || !users.find((m) => m.id === u.managerId))
  }, [users, search])

  const isVertical = layout === "vertical"
  const isMasterView = selectedParentDeptFilter === "ALL" && !search

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full space-y-3 max-w-full overflow-hidden">
      {/* Top Header Control Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2 px-1 shrink-0 w-full">
        {/* Hierarchy Mode Selector & Department Filter */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Dual Hierarchy Mode Selector (rendered only if effectiveMode === 'both') */}
          {effectiveMode === "both" ? (
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-md border border-border shrink-0 shadow-xs">
              <Button
                variant={hierarchyMode === "departments" ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 text-xs font-bold px-2.5 sm:px-3.5 rounded-md flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer",
                  hierarchyMode === "departments" && "shadow-xs bg-background text-primary font-black ring-1 ring-primary/20"
                )}
                onClick={() => setHierarchyMode("departments")}
              >
                <Building2 className="size-3.5 sm:size-4 text-primary" />
                <span className="hidden sm:inline">Department Hierarchy</span>
                <span className="sm:hidden">Departments</span>
              </Button>

              <Button
                variant={hierarchyMode === "reporting" ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 text-xs font-bold px-2.5 sm:px-3.5 rounded-md flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer",
                  hierarchyMode === "reporting" && "shadow-xs bg-background text-primary font-black ring-1 ring-primary/20"
                )}
                onClick={() => setHierarchyMode("reporting")}
              >
                <Users className="size-3.5 sm:size-4 text-primary" />
                <span className="hidden sm:inline">Reporting Lines</span>
                <span className="sm:hidden">Reporting</span>
              </Button>
            </div>
          ) : effectiveMode === "departments" ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/40 border border-border shrink-0 text-foreground font-bold text-xs shadow-xs">
              <Building2 className="size-4 text-primary" />
              <span>Department Hierarchy</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/40 border border-border shrink-0 text-foreground font-bold text-xs shadow-xs">
              <Users className="size-4 text-primary" />
              <span>Reporting Structure</span>
            </div>
          )}

          {/* Parent Department Filter (Only in Department Mode) */}
          {hierarchyMode === "departments" && parentDepartments.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <select
                value={selectedParentDeptFilter}
                onChange={(e) => setSelectedParentDeptFilter(e.target.value)}
                className="h-8 text-xs font-semibold px-2.5 sm:px-3 bg-background border border-border rounded-md text-foreground focus:ring-2 focus:ring-primary/20 outline-none shadow-xs"
              >
                <option value="ALL">All Departments ({parentDepartments.length})</option>
                {parentDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.members.length} staff)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Live Search */}
          <div className="relative flex-1 sm:w-64 min-w-[160px]">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={
                hierarchyMode === "departments"
                  ? "Search dept, leader, or staff..."
                  : "Search personnel, role, or designation..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8.5 pr-8 text-xs bg-background rounded-md border-border focus:ring-2 focus:ring-primary/20 shadow-xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* View Mode & Canvas Options */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-2 lg:pt-0">
          {/* Canvas Tree vs Directory List */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-md border border-border shrink-0 shadow-xs">
            <Button
              variant={viewMode === "chart" ? "secondary" : "ghost"}
              size="sm"
              className={cn("h-7 px-2.5 sm:px-3 text-xs font-bold rounded-md gap-1.5 cursor-pointer", viewMode === "chart" && "bg-background shadow-xs text-primary")}
              onClick={() => setViewMode("chart")}
            >
              <Network className="size-3.5 text-primary" />
              <span className="hidden sm:inline">Canvas Tree</span>
              <span className="sm:hidden">Tree</span>
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className={cn("h-7 px-2.5 sm:px-3 text-xs font-bold rounded-md gap-1.5 cursor-pointer", viewMode === "list" && "bg-background shadow-xs text-primary")}
              onClick={() => setViewMode("list")}
            >
              <List className="size-3.5 text-primary" />
              <span className="hidden sm:inline">Directory List</span>
              <span className="sm:hidden">List</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === "chart" ? (
        <div className="flex flex-col flex-1 min-h-0 h-full relative overflow-hidden">
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onDragStart={(e) => e.preventDefault()}
            className={cn(
              "w-full flex-1 min-h-0 h-full overflow-hidden bg-muted/5 rounded-md border border-border relative select-none flex items-center justify-center touch-none shadow-inner",
              isDragging ? "cursor-grabbing" : "cursor-grab"
            )}
          >
            {/* Dot Grid Matrix Background Pattern */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.04]"
              style={{
                backgroundImage: `radial-gradient(circle, currentColor 1.2px, transparent 1.2px)`,
                backgroundSize: "28px 28px",
                backgroundPosition: `${position.x}px ${position.y}px`
              }}
            />

            {/* Transformed Canvas Nodes Layer */}
            <div
              className="min-w-max min-h-max p-[140px] origin-center pointer-events-none will-change-transform"
              style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})` }}
            >
              <div className="pointer-events-auto flex items-center justify-center">
                {hierarchyMode === "departments" ? (
                  rootDepartments.length > 0 ? (
                    isMasterView && rootDepartments.length > 1 ? (
                      /* Connected Master Organization Tree */
                      <div className={cn("flex items-center", isVertical ? "flex-col" : "flex-row")}>
                        {/* Company Hub Node */}
                        <div className="p-3 px-5 rounded-md bg-primary text-primary-foreground shadow-xl border border-primary/20 flex items-center gap-3 z-10 select-none animate-fade-in-up">
                          <div className="size-8 rounded-md bg-white/20 flex items-center justify-center">
                            <Building2 className="size-4.5" />
                          </div>
                          <div>
                            <h3 className="text-xs font-black tracking-tight">Organization Hierarchy</h3>
                            <p className="text-[8.5px] font-bold opacity-80 uppercase tracking-wider">
                              {departments.length} Departments · {users.length} Total Personnel
                            </p>
                          </div>
                        </div>

                        {isVertical ? (
                          <div className="flex flex-col items-center">
                            {/* Stem from Company Hub */}
                            <div className="w-0.5 h-10 bg-primary/40 shrink-0" />

                            {/* Top-Level Departments Sibling Row */}
                            <div className="flex flex-row items-start justify-center">
                              {rootDepartments.map((dept, idx) => (
                                <div key={dept.id} className="relative px-6 flex flex-col items-center">
                                  {/* Horizontal Bus Connector Line across sibling roots */}
                                  {rootDepartments.length > 1 && (
                                    <div
                                      className={cn(
                                        "absolute top-0 h-0.5 bg-primary/40",
                                        idx === 0
                                          ? "left-1/2 right-0"
                                          : idx === rootDepartments.length - 1
                                            ? "left-0 right-1/2"
                                            : "left-0 right-0"
                                      )}
                                    />
                                  )}

                                  {/* Drop vertical connector to root node */}
                                  <div className="w-0.5 h-8 bg-primary/40" />

                                  <DepartmentTreeNode
                                    department={dept}
                                    allDepartments={departments}
                                    level={0}
                                    layout={layout}
                                    onSelectMember={handleSelectMember}
                                    onOpenRoster={handleOpenRoster}
                                    searchQuery={search}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          /* Horizontal Master Flow */
                          <div className="flex flex-row items-center">
                            <div className="w-10 h-0.5 bg-primary/40 shrink-0" />
                            <div className="flex flex-col items-start justify-center">
                              {rootDepartments.map((dept, idx) => (
                                <div key={dept.id} className="relative py-4 flex flex-row items-center">
                                  {rootDepartments.length > 1 && (
                                    <div
                                      className={cn(
                                        "absolute left-0 w-0.5 bg-primary/40",
                                        idx === 0
                                          ? "top-1/2 bottom-0"
                                          : idx === rootDepartments.length - 1
                                            ? "top-0 bottom-1/2"
                                            : "top-0 bottom-0"
                                      )}
                                    />
                                  )}
                                  <div className="w-8 h-0.5 bg-primary/40" />
                                  <DepartmentTreeNode
                                    department={dept}
                                    allDepartments={departments}
                                    level={0}
                                    layout={layout}
                                    onSelectMember={handleSelectMember}
                                    onOpenRoster={handleOpenRoster}
                                    searchQuery={search}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Single Department Branch Focus */
                      <div className={cn("flex items-start", isVertical ? "flex-row gap-12" : "flex-col gap-10")}>
                        {rootDepartments.map((dept) => (
                          <DepartmentTreeNode
                            key={dept.id}
                            department={dept}
                            allDepartments={departments}
                            level={0}
                            layout={layout}
                            onSelectMember={handleSelectMember}
                            onOpenRoster={handleOpenRoster}
                            searchQuery={search}
                          />
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center py-28 text-center">
                      <div className="size-16 rounded-md bg-muted/40 flex items-center justify-center mb-4 border border-border shadow-xs">
                        <Building2 className="size-8 text-muted-foreground/50" />
                      </div>
                      <h4 className="text-sm font-bold text-foreground">No Departments Found</h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                        {search ? `No departments match "${search}"` : "Create your first department in the Admin panel to start charting."}
                      </p>
                    </div>
                  )
                ) : rootUsers.length > 0 ? (
                  <div className={cn("flex items-start", isVertical ? "flex-row gap-12" : "flex-col gap-10")}>
                    {rootUsers.map((user) => (
                      <ReportingTreeNode
                        key={user.id}
                        user={user}
                        allUsers={users}
                        level={0}
                        layout={layout}
                        onSelectMember={handleSelectMember}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-28 text-center">
                    <div className="size-16 rounded-md bg-muted/40 flex items-center justify-center mb-4 border border-border shadow-xs">
                      <Users className="size-8 text-muted-foreground/50" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">No Personnel Found</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      {search ? `No reporting lines match "${search}"` : "Add employees with manager relationships to visualize reporting lines."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Floating Bottom HUD Toolbar (Figma / Miro style - Mobile Friendly) */}
            <div
              className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 rounded-lg bg-background/95 backdrop-blur-md border border-border shadow-xl ring-1 ring-black/5 max-w-[calc(100%-1rem)] select-none"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {/* Orientation Switcher */}
              <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-md shrink-0">
                <Button
                  variant={layout === "vertical" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-7 px-2 sm:px-2.5 text-[10px] font-bold uppercase rounded-md cursor-pointer gap-1",
                    layout === "vertical" && "bg-background shadow-xs text-primary"
                  )}
                  onClick={() => setLayout("vertical")}
                  title="Vertical Layout"
                >
                  <Workflow className="size-3 sm:hidden rotate-90" />
                  <span className="hidden sm:inline">Vertical</span>
                  <span className="sm:hidden text-[10px]">Vert</span>
                </Button>
                <Button
                  variant={layout === "horizontal" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-7 px-2 sm:px-2.5 text-[10px] font-bold uppercase rounded-md cursor-pointer gap-1",
                    layout === "horizontal" && "bg-background shadow-xs text-primary"
                  )}
                  onClick={() => setLayout("horizontal")}
                  title="Horizontal Layout"
                >
                  <Workflow className="size-3 sm:hidden" />
                  <span className="hidden sm:inline">Horizontal</span>
                  <span className="sm:hidden text-[10px]">Horiz</span>
                </Button>
              </div>

              <div className="w-px h-4 bg-border/60 mx-0.5 shrink-0" />

              {/* Zoom Controls */}
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-md hover:bg-muted cursor-pointer shrink-0"
                  onClick={() => handleZoomButton(-0.1)}
                  title="Zoom Out"
                >
                  <ZoomOut className="size-3.5" />
                </Button>

                <div className="px-0.5 sm:px-1 min-w-[34px] sm:min-w-[42px] text-center shrink-0">
                  <span className="text-[10px] font-black text-foreground tabular-nums">
                    {Math.round(zoom * 100)}%
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-md hover:bg-muted cursor-pointer shrink-0"
                  onClick={() => handleZoomButton(0.1)}
                  title="Zoom In"
                >
                  <ZoomIn className="size-3.5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-md hover:bg-muted cursor-pointer shrink-0"
                  onClick={handleResetCanvas}
                  title="Center / Reset Canvas"
                >
                  <Maximize className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Directory List Mode (Accordion Tree) */
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 p-1">
          {hierarchyMode === "departments" ? (
            rootDepartments.length > 0 ? (
              rootDepartments.map((dept) => (
                <DeptAccordionItem
                  key={dept.id}
                  dept={dept}
                  allDepartments={departments}
                  onSelectMember={handleSelectMember}
                  onOpenRoster={handleOpenRoster}
                />
              ))
            ) : (
              <div className="text-center py-16 text-muted-foreground text-xs font-medium">
                No departments found matching your criteria.
              </div>
            )
          ) : rootUsers.length > 0 ? (
            <div className="space-y-2.5">
              {rootUsers.map((user) => (
                <ReportingAccordionItem
                  key={user.id}
                  user={user}
                  allUsers={users}
                  onSelectMember={handleSelectMember}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground text-xs font-medium">
              No staff members found matching your criteria.
            </div>
          )}
        </div>
      )}

      {/* Member Profile Dialog */}
      <MemberProfileDialog
        user={selectedProfileUser}
        allUsers={users}
        allDepartments={departments}
        open={isProfileOpen}
        onOpenChange={setIsProfileOpen}
        onFocusUserInReporting={departmentsOnly ? undefined : handleFocusUserInReporting}
      />

      {/* Department Roster Sliding Sheet */}
      <DepartmentRosterSheet
        department={selectedRosterDept}
        open={isRosterOpen}
        onOpenChange={setIsRosterOpen}
        onSelectMember={handleSelectMember}
      />
    </div>
  )
}
