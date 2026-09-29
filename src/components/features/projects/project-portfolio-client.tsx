"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  PageContainer,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Button,
  StatCard,
  Input,
} from "@/components/ui";
import { CreateProjectDialog } from "@/components/features/projects/create-project-dialog";
import { format, differenceInCalendarDays } from "date-fns";
import {
  FolderKanban,
  Activity,
  LayoutDashboard,
  LayoutGrid,
  List,
  Search,
  Target,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import Link from "next/link";
import { ProjectRowActions } from "@/components/features/projects/project-row-actions";
import { cn, stripHtml } from "@/lib/utils";
import { usePagination } from "@/hooks/use-pagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

interface ProjectPortfolioClientProps {
  initialProjects: any[];
  canManageProjects: boolean;
  isAdmin?: boolean;
  isExternal?: boolean;
}

export function ProjectPortfolioClient({
  initialProjects,
  canManageProjects,
  isAdmin = false,
  isExternal = false,
}: ProjectPortfolioClientProps) {
  const router = useRouter();
  const [view, setView] = useState<"grid" | "table">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    } else if (sortConfig && sortConfig.key === key && sortConfig.direction === "desc") {
      setSortConfig(null);
      return;
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        setView("grid");
      } else {
        setView("table");
      }
    }
  }, []);

  // Calculate statistics
  const totalTasks = useMemo(
    () => initialProjects?.reduce((acc: number, p: any) => acc + (p._count?.tasks || 0), 0) || 0,
    [initialProjects]
  );
  const activeCount = useMemo(
    () => initialProjects?.filter((p) => p.status === "ACTIVE").length || 0,
    [initialProjects]
  );
  const completedCount = useMemo(
    () => initialProjects?.filter((p) => p.status === "COMPLETED" || p.overallProgress === 100).length || 0,
    [initialProjects]
  );
  const overdueCount = useMemo(
    () =>
      initialProjects?.filter(
        (p) =>
          p.timeLimit &&
          p.status !== "COMPLETED" &&
          (p.overallProgress || 0) < 100 &&
          differenceInCalendarDays(new Date(), new Date(p.timeLimit)) > 0
      ).length || 0,
    [initialProjects]
  );
  const avgProgress = useMemo(
    () =>
      initialProjects?.length
        ? Math.round(
          initialProjects.reduce((acc: number, p: any) => acc + (p.overallProgress || 0), 0) /
          initialProjects.length
        )
        : 0,
    [initialProjects]
  );

  // Filtered & Sorted Projects
  const filteredProjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (initialProjects || [])
      .filter((p) => {
        const matchesSearch =
          !q ||
          p.name?.toLowerCase().includes(q) ||
          p.client?.toLowerCase().includes(q) ||
          p.projectCoordinateName?.toLowerCase().includes(q) ||
          p.documentManagerName?.toLowerCase().includes(q);

        if (!matchesSearch) return false;

        if (statusFilter === "ACTIVE") return p.status === "ACTIVE";
        if (statusFilter === "COMPLETED") return p.status === "COMPLETED" || p.overallProgress === 100;
        if (statusFilter === "OVERDUE") {
          return (
            p.timeLimit &&
            p.status !== "COMPLETED" &&
            (p.overallProgress || 0) < 100 &&
            differenceInCalendarDays(new Date(), new Date(p.timeLimit)) > 0
          );
        }

        return true;
      })
      .sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        const aVal = String(a[key] || "").toLowerCase();
        const bVal = String(b[key] || "").toLowerCase();
        if (aVal < bVal) return direction === "asc" ? -1 : 1;
        if (aVal > bVal) return direction === "asc" ? 1 : -1;
        return 0;
      });
  }, [initialProjects, searchQuery, statusFilter, sortConfig]);

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems: paginatedProjects,
    totalItems,
    itemsPerPage,
  } = usePagination(filteredProjects || [], 8, "page");

  const getStatusBadge = (status: string, progress: number) => {
    if (status === "COMPLETED" || progress >= 100) {
      return (
        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
          Completed
        </span>
      );
    }
    if (status === "ACTIVE") {
      return (
        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          Active
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
        {status || "Planned"}
      </span>
    );
  };

  return (
    <PageContainer maxWidth="full" className="py-6 animate-fade-in space-y-4">
      {/* ── 1. HEADER SECTION ─────────────────────────────────────────── */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="size-8 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <FolderKanban className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none mb-0.5 sm:mb-1">
              Projects & Workspace Overview
            </h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1 sm:line-clamp-none">
              Orchestrate client deliverables, milestones, task workloads, and real-time execution health
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Toggle */}
          <div className="flex items-center bg-muted/40 p-1 rounded-md border border-border/70">
            <button
              onClick={() => setView("table")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                view === "table" ? "bg-card text-foreground font-bold shadow-xs border border-border/60" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <List className="size-3.5" />
              <span>List</span>
            </button>
            <button
              onClick={() => setView("grid")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                view === "grid" ? "bg-card text-foreground font-bold shadow-xs border border-border/60" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <LayoutGrid className="size-3.5" />
              <span>Grid</span>
            </button>
          </div>

          {canManageProjects && <CreateProjectDialog />}
        </div>
      </div>

      {/* ── 2. METRICS & STATS CLUSTER ────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Projects"
          value={initialProjects?.length ?? 0}
          subValue="Registered Portfolio"
          icon={<FolderKanban className="size-4 text-primary" />}
          progress={initialProjects?.length > 0 ? 100 : 0}
          progressColor="bg-primary"
        />
        <StatCard
          label="Active Deliverables"
          value={activeCount}
          subValue="Currently in progress"
          icon={<Activity className="size-4 text-emerald-500" />}
          progress={initialProjects?.length ? (activeCount / initialProjects.length) * 100 : 0}
          progressColor="bg-emerald-500"
        />
        <StatCard
          label="Task Ecosystem"
          value={totalTasks}
          subValue="Assigned project tasks"
          icon={<LayoutDashboard className="size-4 text-blue-500" />}
          progress={totalTasks > 0 ? 100 : 0}
          progressColor="bg-blue-500"
        />
        <StatCard
          label="Portfolio Health"
          value={avgProgress}
          valueSuffix="%"
          subValue="Average completion rate"
          icon={<Target className="size-4 text-amber-500" />}
          progress={avgProgress}
          progressColor="bg-amber-500"
        />
      </div>

      {/* ── 3. TOOLBAR, FILTERS & SEARCH ──────────────────────────────── */}
      <div className="bg-card border border-border/80 rounded-md p-4 lg:p-5 shadow-2xs space-y-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 cursor-pointer border",
                statusFilter === "ALL"
                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-border/60"
              )}
            >
              All Projects ({initialProjects?.length || 0})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("ACTIVE")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 cursor-pointer border flex items-center gap-1.5",
                statusFilter === "ACTIVE"
                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-border/60"
              )}
            >
              <span>Active</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold transition-colors",
                  statusFilter === "ACTIVE"
                    ? "bg-white/20 text-white"
                    : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                )}
              >
                {activeCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("COMPLETED")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 cursor-pointer border flex items-center gap-1.5",
                statusFilter === "COMPLETED"
                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-border/60"
              )}
            >
              <span>Completed</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold transition-colors",
                  statusFilter === "COMPLETED"
                    ? "bg-white/20 text-white"
                    : "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                )}
              >
                {completedCount}
              </span>
            </button>

            {overdueCount > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter("OVERDUE")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 cursor-pointer border flex items-center gap-1.5",
                  statusFilter === "OVERDUE"
                    ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border-rose-500/30"
                )}
              >
                <span>Overdue</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold transition-colors",
                    statusFilter === "OVERDUE"
                      ? "bg-white/20 text-white"
                      : "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                  )}
                >
                  {overdueCount}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
          <Input
            placeholder="Search projects by project name, client, coordinator, or document manager..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9.5 pl-9.5 pr-4 text-xs bg-background border-border/80 rounded-md focus:ring-primary/20"
          />
        </div>
      </div>

      {/* ── 4. PROJECTS VIEW (GRID OR TABLE) ─────────────────────────── */}
      {view === "grid" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedProjects?.map((project: any) => {
              const isOverdue =
                project.timeLimit &&
                project.status !== "COMPLETED" &&
                (project.overallProgress || 0) < 100 &&
                differenceInCalendarDays(new Date(), new Date(project.timeLimit)) > 0;
              const overdueDays = isOverdue
                ? differenceInCalendarDays(new Date(), new Date(project.timeLimit))
                : 0;

              return (
                <div
                  key={project.id}
                  className="group relative p-5 rounded-md border border-border/80 bg-card hover:border-primary/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                >
                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    className="absolute inset-0 z-0 rounded-md"
                  />

                  {/* Top Header */}
                  <div className="space-y-3 relative z-10 pointer-events-none">
                    <div className="flex items-center justify-between gap-2">
                      {getStatusBadge(project.status, project.overallProgress || 0)}

                      {canManageProjects && (
                        <div className="pointer-events-auto">
                          <ProjectRowActions project={project} isAdmin={isAdmin} />
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                        {project.name || "Self-Managed Project"}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 line-clamp-2 min-h-[32px]">
                        {project.description
                          ? stripHtml(project.description)
                          : "No specific scope details recorded."}
                      </p>
                    </div>

                    {/* Client Name Separate Section Below Description */}
                    <div className="flex items-start gap-1.5 text-xs py-1 px-2.5 rounded-md bg-muted/40 border border-border/60">
                      <span className="font-semibold text-muted-foreground text-[11px] shrink-0">Client:</span>
                      <span className="font-bold text-foreground text-xs break-words leading-snug">
                        {project.client || "Self-Managed"}
                      </span>
                    </div>

                    {/* Coordinator meta tag */}
                    {project.projectCoordinateName && (
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                        <span className="font-semibold">Coordinator:</span>
                        <span className="font-medium text-foreground truncate max-w-[150px]">
                          {project.projectCoordinateName}
                        </span>
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div className="space-y-1.5 pt-2.5 border-t border-border/60">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-muted-foreground">Completion</span>
                        <span className="font-bold text-primary font-mono">
                          {project.overallProgress || 0}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-muted/80 rounded-full overflow-hidden border border-border/40">
                        <div
                          className="h-full bg-primary transition-all duration-700 ease-out"
                          style={{ width: `${project.overallProgress || 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="space-y-1 text-[11px] pt-1 text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Deadline:</span>
                        <span
                          className={cn(
                            "font-bold font-mono",
                            isOverdue ? "text-rose-600" : "text-foreground"
                          )}
                        >
                          {project.timeLimit
                            ? format(new Date(project.timeLimit), "MMM d, yyyy")
                            : "---"}
                        </span>
                      </div>

                      {isOverdue && (
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.2 rounded">
                            Overdue by {overdueDays}d
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-3 mt-3 border-t border-border/60 flex items-center justify-between text-xs relative z-10 pointer-events-none">
                    <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                      <LayoutDashboard className="size-3.5" />
                      <span>{project._count?.tasks || 0} Tasks</span>
                    </span>

                    <span className="text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      <span>Open</span>
                      <span>&rarr;</span>
                    </span>
                  </div>
                </div>
              );
            })}

            {(!filteredProjects || filteredProjects.length === 0) && (
              <div className="col-span-full py-20 text-center flex flex-col items-center justify-center px-6 space-y-3 border border-dashed border-border rounded-md bg-card/60">
                <div className="p-3.5 rounded-md bg-muted/60 text-muted-foreground border border-border/60">
                  <FolderKanban className="size-8 opacity-40" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="text-sm font-bold text-foreground">
                    {isExternal ? "No Shared Projects" : "No projects found"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {searchQuery
                      ? `No projects matched your search query "${searchQuery}".`
                      : isExternal
                      ? "No projects have been shared with you yet. Please contact your administrator to grant access to your project workspace."
                      : "Start by creating a new project in your workspace."}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            showOnlyNavigationOnMobile={true}
          />
        </div>
      ) : (
        /* ── TABLE VIEW ────────────────────────────────────────────────── */
        <div className="space-y-4">
          <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/70">
                    <TableHead
                      className="text-xs font-bold text-muted-foreground py-3.5 pl-6 cursor-pointer select-none"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Project Details</span>
                        {sortConfig?.key === "name" ? (
                          sortConfig.direction === "asc" ? (
                            <ArrowUp className="size-3 text-primary" />
                          ) : (
                            <ArrowDown className="size-3 text-primary" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 text-muted-foreground/40" />
                        )}
                      </div>
                    </TableHead>

                    <TableHead
                      className="text-xs font-bold text-muted-foreground py-3.5 cursor-pointer select-none"
                      onClick={() => handleSort("client")}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Client</span>
                        {sortConfig?.key === "client" ? (
                          sortConfig.direction === "asc" ? (
                            <ArrowUp className="size-3 text-primary" />
                          ) : (
                            <ArrowDown className="size-3 text-primary" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 text-muted-foreground/40" />
                        )}
                      </div>
                    </TableHead>

                    <TableHead className="text-xs font-bold text-muted-foreground py-3.5">
                      Coordinator
                    </TableHead>

                    <TableHead className="text-xs font-bold text-muted-foreground py-3.5">
                      Timeline & Deadline
                    </TableHead>

                    <TableHead className="text-xs font-bold text-muted-foreground py-3.5 text-center">
                      Progress
                    </TableHead>

                    <TableHead className="text-xs font-bold text-muted-foreground py-3.5 text-center">
                      Status
                    </TableHead>

                    <TableHead className="text-xs font-bold text-muted-foreground py-3.5 text-right pr-6">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProjects?.map((project: any) => {
                    const isOverdue =
                      project.timeLimit &&
                      project.status !== "COMPLETED" &&
                      (project.overallProgress || 0) < 100 &&
                      differenceInCalendarDays(new Date(), new Date(project.timeLimit)) > 0;
                    const overdueDays = isOverdue
                      ? differenceInCalendarDays(new Date(), new Date(project.timeLimit))
                      : 0;

                    return (
                      <TableRow
                        key={project.id}
                        className="hover:bg-muted/20 border-b border-border/60 transition-colors cursor-pointer"
                        onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                      >
                        {/* Project Name */}
                        <TableCell className="py-3.5 pl-6 font-medium">
                          <div className="flex flex-col max-w-sm">
                            <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                              {project.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate">
                              {project.description
                                ? stripHtml(project.description)
                                : "No description recorded"}
                            </span>
                          </div>
                        </TableCell>

                        {/* Client */}
                        <TableCell className="py-3.5 text-xs font-medium text-foreground">
                          {project.client || "Self-Managed"}
                        </TableCell>

                        {/* Coordinator */}
                        <TableCell className="py-3.5 text-xs text-muted-foreground">
                          {project.projectCoordinateName || "---"}
                        </TableCell>

                        {/* Timeline */}
                        <TableCell className="py-3.5 text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-semibold text-foreground font-mono">
                              Due:{" "}
                              {project.timeLimit
                                ? format(new Date(project.timeLimit), "MMM d, yyyy")
                                : "---"}
                            </span>
                            {isOverdue && (
                              <span className="text-[9px] font-bold text-rose-600 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.2 rounded w-fit">
                                +{overdueDays}d overdue
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Progress */}
                        <TableCell className="py-3.5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-2 w-24">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden border border-border/40">
                                <div
                                  className="h-full bg-primary transition-all duration-700"
                                  style={{ width: `${project.overallProgress || 0}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-bold font-mono">
                                {project.overallProgress || 0}%
                              </span>
                            </div>
                            <span className="text-[9px] text-muted-foreground">
                              {project._count?.tasks || 0} tasks
                            </span>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-3.5 text-center">
                          {getStatusBadge(project.status, project.overallProgress || 0)}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-3.5 pr-6 text-right">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {canManageProjects && <ProjectRowActions project={project} isAdmin={isAdmin} />}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {(!filteredProjects || filteredProjects.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-48 text-center">
                        <div className="flex flex-col items-center justify-center space-y-2.5">
                          <div className="size-10 bg-muted/50 rounded-xl flex items-center justify-center border border-border/60">
                            <FolderKanban className="size-5 text-muted-foreground/40" />
                          </div>
                          <p className="text-xs font-bold text-foreground">
                            {isExternal ? "No Shared Projects" : "No projects found"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {searchQuery
                              ? `No projects matched your search query "${searchQuery}".`
                              : isExternal
                              ? "No projects have been shared with you yet. Please contact your administrator to grant access."
                              : "Try adjusting your search criteria or create a project."}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            showOnlyNavigationOnMobile={true}
          />
        </div>
      )}
    </PageContainer>
  );
}
