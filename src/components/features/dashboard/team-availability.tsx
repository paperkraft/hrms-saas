"use client"

import { useState } from "react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Users, Building2, Crown, UserCheck } from "lucide-react"
import { cn } from "@/lib/utils"

export interface TeammateAvailability {
  id: string
  name: string
  avatarUrl: string | null
  designation: string
  status: "active" | "outside" | "leave" | "offline"
  isSelf?: boolean
  isLeader?: boolean
  departmentName?: string
}

export interface DepartmentPresenceGroup {
  departmentId: string
  departmentName: string
  roleBadge: string
  isDirect: boolean
  isLed: boolean
  members: TeammateAvailability[]
}

interface TeamAvailabilityProps {
  groups?: DepartmentPresenceGroup[]
  members?: TeammateAvailability[]
}

const statusConfig = {
  active: {
    label: "Active",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    pingClass: "bg-emerald-400"
  },
  outside: {
    label: "Remote / Out",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    pingClass: "bg-amber-400"
  },
  leave: {
    label: "On Leave",
    dotClass: "bg-indigo-500",
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    pingClass: "bg-indigo-400"
  },
  offline: {
    label: "Offline",
    dotClass: "bg-muted-foreground/30",
    badgeClass: "bg-muted/40 text-muted-foreground/80 border-border/40",
    pingClass: "hidden"
  }
}

export function TeamAvailability({ groups, members }: TeamAvailabilityProps) {
  // If groups are provided and have multiple items, support quick department tabs or view-all
  const hasGroups = Array.isArray(groups) && groups.length > 0
  const [selectedDeptId, setSelectedDeptId] = useState<string>("ALL")

  const displayGroups = hasGroups
    ? selectedDeptId === "ALL"
      ? groups
      : groups.filter(g => g.departmentId === selectedDeptId)
    : []

  const totalMembersCount = hasGroups
    ? groups.reduce((acc, g) => acc + g.members.length, 0)
    : (members?.length || 0)

  return (
    <div className="bg-card border border-border/80 rounded-md overflow-hidden flex flex-col h-[430px] shadow-2xs animate-fade-in w-full">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border/70 flex items-center justify-between bg-muted/20 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Users className="size-3.5 text-primary shrink-0" /> Team Presence
            </h2>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
              {totalMembersCount} Members
            </span>
            {hasGroups && groups.length > 1 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {groups.length} Depts
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Live team availability, active work modes, and punch status.
          </p>
        </div>
      </div>

      {/* Multiple Department Selector Tabs */}
      {hasGroups && groups.length > 1 && (
        <div className="px-4 py-2 border-b border-border/50 bg-muted/10 flex items-center gap-1.5 overflow-x-auto scrollbar-hide shrink-0">
          <button
            type="button"
            onClick={() => setSelectedDeptId("ALL")}
            className={cn(
              "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all whitespace-nowrap cursor-pointer",
              selectedDeptId === "ALL"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-background text-muted-foreground hover:text-foreground border border-border/70"
            )}
          >
            All Departments ({totalMembersCount})
          </button>
          {groups.map((g) => (
            <button
              key={`tab-${g.departmentId}`}
              type="button"
              onClick={() => setSelectedDeptId(g.departmentId)}
              className={cn(
                "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer",
                selectedDeptId === g.departmentId
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-background text-muted-foreground hover:text-foreground border border-border/70"
              )}
            >
              <span>{g.departmentName}</span>
              <span className="text-[9px] opacity-75 font-mono">({g.members.length})</span>
            </button>
          ))}
        </div>
      )}

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide divide-y divide-border/40">
        {hasGroups ? (
          displayGroups.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Users className="size-8 opacity-40" />
              <p className="text-xs font-semibold">No team members found</p>
            </div>
          ) : (
            displayGroups.map((group) => (
              <div key={`group-section-${group.departmentId}`} className="divide-y divide-border/20">
                {/* Department Section Header */}
                <div className="px-4 py-2 bg-muted/30 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm border-y border-border/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="size-3.5 text-primary shrink-0" />
                    <span className="text-xs font-bold text-foreground truncate">
                      {group.departmentName}
                    </span>
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide border",
                      group.isLed
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        : group.roleBadge === "Primary"
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-muted text-muted-foreground border-border/60"
                    )}>
                      {group.roleBadge}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground shrink-0 font-mono">
                    {group.members.length} {group.members.length === 1 ? "member" : "members"}
                  </span>
                </div>

                {/* Group Members List */}
                {group.members.map((member, idx) => {
                  const cfg = statusConfig[member.status] || statusConfig.offline
                  const initials = member.name
                    ? member.name
                        .replace(/\(You\)/g, "")
                        .trim()
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : "U"

                  return (
                    <div
                      key={`presence-${group.departmentId}-${member.id}-${idx}`}
                      className={cn(
                        "px-5 py-3 flex items-center justify-between group hover:bg-muted/30 transition-colors",
                        member.isSelf && "bg-primary/[0.03]"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                        <div className="relative shrink-0">
                          <Avatar className="size-8 rounded-full shrink-0">
                            {member.avatarUrl && (
                              <AvatarImage src={member.avatarUrl} alt={member.name} className="object-cover rounded-full" />
                            )}
                            <AvatarFallback className={cn(
                              "text-[10px] font-bold uppercase flex items-center justify-center size-full rounded-full",
                              member.isSelf ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground"
                            )}>
                              {initials}
                            </AvatarFallback>
                          </Avatar>

                          <span className={cn("absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card flex items-center justify-center", cfg.dotClass)}>
                            {member.status !== "offline" && (
                              <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping", cfg.pingClass)} />
                            )}
                          </span>
                        </div>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-foreground leading-none truncate group-hover:text-primary transition-colors">
                              {member.name}
                            </span>
                            {member.isSelf && (
                              <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md">
                                You
                              </span>
                            )}
                            {member.isLeader && (
                              <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-md flex items-center gap-0.5">
                                <Crown className="size-2.5" /> TL
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-medium truncate mt-0.5">
                            {member.designation}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 text-right ml-2 flex flex-col items-end">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border leading-none tracking-wider", cfg.badgeClass)}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )
        ) : !members || members.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Users className="size-8 opacity-40" />
            <p className="text-xs font-semibold">No coworkers found</p>
          </div>
        ) : (
          members.map((member, idx) => {
            const cfg = statusConfig[member.status] || statusConfig.offline
            const initials = member.name
              ? member.name
                  .replace(/\(You\)/g, "")
                  .trim()
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              : "U"

            return (
              <div
                key={`presence-flat-${member.id}-${idx}`}
                className={cn(
                  "px-5 py-3.5 flex items-center justify-between group hover:bg-muted/30 transition-colors",
                  member.isSelf && "bg-primary/[0.03]"
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                  <div className="relative shrink-0">
                    <Avatar className="size-8 rounded-full shrink-0">
                      {member.avatarUrl && (
                        <AvatarImage src={member.avatarUrl} alt={member.name} className="object-cover rounded-full" />
                      )}
                      <AvatarFallback className={cn(
                        "text-[10px] font-bold uppercase flex items-center justify-center size-full rounded-full",
                        member.isSelf ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground"
                      )}>
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <span className={cn("absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card flex items-center justify-center", cfg.dotClass)}>
                      {member.status !== "offline" && (
                        <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping", cfg.pingClass)} />
                      )}
                    </span>
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground leading-none truncate group-hover:text-primary transition-colors">
                        {member.name}
                      </span>
                      {member.isSelf && (
                        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md">
                          You
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium truncate mt-0.5">
                      {member.designation}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 text-right ml-4 flex flex-col items-end">
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border leading-none tracking-wider", cfg.badgeClass)}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
