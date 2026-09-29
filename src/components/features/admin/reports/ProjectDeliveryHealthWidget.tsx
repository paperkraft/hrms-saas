"use client";

import React, { useState, useMemo, useDeferredValue, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Search,
  SlidersHorizontal,
  FolderKanban,
  CheckCircle,
  PauseCircle,
  AlertCircle,
  Calendar,
  Layers,
  ArrowUpDown,
  Building2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface ProjectDeliveryStat {
  id: string;
  name: string;
  client?: string | null;
  status: "ACTIVE" | "COMPLETED" | "ON_HOLD" | string;
  timeLimit?: string | null;
  dateOfWorkOrder?: string | null;
  projectCoordinateName?: string | null;
  total: number;
  completed: number;
  inProgress?: number;
  inReview?: number;
  todo?: number;
  onHold?: number;
  overdue?: number;
  rate: number;
  health: "COMPLETED" | "ON_TRACK" | "AT_RISK" | "DELAYED" | "ON_HOLD" | "NO_TASKS";
}

interface ProjectDeliveryHealthWidgetProps {
  projects: ProjectDeliveryStat[];
  className?: string;
}

type FilterStatus = "ALL" | "ACTIVE" | "AT_RISK" | "ON_TRACK" | "COMPLETED" | "ON_HOLD";
type SortOption = "priority" | "rate_asc" | "rate_desc" | "tasks_desc" | "name_asc" | "deadline_asc";

function getPriorityScore(p: ProjectDeliveryStat) {
  if (p.health === "DELAYED") return 6;
  if (p.health === "AT_RISK") return 5;
  if (p.health === "ON_TRACK") return 4;
  if (p.status === "ACTIVE") return 3;
  if (p.status === "ON_HOLD") return 2;
  if (p.health === "COMPLETED" || p.status === "COMPLETED") return 1;
  return 0;
}

function getHealthBadge(health?: string, status?: string) {
  if (status === "COMPLETED" || health === "COMPLETED") {
    return {
      label: "Completed",
      icon: CheckCircle,
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      progressColor: "bg-emerald-500",
    };
  }
  if (status === "ON_HOLD") {
    return {
      label: "On Hold",
      icon: PauseCircle,
      className: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
      progressColor: "bg-slate-400",
    };
  }
  if (health === "DELAYED") {
    return {
      label: "Delayed",
      icon: AlertCircle,
      className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      progressColor: "bg-rose-500",
    };
  }
  if (health === "AT_RISK") {
    return {
      label: "At Risk",
      icon: AlertTriangle,
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      progressColor: "bg-amber-500",
    };
  }
  if (health === "NO_TASKS") {
    return {
      label: "No Tasks",
      icon: FolderKanban,
      className: "bg-muted text-muted-foreground border-border",
      progressColor: "bg-muted-foreground/40",
    };
  }
  return {
    label: "On Track",
    icon: CheckCircle2,
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    progressColor: "bg-blue-500",
  };
}

function formatDeadline(timeLimit?: string | null) {
  if (!timeLimit) return null;
  const d = new Date(timeLimit);
  const now = new Date();
  const diffTime = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      text: `${Math.abs(diffDays)}d overdue`,
      isOverdue: true,
      isSoon: false,
    };
  }
  if (diffDays === 0) {
    return {
      text: "Due today",
      isOverdue: false,
      isSoon: true,
    };
  }
  if (diffDays <= 7) {
    return {
      text: `Due in ${diffDays}d`,
      isOverdue: false,
      isSoon: true,
    };
  }
  return {
    text: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    isOverdue: false,
    isSoon: false,
  };
}

// Memoized Project Card Component to avoid unnecessary re-renders
const ProjectCard = React.memo(function ProjectCard({ proj }: { proj: ProjectDeliveryStat }) {
  const badge = getHealthBadge(proj.health, proj.status);
  const Icon = badge.icon;
  const deadline = formatDeadline(proj.timeLimit);

  return (
    <div className="group p-2.5 rounded-md border border-border/70 bg-card hover:bg-muted/30 transition-all duration-150 space-y-2 shadow-2xs hover:border-border">
      {/* Top Row: Title, Client, Link, Health Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {proj.id ? (
              <Link
                href={`/dashboard/projects/${proj.id}`}
                className="text-xs font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1 group-hover:underline truncate max-w-[180px]"
                title={proj.name}
              >
                <span className="truncate">{proj.name}</span>
                <ExternalLink className="size-2.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground" />
              </Link>
            ) : (
              <span className="text-xs font-bold text-foreground truncate max-w-[180px]" title={proj.name}>
                {proj.name}
              </span>
            )}

            {proj.client && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-medium bg-muted text-muted-foreground truncate max-w-[110px]">
                <Building2 className="size-2.5 shrink-0" />
                {proj.client}
              </span>
            )}
          </div>

          {/* Deadline & Sub-details */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
            {deadline && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  deadline.isOverdue
                    ? "text-rose-600 dark:text-rose-400 font-bold"
                    : deadline.isSoon
                      ? "text-amber-600 dark:text-amber-400 font-semibold"
                      : "text-muted-foreground"
                )}
              >
                <Calendar className="size-2.5 shrink-0" />
                {deadline.text}
              </span>
            )}
            {proj.overdue && proj.overdue > 0 ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-[9px]">
                <AlertCircle className="size-2.5" /> {proj.overdue} overdue
              </span>
            ) : null}
          </div>
        </div>

        {/* Status / Health Badge + Rate */}
        <div className="flex flex-col items-end shrink-0 gap-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border",
              badge.className
            )}
          >
            <Icon className="size-2.5 shrink-0" />
            {badge.label}
          </span>
          <span className="text-xs font-bold text-foreground tabular-nums">
            {proj.rate}%
          </span>
        </div>
      </div>

      {/* Progress Bar & Breakdown */}
      <div className="space-y-1 pt-0.5">
        <div className="w-full h-1.5 bg-muted/70 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-300", badge.progressColor)}
            style={{ width: `${Math.min(100, Math.max(0, proj.rate))}%` }}
          />
        </div>

        {/* Task Breakdown stats */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
          <span className="tabular-nums">
            {proj.completed} of {proj.total} tasks completed
          </span>
          <div className="flex items-center gap-1.5">
            {proj.inProgress !== undefined && proj.inProgress > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                {proj.inProgress} active
              </span>
            )}
            {proj.inReview !== undefined && proj.inReview > 0 && (
              <span className="text-orange-600 dark:text-orange-400 font-semibold">
                {proj.inReview} review
              </span>
            )}
            {proj.onHold !== undefined && proj.onHold > 0 && (
              <span className="text-muted-foreground">
                {proj.onHold} hold
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export function ProjectDeliveryHealthWidget({ projects = [], className }: ProjectDeliveryHealthWidgetProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("priority");
  const [showControls, setShowControls] = useState(false);
  const [renderLimit, setRenderLimit] = useState(25);

  // Reset render limit on filter/search change
  useEffect(() => {
    setRenderLimit(25);
  }, [deferredSearch, statusFilter, sortBy]);

  // Summary counts
  const summary = useMemo(() => {
    const totalCount = projects.length;
    let activeCount = 0;
    let completedCount = 0;
    let atRiskCount = 0;
    let onTrackCount = 0;
    let onHoldCount = 0;
    let totalTasks = 0;
    let totalCompletedTasks = 0;

    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      if (p.status === "ACTIVE") activeCount++;
      if (p.status === "COMPLETED" || p.health === "COMPLETED") completedCount++;
      if (p.health === "AT_RISK" || p.health === "DELAYED") atRiskCount++;
      if (p.health === "ON_TRACK") onTrackCount++;
      if (p.status === "ON_HOLD") onHoldCount++;
      totalTasks += p.total || 0;
      totalCompletedTasks += p.completed || 0;
    }

    const overallRate = totalTasks > 0 ? Math.round((totalCompletedTasks / totalTasks) * 100) : 0;

    return {
      totalCount,
      activeCount,
      completedCount,
      atRiskCount,
      onTrackCount,
      onHoldCount,
      overallRate,
    };
  }, [projects]);

  // Filtered & Sorted projects (using deferredSearch for zero input lag)
  const filteredProjects = useMemo(() => {
    let result = projects;

    // Search query
    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.client && p.client.toLowerCase().includes(q)) ||
          (p.projectCoordinateName && p.projectCoordinateName.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter === "ACTIVE") {
      result = result.filter((p) => p.status === "ACTIVE" && p.health !== "COMPLETED");
    } else if (statusFilter === "AT_RISK") {
      result = result.filter((p) => p.health === "AT_RISK" || p.health === "DELAYED");
    } else if (statusFilter === "ON_TRACK") {
      result = result.filter((p) => p.health === "ON_TRACK");
    } else if (statusFilter === "COMPLETED") {
      result = result.filter((p) => p.status === "COMPLETED" || p.health === "COMPLETED");
    } else if (statusFilter === "ON_HOLD") {
      result = result.filter((p) => p.status === "ON_HOLD");
    }

    // Sorting
    const sorted = [...result];
    sorted.sort((a, b) => {
      if (sortBy === "priority") {
        const scoreA = getPriorityScore(a);
        const scoreB = getPriorityScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.rate - b.rate;
      }
      if (sortBy === "rate_asc") {
        return a.rate - b.rate;
      }
      if (sortBy === "rate_desc") {
        return b.rate - a.rate;
      }
      if (sortBy === "tasks_desc") {
        return b.total - a.total;
      }
      if (sortBy === "name_asc") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "deadline_asc") {
        if (!a.timeLimit) return 1;
        if (!b.timeLimit) return -1;
        return new Date(a.timeLimit).getTime() - new Date(b.timeLimit).getTime();
      }
      return 0;
    });

    return sorted;
  }, [projects, deferredSearch, statusFilter, sortBy]);

  // Windowed progressive slice
  const visibleProjects = useMemo(() => {
    return filteredProjects.slice(0, renderLimit);
  }, [filteredProjects, renderLimit]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 120 && renderLimit < filteredProjects.length) {
      setRenderLimit((prev) => Math.min(prev + 25, filteredProjects.length));
    }
  };

  return (
    <div
      className={cn(
        "bg-card border border-border/80 rounded-md p-4 sm:p-5 space-y-3.5 shadow-2xs transition-all duration-200 flex flex-col justify-between h-full",
        className
      )}
    >
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" /> Project Delivery Health
            </h2>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
              {summary.activeCount} Active / {summary.totalCount} Total
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Real-time delivery progress & deadline compliance.
          </p>
        </div>

        {/* Quick Actions / Toggle Filters */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowControls(!showControls)}
            className={cn(
              "px-2 py-1 rounded-md text-[11px] font-medium border flex items-center gap-1 transition-colors cursor-pointer",
              showControls || searchQuery || statusFilter !== "ALL" || sortBy !== "priority"
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-muted/40 border-border/70 text-muted-foreground hover:text-foreground"
            )}
            title="Search & Sort options"
          >
            <SlidersHorizontal className="size-3" />
            <span>Filter</span>
            {(statusFilter !== "ALL" || searchQuery) && (
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Quick KPI Summary Bar */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => setStatusFilter("ALL")}
          className={cn(
            "p-2 rounded-md border text-left transition-all cursor-pointer",
            statusFilter === "ALL"
              ? "bg-primary/10 border-primary/30 text-primary shadow-2xs"
              : "bg-muted/30 border-border/50 hover:bg-muted/60 text-muted-foreground"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider">Overall Rate</span>
            <Layers className="size-3 opacity-60" />
          </div>
          <p className="text-xs font-bold text-foreground mt-0.5 tabular-nums">
            {summary.overallRate}% <span className="text-[10px] font-normal text-muted-foreground">done</span>
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "ON_TRACK" ? "ALL" : "ON_TRACK")}
          className={cn(
            "p-2 rounded-md border text-left transition-all cursor-pointer",
            statusFilter === "ON_TRACK"
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-2xs"
              : "bg-muted/30 border-border/50 hover:bg-muted/60 text-muted-foreground"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider">On Track</span>
            <CheckCircle2 className="size-3 text-emerald-500" />
          </div>
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
            {summary.onTrackCount} <span className="text-[10px] font-normal text-muted-foreground">projects</span>
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "AT_RISK" ? "ALL" : "AT_RISK")}
          className={cn(
            "p-2 rounded-md border text-left transition-all cursor-pointer",
            statusFilter === "AT_RISK"
              ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 shadow-2xs"
              : "bg-muted/30 border-border/50 hover:bg-muted/60 text-muted-foreground"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider">Attention</span>
            <AlertTriangle className="size-3 text-amber-500" />
          </div>
          <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
            {summary.atRiskCount} <span className="text-[10px] font-normal text-muted-foreground">at risk</span>
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "COMPLETED" ? "ALL" : "COMPLETED")}
          className={cn(
            "p-2 rounded-md border text-left transition-all cursor-pointer",
            statusFilter === "COMPLETED"
              ? "bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300 shadow-2xs"
              : "bg-muted/30 border-border/50 hover:bg-muted/60 text-muted-foreground"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider">Delivered</span>
            <CheckCircle className="size-3 text-blue-500" />
          </div>
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5 tabular-nums">
            {summary.completedCount} <span className="text-[10px] font-normal text-muted-foreground">finished</span>
          </p>
        </button>
      </div>

      {/* Collapsible Search and Sort Controls */}
      {(showControls || searchQuery || statusFilter !== "ALL") && (
        <div className="p-2.5 rounded-md bg-muted/40 border border-border/60 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Search Input */}
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search projects or clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pl-8 pr-7 text-xs bg-background w-full"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Sort Selector & Reset Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <ArrowUpDown className="size-3 text-muted-foreground shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort projects by"
                className="h-7 w-full px-2 text-[11px] rounded-md border border-input bg-background font-medium focus:outline-none focus:ring-1 focus:ring-primary truncate cursor-pointer"
              >
                <option value="priority">Sort: Priority / Risk</option>
                <option value="rate_asc">Sort: Lowest Progress</option>
                <option value="rate_desc">Sort: Highest Progress</option>
                <option value="tasks_desc">Sort: Most Tasks</option>
                <option value="name_asc">Sort: Name (A-Z)</option>
                <option value="deadline_asc">Sort: Due Date</option>
              </select>
            </div>

            {(searchQuery || statusFilter !== "ALL" || sortBy !== "priority") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                  setSortBy("priority");
                }}
                className="text-[10px] text-muted-foreground hover:text-primary underline font-medium shrink-0 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {/* Status Filter Badges */}
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {[
              { id: "ALL", label: "All" },
              { id: "ACTIVE", label: "Active" },
              { id: "AT_RISK", label: "At Risk" },
              { id: "ON_TRACK", label: "On Track" },
              { id: "COMPLETED", label: "Done" },
              { id: "ON_HOLD", label: "Hold" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as FilterStatus)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer",
                  statusFilter === tab.id
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-background border border-border/70 text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Project Cards List (Virtual / Progressive onScroll Loading) */}
      <div
        onScroll={handleScroll}
        className="space-y-2 overflow-y-auto pr-1 custom-scrollbar flex-1 max-h-[460px] min-h-[280px]"
      >
        {visibleProjects.map((proj) => (
          <ProjectCard key={proj.id || proj.name} proj={proj} />
        ))}

        {/* Empty State */}
        {filteredProjects.length === 0 && (
          <div className="py-10 flex flex-col items-center justify-center text-center space-y-2 border border-dashed border-border/70 rounded-md bg-muted/20">
            <FolderKanban className="size-7 text-muted-foreground opacity-50" />
            <p className="text-xs font-semibold text-foreground">No projects found</p>
            <p className="text-[11px] text-muted-foreground max-w-[200px]">
              {searchQuery || statusFilter !== "ALL"
                ? "Try adjusting your search query or status filter."
                : "No project records are available for the selected period."}
            </p>
            {(searchQuery || statusFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                }}
                className="mt-1 px-2.5 py-1 rounded text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer Summary & Link */}
      <div className="pt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40">
        <span>
          Showing <strong className="text-foreground font-semibold">{visibleProjects.length}</strong> of{" "}
          <strong className="text-foreground font-semibold">{filteredProjects.length}</strong> projects
        </span>
        <Link
          href="/dashboard/projects"
          className="inline-flex items-center gap-1 font-bold text-primary hover:text-primary/80 transition-colors"
        >
          <span>All Projects</span>
          <ExternalLink className="size-3" />
        </Link>
      </div>
    </div>
  );
}
