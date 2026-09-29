"use client"

import { useState } from "react"
import { Building2, GitFork, List } from "lucide-react"
import { DepartmentList } from "@/components/features/admin/department-list"
import { AddDepartmentDialog } from "@/components/features/admin/add-department-dialog"
import { OrgChart } from "@/components/features/admin/org-chart"
import { OrgData } from "@/actions/org-chart"
import { cn } from "@/lib/utils"

interface DepartmentsPageClientProps {
  departments: any[]
  users: { id: string; name: string | null; email: string; role?: string }[]
  canEdit: boolean
  orgData: OrgData
}

export function DepartmentsPageClient({
  departments,
  users,
  canEdit,
  orgData
}: DepartmentsPageClientProps) {
  const [viewMode, setViewMode] = useState<"list" | "chart">("list")

  return (
    <div className="space-y-4">
      {/* ── Page Header Banner ── */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="size-8 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            {viewMode === "chart" ? (
              <GitFork className="size-4 sm:size-5" />
            ) : (
              <Building2 className="size-4 sm:size-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none">
                Departments & Teams
              </h1>
              {viewMode === "chart" && (
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                  Visual Chart View
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5 sm:mt-1 line-clamp-1 sm:line-clamp-none">
              {viewMode === "chart"
                ? "Interactive visual department hierarchy chart, nested sub-units, team leader spotlights, and member rosters"
                : "Manage organizational functional units, department hierarchy, and team leadership assignments"}
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
              <span>Registry</span>
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
              <GitFork className="size-3.5 text-primary" />
              <span>Department Chart</span>
            </button>
          </div>

          {/* Add Department Dialog */}
          {canEdit && <AddDepartmentDialog departments={departments} />}
        </div>
      </div>

      {/* ── Main View Content ── */}
      {viewMode === "list" ? (
        <DepartmentList departments={departments} users={users} canEdit={canEdit} />
      ) : (
        <div className="w-full relative flex flex-col border border-border/80 rounded-md bg-card shadow-2xs p-2.5 h-[calc(100vh-210px)] min-h-[640px] animate-fade-in overflow-hidden">
          <OrgChart initialData={orgData} departmentsOnly={true} />
        </div>
      )}
    </div>
  )
}
