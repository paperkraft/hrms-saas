"use client"

import { useState } from "react"
import { Users, Users2, List } from "lucide-react"
import { UserManagementTable } from "@/components/features/admin/user-management-table"
import { AddUserDialog } from "@/components/features/admin/add-user-dialog"
import { NotifyIncompleteProfilesButton } from "@/components/features/admin/notify-incomplete-profiles-button"
import { OrgChart } from "@/components/features/admin/org-chart"
import { OrgData } from "@/actions/org-chart"
import { cn } from "@/lib/utils"

interface EmployeesPageClientProps {
  users: any[]
  validManagers: any[]
  departments: any[]
  locations: any[]
  roles: any[]
  orgData: OrgData
}

export function EmployeesPageClient({
  users,
  validManagers,
  departments,
  locations,
  roles,
  orgData
}: EmployeesPageClientProps) {
  const [viewMode, setViewMode] = useState<"list" | "chart">("list")

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* ── Page Header Banner (Desktop Only) ── */}
      <div className="hidden md:flex rounded-md bg-card border border-border/80 p-5 shadow-2xs flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            {viewMode === "chart" ? (
              <Users2 className="size-5" />
            ) : (
              <Users className="size-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-foreground tracking-tight leading-none">
                Employees
              </h1>
              {viewMode === "chart" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                  Organization Chart View
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              {viewMode === "chart"
                ? "Interactive visual organization chart, managerial hierarchy, and reporting lines"
                : "Manage and collaborate within your organization's workforce"}
            </p>
          </div>
        </div>

        {/* ── Header Actions ── */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* View Mode Toggle Pill */}
          <div className="flex items-center bg-muted/40 p-1 rounded-md border border-border/70 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer",
                viewMode === "list"
                  ? "bg-card text-foreground font-bold shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <List className="size-3.5 text-primary" />
              <span>Directory</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("chart")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer",
                viewMode === "chart"
                  ? "bg-card text-foreground font-bold shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <Users2 className="size-3.5 text-primary" />
              <span>Org Chart</span>
            </button>
          </div>

          <NotifyIncompleteProfilesButton />
          <AddUserDialog
            managers={validManagers}
            departments={departments}
            locations={locations}
            roles={roles}
          />
        </div>
      </div>

      {/* ── Mobile Action Toolbar ── */}
      <div className="flex md:hidden items-center justify-between gap-2 overflow-x-auto scrollbar-hide no-scrollbar py-0.5">
        {/* View Mode Toggle Pill */}
        <div className="flex items-center bg-muted/40 p-1 rounded-md border border-border/70 shadow-2xs shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
              viewMode === "list"
                ? "bg-card text-foreground font-bold shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="size-3.5 text-primary" />
            <span>Directory</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("chart")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
              viewMode === "chart"
                ? "bg-card text-foreground font-bold shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users2 className="size-3.5 text-primary" />
            <span>Org Chart</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <NotifyIncompleteProfilesButton />
          <AddUserDialog
            managers={validManagers}
            departments={departments}
            locations={locations}
            roles={roles}
          />
        </div>
      </div>

      {/* ── Main View Content ── */}
      {viewMode === "list" ? (
        <UserManagementTable
          initialUsers={users}
          validManagers={validManagers}
          departments={departments}
          locations={locations}
          roles={roles}
        />
      ) : (
        <div className="w-full relative flex flex-col border border-border/80 rounded-md bg-card shadow-2xs p-2.5 h-[calc(100vh-210px)] min-h-[640px] animate-fade-in overflow-hidden">
          <OrgChart initialData={orgData} mode="reporting" />
        </div>
      )}
    </div>
  )
}
