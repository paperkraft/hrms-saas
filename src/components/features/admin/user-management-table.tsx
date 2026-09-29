"use client"

import { useState } from "react";
import { Search, Users, UserCheck, UserX, UserMinus, Globe, Crown } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { Input, Avatar, AvatarImage, AvatarFallback, Badge } from "@/components/ui";
import { EditUserDialog } from "@/components/features/admin/edit-user-dialog";
import { ResignationDialog } from "@/components/features/admin/resignation-dialog";
import { DeleteUserDialog } from "@/components/features/admin/delete-user-dialog";
import { EmployeeDetailsDialog } from "@/components/features/admin/employee-details-dialog";
import { isExternalUser } from "@/lib/permissions";

interface UserManagementTableProps {
  initialUsers: any[];
  validManagers: any[];
  departments: any[];
  locations: any[];
  roles?: any[];
}

export function UserManagementTable({
  initialUsers,
  validManagers,
  departments,
  locations,
  roles = []
}: UserManagementTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Counts
  const activeCount = initialUsers.filter(u => !u.status || u.status === "ACTIVE").length;
  const resignedCount = initialUsers.filter(u => u.status === "RESIGNED").length;
  const inactiveCount = initialUsers.filter(u => u.status === "INACTIVE" || u.status === "TERMINATED").length;
  const allCount = initialUsers.length;

  const filteredUsers = initialUsers.filter((user) => {
    const userStatus = user.status || "ACTIVE";
    if (statusFilter !== "ALL") {
      if (statusFilter === "INACTIVE") {
        if (userStatus !== "INACTIVE" && userStatus !== "TERMINATED") return false;
      } else if (userStatus !== statusFilter) {
        return false;
      }
    }

    const searchStr = searchQuery.toLowerCase();
    const deptNames = (user.departments || []).map((d: any) => d.department?.name).join(" ").toLowerCase();
    const roleName = (user.roleDefinition?.name || user.role || "").toLowerCase();

    return (
      user.name?.toLowerCase().includes(searchStr) ||
      user.email?.toLowerCase().includes(searchStr) ||
      user.department?.name?.toLowerCase().includes(searchStr) ||
      deptNames.includes(searchStr) ||
      roleName.includes(searchStr) ||
      user.designation?.toLowerCase().includes(searchStr)
    );
  })
    .sort((a, b) => {
      const timeA = a.joiningDate ? new Date(a.joiningDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.joiningDate ? new Date(b.joiningDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });

  const handleViewProfile = (user: any) => {
    setSelectedUser(user);
    setIsDetailsOpen(true);
  };

  const getStatusBadge = (status?: string) => {
    const s = status || "ACTIVE";
    switch (s) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            Active
          </span>
        );
      case "RESIGNED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            Resigned
          </span>
        );
      case "TERMINATED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
            Terminated
          </span>
        );
      case "INACTIVE":
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-500/10 text-slate-600 border border-slate-500/20">
            Inactive
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
        {/* Status Filter Tabs (Scrollable on mobile) */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-md border border-border/70 overflow-x-auto scrollbar-hide no-scrollbar w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter("ACTIVE")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer shrink-0 whitespace-nowrap",
              statusFilter === "ACTIVE"
                ? "bg-card text-emerald-600 shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <UserCheck className="size-3.5" />
            <span>Active</span>
            <span className="text-[10px] ml-0.5 px-1.5 py-0.2 bg-muted rounded font-mono">
              {activeCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("RESIGNED")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer shrink-0 whitespace-nowrap",
              statusFilter === "RESIGNED"
                ? "bg-card text-amber-600 shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <UserX className="size-3.5" />
            <span>Resigned</span>
            <span className="text-[10px] ml-0.5 px-1.5 py-0.2 bg-muted rounded font-mono">
              {resignedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("INACTIVE")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer shrink-0 whitespace-nowrap",
              statusFilter === "INACTIVE"
                ? "bg-card text-slate-600 shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <UserMinus className="size-3.5" />
            <span>Inactive</span>
            <span className="text-[10px] ml-0.5 px-1.5 py-0.2 bg-muted rounded font-mono">
              {inactiveCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer shrink-0 whitespace-nowrap",
              statusFilter === "ALL"
                ? "bg-card text-primary shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="size-3.5" />
            <span>All</span>
            <span className="text-[10px] ml-0.5 px-1.5 py-0.2 bg-muted rounded font-mono">
              {allCount}
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72 sm:shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/40" />
          <Input
            placeholder="Search employees by name, role, dept..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 bg-background border-border/80 focus:ring-primary/20 rounded-md text-xs"
          />
        </div>
      </div>

      {/* People Table (Desktop View) */}
      <div className="hidden sm:block bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full border-collapse">
            <thead className="bg-muted/30 border-b border-border/70">
              <tr>
                <th className="py-3.5 px-5 text-left text-xs font-bold text-muted-foreground w-70 whitespace-nowrap">Name</th>
                <th className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">Role</th>
                <th className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">Status</th>
                <th className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">Joining Date</th>
                <th className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">Department(s)</th>
                <th className="py-3.5 px-5 text-right text-xs font-bold text-muted-foreground whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const userDepts = user.departments || []
                  const primaryDept = userDepts.find((d: any) => d.isPrimary)?.department || user.department
                  const ledDeptMap = new Map<string, any>()
                  if (Array.isArray(user.ledDepartments)) {
                    user.ledDepartments.forEach((d: any) => ledDeptMap.set(d.id, d))
                  }
                  if (Array.isArray(user.departments)) {
                    user.departments.filter((d: any) => d.isLeader && d.department).forEach((d: any) => {
                      ledDeptMap.set(d.department.id, d.department)
                    })
                  }
                  if (Array.isArray(departments)) {
                    departments.filter((d: any) => d.teamLeaderId === user.id).forEach((d: any) => {
                      if (!ledDeptMap.has(d.id)) ledDeptMap.set(d.id, d)
                    })
                  }
                  const ledDepts = Array.from(ledDeptMap.values())

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-muted/10 transition-colors group cursor-pointer"
                      onClick={() => handleViewProfile(user)}
                    >
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3 min-w-50">
                          <Avatar className="size-8 rounded-full shrink-0">
                            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} className="object-cover" />}
                            <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center size-full group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                              {getInitials(user.name || '')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col truncate">
                            <span className="font-bold text-xs text-foreground leading-snug group-hover:text-primary transition-colors truncate">
                              {user.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-medium leading-none truncate mt-0.5">
                              {user.designation || "No Designation"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="outline" className="text-[10px] font-semibold bg-muted/30 rounded-md">
                            {user.roleDefinition?.name || user.role}
                          </Badge>
                          {(() => {
                            if (!user.assignedRoleIds || !Array.isArray(user.assignedRoleIds) || user.assignedRoleIds.length <= 1) return null
                            const extraRoles = roles.filter(
                              (r: any) =>
                                r.id !== user.roleDefinitionId &&
                                user.assignedRoleIds.includes(r.id)
                            )
                            if (extraRoles.length === 0) return null
                            return (
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20"
                                title={`Additional Roles: ${extraRoles.map((r: any) => r.name).join(", ")}`}
                              >
                                +{extraRoles.length} role{extraRoles.length > 1 ? "s" : ""}
                              </span>
                            )
                          })()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(user.status)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-semibold text-foreground/80 whitespace-nowrap">
                          {user.joiningDate
                            ? new Date(user.joiningDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : new Date(user.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          }
                        </span>
                        {user.rejoiningDate && (
                          <div className="text-[10px] text-emerald-600 font-bold">
                            Rejoined: {new Date(user.rejoiningDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                        {user.status === "RESIGNED" && user.resignationDate && (
                          <div className="text-[10px] text-amber-600 font-medium">
                            Left: {new Date(user.resignationDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                          {isExternalUser(user) ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                              <Globe className="size-3 text-blue-500" />
                              External
                            </span>
                          ) : primaryDept ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground tracking-tight">
                              {primaryDept.name}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">Unassigned</span>
                          )}

                          {ledDepts.length > 0 && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/20"
                              title={`Leads: ${ledDepts.map((d: any) => d.name).join(", ")}`}
                            >
                              <Crown className="size-2.5 text-amber-500" />
                              TL ({ledDepts.length} {ledDepts.length === 1 ? "dept" : "depts"})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <EditUserDialog
                            user={user}
                            managers={validManagers}
                            departments={departments}
                            locations={locations}
                            roles={roles}
                          />
                          <ResignationDialog
                            user={user}
                            activeUsers={validManagers}
                          />
                          <DeleteUserDialog
                            user={user}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground font-medium">
                    No employees found matching your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* People Card View (Mobile View) */}
      <div className="block sm:hidden space-y-3">
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <div
              key={user.id}
              className="bg-card border border-border/80 rounded-md p-4 space-y-3.5 cursor-pointer hover:border-primary/40 shadow-2xs transition-all"
              onClick={() => handleViewProfile(user)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="size-10 rounded-full shrink-0">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} className="object-cover" />}
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center size-full">
                      {getInitials(user.name || '')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-foreground truncate">{user.name}</span>
                    <span className="text-[11px] text-muted-foreground font-medium truncate mt-0.5">{user.designation || "No Designation"}</span>
                  </div>
                </div>
                <div>
                  {getStatusBadge(user.status)}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-border/40">
                <Badge variant="outline" className="text-[10px] font-semibold bg-muted/30 rounded-md">
                  {user.roleDefinition?.name || user.role}
                </Badge>
                {(() => {
                  if (!user.assignedRoleIds || !Array.isArray(user.assignedRoleIds) || user.assignedRoleIds.length <= 1) return null
                  const extraRoles = roles.filter(
                    (r: any) =>
                      r.id !== user.roleDefinitionId &&
                      user.assignedRoleIds.includes(r.id)
                  )
                  if (extraRoles.length === 0) return null
                  return (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20"
                      title={`Additional Roles: ${extraRoles.map((r: any) => r.name).join(", ")}`}
                    >
                      +{extraRoles.length} role{extraRoles.length > 1 ? "s" : ""}
                    </span>
                  )
                })()}
                {isExternalUser(user) ? (
                  <span className="text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 rounded-md border border-blue-500/20">
                    External Collaborator
                  </span>
                ) : (
                  <>
                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-md">
                      {user.departments?.find((d: any) => d.isPrimary)?.department?.name || user.department?.name || "Unassigned"}
                    </span>
                    {(() => {
                      const mDeptMap = new Map<string, any>()
                      if (Array.isArray(user.ledDepartments)) {
                        user.ledDepartments.forEach((d: any) => mDeptMap.set(d.id, d))
                      }
                      if (Array.isArray(user.departments)) {
                        user.departments.filter((d: any) => d.isLeader && d.department).forEach((d: any) => {
                          mDeptMap.set(d.department.id, d.department)
                        })
                      }
                      if (Array.isArray(departments)) {
                        departments.filter((d: any) => d.teamLeaderId === user.id).forEach((d: any) => {
                          if (!mDeptMap.has(d.id)) mDeptMap.set(d.id, d)
                        })
                      }
                      const mUserLedDepts = Array.from(mDeptMap.values())
                      if (mUserLedDepts.length === 0) return null
                      return (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/20"
                          title={`Leads: ${mUserLedDepts.map((d: any) => d.name).join(", ")}`}
                        >
                          <Crown className="size-2.5 text-amber-500" />
                          TL ({mUserLedDepts.length})
                        </span>
                      )
                    })()}
                  </>
                )}
              </div>

              <div
                className="flex items-center justify-end gap-1.5 pt-2.5 border-t border-border/40"
                onClick={(e) => e.stopPropagation()}
              >
                <EditUserDialog
                  user={user}
                  managers={validManagers}
                  departments={departments}
                  locations={locations}
                  roles={roles}
                />
                <ResignationDialog
                  user={user}
                  activeUsers={validManagers}
                />
                <DeleteUserDialog
                  user={user}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="bg-card border border-border/80 rounded-md py-12 text-center text-xs text-muted-foreground font-medium shadow-2xs">
            No matching employees found in this category
          </div>
        )}
      </div>

      {selectedUser && (
        <EmployeeDetailsDialog
          user={selectedUser}
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
        />
      )}
    </div>
  );
}
