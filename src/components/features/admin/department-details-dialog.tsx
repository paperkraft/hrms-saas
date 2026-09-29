"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Users,
  Search,
  Mail,
  Briefcase,
  Crown,
  Layers,
  X,
  FileText,
} from "lucide-react";
import { getInitials, cn } from "@/lib/utils";

type User = {
  id: string;
  name: string | null;
  email: string;
  avatarUrl?: string | null;
  designation?: string | null;
  workMode?: string | null;
  status?: string | null;
};

type Department = {
  id: string;
  name: string;
  description?: string | null;
  parentDepartmentId?: string | null;
  teamLeader?: User | null;
  members?: User[];
  parentDepartment?: { id: string; name: string; teamLeader?: User | null } | null;
  subDepartments?: Array<{
    id: string;
    name: string;
    description?: string | null;
    teamLeader?: User | null;
    members?: User[];
  }>;
  _count?: {
    members: number;
  };
};

type MemberGroup = {
  id: string;
  title: string;
  isSubDept: boolean;
  leader?: User | null;
  members: User[];
};

interface DepartmentDetailsDialogProps {
  department: Department | null;
  onClose: () => void;
}

export function DepartmentDetailsDialog({
  department,
  onClose,
}: DepartmentDetailsDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [workModeFilter, setWorkModeFilter] = useState<"ALL" | "OFFICE" | "REMOTE" | "HYBRID">("ALL");

  const groupedMembers = useMemo(() => {
    if (!department) return [];
    const searchStr = searchQuery.toLowerCase();

    const filterMembers = (members?: User[]) =>
      (members || []).filter((m) => {
        const matchesSearch =
          (m.name && m.name.toLowerCase().includes(searchStr)) ||
          (m.email && m.email.toLowerCase().includes(searchStr)) ||
          (m.designation && m.designation.toLowerCase().includes(searchStr));

        const matchesMode =
          workModeFilter === "ALL" ? true : m.workMode === workModeFilter;

        return matchesSearch && matchesMode;
      });

    const groups: MemberGroup[] = [
      {
        id: department.id,
        title: department.name,
        isSubDept: false,
        leader: department.teamLeader,
        members: filterMembers(department.members),
      },
      ...(department.subDepartments || []).map((sub) => ({
        id: sub.id,
        title: sub.name,
        isSubDept: true,
        leader: sub.teamLeader,
        members: filterMembers(sub.members),
      })),
    ];

    return groups.filter((group) => group.members.length > 0);
  }, [department, searchQuery, workModeFilter]);

  if (!department) return null;

  const directMemberCount = department.members?.length || 0;
  const subDeptTotalMembers = (department.subDepartments || []).reduce(
    (acc, sub) => acc + (sub.members?.length || 0),
    0
  );
  const totalHeadcount = directMemberCount + subDeptTotalMembers;

  const effectiveLeader =
    department.teamLeader || department.parentDepartment?.teamLeader;
  const isParentLeader =
    !department.teamLeader && !!department.parentDepartment?.teamLeader;

  return (
    <Dialog open={!!department} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl lg:max-w-3xl max-h-[90vh] rounded-md border border-border/80 shadow-2xl bg-card p-0 overflow-hidden flex flex-col">
        {/* ── Executive Header ── */}
        <DialogHeader className="px-4 sm:px-6 py-3.5 sm:py-5 border-b border-border/70 bg-card pr-12 sm:pr-14 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="size-9 sm:size-11 rounded-full shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs sm:text-sm flex items-center justify-center size-full">
                {getInitials(department.name || "")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm sm:text-base font-bold tracking-tight text-foreground truncate">
                {department.name}
              </DialogTitle>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
                {department.parentDepartment ? (
                  <span className="text-[9px] sm:text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 inline-flex items-center gap-1 truncate max-w-full">
                    <Layers className="size-2.5 text-purple-600 shrink-0" />
                    <span className="truncate">Sub-Unit of {department.parentDepartment.name}</span>
                  </span>
                ) : (
                  <span className="text-[9px] sm:text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground border border-border/60 shrink-0">
                    Top-Level Department
                  </span>
                )}
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 shrink-0">
                  {totalHeadcount} staff
                </span>
                {(department.subDepartments?.length || 0) > 0 && (
                  <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 shrink-0">
                    {department.subDepartments!.length} sub-units
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-3.5 sm:p-5 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
          {/* ── Summary Stats Strip ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div className="bg-muted/15 border border-border/70 rounded-md p-2.5 sm:p-3 shadow-2xs">
              <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground block">Hierarchy Status</span>
              <span className="text-xs font-bold text-foreground mt-0.5 block truncate">
                {department.parentDepartment ? `Child of ${department.parentDepartment.name}` : "Primary Parent Unit"}
              </span>
            </div>

            <div className="bg-muted/15 border border-border/70 rounded-md p-2.5 sm:p-3 shadow-2xs">
              <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground block">Designated Leader</span>
              <span className="text-xs font-bold text-emerald-600 mt-0.5 block truncate">
                {effectiveLeader?.name || "No Leader Assigned"}
              </span>
            </div>

            <div className="bg-muted/15 border border-border/70 rounded-md p-2.5 sm:p-3 shadow-2xs">
              <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground block">Headcount Breakdown</span>
              <span className="text-xs font-bold text-primary mt-0.5 block truncate">
                {directMemberCount} Direct · {subDeptTotalMembers} in Sub-Units
              </span>
            </div>
          </div>

          {/* ── Department Description / Scope ── */}
          {department.description && (
            <div className="bg-muted/15 border border-border/70 rounded-md p-3 sm:p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 pb-1.5 border-b border-border/60">
                <FileText className="size-3.5 sm:size-4 text-primary shrink-0" />
                <h4 className="text-xs font-bold text-foreground">
                  About this Department
                </h4>
              </div>
              <p className="text-xs text-muted-foreground font-normal leading-relaxed whitespace-pre-line pt-0.5">
                {department.description}
              </p>
            </div>
          )}

          {/* ── Team Leadership Card ── */}
          <div className="bg-muted/15 border border-border/70 rounded-md p-3 sm:p-4 space-y-2.5 sm:space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border/60">
              <Crown className="size-3.5 sm:size-4 text-amber-500 shrink-0" />
              <h4 className="text-xs font-bold text-foreground">
                {department.parentDepartmentId ? "Sub-Team Leadership" : "Department Leadership (TL)"}
              </h4>
            </div>

            {effectiveLeader ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-md bg-background border border-border/70 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="size-9 sm:size-10 rounded-full shrink-0 border border-border/60">
                    {effectiveLeader.avatarUrl && (
                      <AvatarImage
                        src={effectiveLeader.avatarUrl}
                        alt={effectiveLeader.name || ""}
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] sm:text-xs font-bold uppercase flex items-center justify-center size-full">
                      {getInitials(effectiveLeader.name || "TL")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground truncate">
                      {effectiveLeader.name || "Unnamed Leader"}
                    </p>
                    <div className="flex flex-col xs:flex-row xs:items-center gap-0.5 xs:gap-2 text-[10px] sm:text-[11px] text-muted-foreground font-medium mt-0.5 truncate">
                      <span className="flex items-center gap-1 truncate">
                        <Briefcase className="size-3 text-muted-foreground/70 shrink-0" />
                        <span className="truncate">{effectiveLeader.designation || "Department Leader"}</span>
                      </span>
                      <span className="hidden xs:inline">•</span>
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="size-3 text-muted-foreground/70 shrink-0" />
                        <span className="truncate">{effectiveLeader.email}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <span className={cn(
                  "text-[9px] sm:text-[10px] font-bold px-2 py-0.5 sm:py-1 rounded-md border shrink-0 w-fit self-start sm:self-auto",
                  isParentLeader
                    ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20"
                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                )}>
                  {isParentLeader ? "Parent Dept Leader" : department.parentDepartmentId ? "Sub-TL" : "Team Leader"}
                </span>
              </div>
            ) : (
              <div className="p-3.5 sm:p-4 rounded-md bg-background border border-border/70 text-center py-4 sm:py-5">
                <Crown className="size-4 sm:size-5 text-muted-foreground/40 mx-auto mb-1" />
                <p className="text-xs font-semibold text-muted-foreground">No leader currently designated</p>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground/70 mt-0.5">
                  You can assign a leader by clicking Edit in the Department registry
                </p>
              </div>
            )}
          </div>

          {/* ── Sub-Departments Grid (if any) ── */}
          {(department.subDepartments?.length || 0) > 0 && (
            <div className="bg-muted/15 border border-border/70 rounded-md p-3 sm:p-4 space-y-2.5 sm:space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-border/60">
                <Layers className="size-3.5 sm:size-4 text-purple-600 shrink-0" />
                <h4 className="text-xs font-bold text-foreground">
                  Nested Sub-Departments ({department.subDepartments!.length})
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                {department.subDepartments!.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-2.5 sm:p-3 rounded-md bg-background border border-border/70 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{sub.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {sub.teamLeader ? `TL: ${sub.teamLeader.name}` : "No Sub-TL"}
                      </p>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 shrink-0">
                      {sub.members?.length || 0} staff
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Searchable Staff Directory ── */}
          <div className="bg-muted/15 border border-border/70 rounded-md p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Users className="size-3.5 sm:size-4 text-primary shrink-0" />
                <h4 className="text-xs font-bold text-foreground">
                  Department Staff Directory
                </h4>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* Search Bar */}
                <div className="relative w-full sm:w-52">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                  <Input
                    placeholder="Search staff..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-8 bg-background border-border/80 text-xs rounded-md focus:ring-primary/20 w-full"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded-md transition-colors cursor-pointer"
                    >
                      <X className="size-3 text-muted-foreground/50" />
                    </button>
                  )}
                </div>

                {/* Work Mode Filter Pills */}
                <div className="flex items-center bg-muted/40 p-0.5 rounded-md border border-border/70 overflow-x-auto justify-between sm:justify-start gap-0.5">
                  {[
                    { value: "ALL", label: "All" },
                    { value: "OFFICE", label: "Office" },
                    { value: "REMOTE", label: "Remote" },
                    { value: "HYBRID", label: "Hybrid" },
                  ].map((wm) => (
                    <button
                      key={wm.value}
                      onClick={() => setWorkModeFilter(wm.value as any)}
                      className={cn(
                        "flex-1 sm:flex-initial px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all text-center cursor-pointer whitespace-nowrap",
                        workModeFilter === wm.value
                          ? "bg-card text-foreground font-bold shadow-xs border border-border/60"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      )}
                    >
                      {wm.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-0.5 custom-scrollbar">
              {groupedMembers.length > 0 ? (
                groupedMembers.map((group) => (
                  <div key={group.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
                      <span className="flex items-center gap-1.5 truncate">
                        {group.isSubDept ? <Layers className="size-3 text-purple-600 shrink-0" /> : <Building2 className="size-3 text-primary shrink-0" />}
                        <span className="truncate">{group.title}</span>
                      </span>
                      <span className="text-[10px] shrink-0">{group.members.length} {group.members.length === 1 ? "member" : "members"}</span>
                    </div>

                    <div className="border border-border/70 rounded-md divide-y divide-border/40 bg-background overflow-hidden">
                      {group.members.map((member) => {
                        const isInactive = member.status === "INACTIVE";
                        return (
                          <div
                            key={member.id}
                            className={cn(
                              "p-2.5 px-3 flex items-center justify-between hover:bg-muted/20 transition-colors gap-2.5",
                              isInactive && "bg-muted/20 opacity-75"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <Avatar className={cn("size-8 rounded-full shrink-0 border border-border/60", isInactive && "grayscale opacity-75")}>
                                {member.avatarUrl && (
                                  <AvatarImage
                                    src={member.avatarUrl}
                                    alt={member.name || ""}
                                    className="object-cover"
                                  />
                                )}
                                <AvatarFallback className={cn("text-[10px] font-bold uppercase flex items-center justify-center size-full", isInactive ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
                                  {getInitials(member.name || "EM")}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className={cn("text-xs font-bold truncate", isInactive ? "text-muted-foreground" : "text-foreground")}>
                                    {member.name || "Unnamed"}
                                  </span>
                                  {isInactive && (
                                    <span className="text-[8px] font-bold px-1.5 py-0.2 bg-muted text-muted-foreground border border-border/80 rounded shrink-0">
                                      Inactive
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground block truncate mt-0.5">
                                  {member.designation || "Staff Member"} • {member.email}
                                </span>
                              </div>
                            </div>

                            {member.workMode && (
                              <span className={cn(
                                "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border shrink-0",
                                isInactive
                                  ? "bg-muted/40 text-muted-foreground border-border/70"
                                  : member.workMode === "OFFICE"
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                    : member.workMode === "REMOTE"
                                      ? "bg-sky-500/10 text-sky-600 border-sky-500/20"
                                      : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              )}>
                                {member.workMode}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 border border-border/60 border-dashed rounded-md bg-background">
                  <Users className="size-5 text-muted-foreground/30 mx-auto mb-1" />
                  <p className="text-xs font-medium text-muted-foreground">
                    No matching staff members found
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
