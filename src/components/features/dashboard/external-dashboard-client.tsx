"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  CheckSquare,
  Library as LibraryIcon,
  Share2,
  BookOpen,
  CalendarDays,
  Clock,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Sun,
  Moon,
  CloudSun
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExternalDashboardData } from "@/actions/dashboard/external";
import { TodoList } from "./todo-list";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ExternalDashboardClientProps {
  initialData: ExternalDashboardData;
}

export function ExternalDashboardClient({ initialData }: ExternalDashboardClientProps) {
  const [data] = useState<ExternalDashboardData>(initialData);
  const { user, permissions, tasks, projectsCount, documents, fileShareCount, todos } = data;

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-4">
      {/* ── Executive Header Banner ── */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="size-8 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            {greeting === "Good morning" ? <CloudSun className="size-4 sm:size-5" /> : greeting === "Good afternoon" ? <Sun className="size-4 sm:size-5" /> : <Moon className="size-4 sm:size-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none">
                {greeting}, {user.name.split(' ')[0]}
              </h1>
              <Badge variant="outline" className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0 bg-primary/5 text-primary border-primary/20 rounded">
                Collaborator
              </Badge>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1 sm:line-clamp-none">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · My Space
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {permissions.canAccessProjects && (
            <Button asChild size="sm" className="h-8 text-xs font-semibold rounded-md shadow-2xs">
              <Link href="/dashboard/projects/reports">
                <CheckSquare className="size-3.5 mr-1.5" />
                <span>Deliverables & Tasks</span>
              </Link>
            </Button>
          )}
          {permissions.canAccessDocuments && (
            <Button asChild variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-md bg-background border-border/80 hover:bg-muted/40">
              <Link href="/dashboard/documents">
                <LibraryIcon className="size-3.5 mr-1.5 text-muted-foreground" />
                <span>Document Library</span>
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* ── Metric Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {permissions.canAccessProjects ? (
          <>
            <div className="rounded-md bg-card border border-border/80 p-4 shadow-2xs flex items-center justify-between hover:border-primary/30 transition-all">
              <div className="space-y-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Active Projects</p>
                <h3 className="text-xl font-bold text-foreground tabular-nums leading-tight">{projectsCount}</h3>
              </div>
              <div className="size-10 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                <FolderKanban className="size-5" />
              </div>
            </div>

            <div className="rounded-md bg-card border border-border/80 p-4 shadow-2xs flex items-center justify-between hover:border-primary/30 transition-all">
              <div className="space-y-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">My Deliverables</p>
                <h3 className="text-xl font-bold text-foreground tabular-nums leading-tight">{tasks.total}</h3>
              </div>
              <div className="size-10 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                <CheckSquare className="size-5" />
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-md bg-card border border-border/80 p-4 shadow-2xs flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Assigned Tasks</p>
              <h3 className="text-xl font-bold text-foreground tabular-nums leading-tight">{tasks.total}</h3>
            </div>
            <div className="size-10 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
              <CheckSquare className="size-5" />
            </div>
          </div>
        )}

        {permissions.canAccessDocuments && (
          <div className="rounded-md bg-card border border-border/80 p-4 shadow-2xs flex items-center justify-between hover:border-primary/30 transition-all">
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Shared Library</p>
              <h3 className="text-xl font-bold text-foreground tabular-nums leading-tight">{documents.total}</h3>
            </div>
            <div className="size-10 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <LibraryIcon className="size-5" />
            </div>
          </div>
        )}

        {permissions.canAccessFileShare && (
          <div className="rounded-md bg-card border border-border/80 p-4 shadow-2xs flex items-center justify-between hover:border-primary/30 transition-all">
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">File Exchange</p>
              <h3 className="text-xl font-bold text-foreground tabular-nums leading-tight">{fileShareCount}</h3>
            </div>
            <div className="size-10 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
              <Share2 className="size-5" />
            </div>
          </div>
        )}
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (7 cols): Deliverables & Authorized Resource Hub */}
        <div className="lg:col-span-7 space-y-4">
          {/* Recent Deliverables Widget */}
          <div className="rounded-md bg-card border border-border/80 overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 border-b border-border/70 flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2">
                <CheckSquare className="size-4 text-primary" />
                <h3 className="text-xs font-bold text-foreground">Recent Deliverables</h3>
                {tasks.total > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {tasks.assignedTasks.length < tasks.total
                      ? `${tasks.assignedTasks.length} of ${tasks.total}`
                      : tasks.total}
                  </span>
                )}
              </div>
              {permissions.canAccessProjects && (
                <Link
                  href="/dashboard/projects/reports"
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  <span>View All</span>
                  <ArrowRight className="size-3" />
                </Link>
              )}
            </div>

            <div className="divide-y divide-border/30">
              {tasks.assignedTasks.length === 0 ? (
                <div className="py-7 px-4 text-center">
                  <CheckCircle2 className="size-6 text-muted-foreground/30 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-muted-foreground">No recent deliverables</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">Tasks assigned, created, or mentioning you will appear here.</p>
                </div>
              ) : (
                tasks.assignedTasks.map((task) => {
                  const taskDate = task.plannedEnd || task.dueDate || task.deadline;
                  const projectUrl = `/dashboard/projects/reports?taskId=${task.id}`;

                  return (
                    <div key={task.id} className="px-4 py-2 hover:bg-muted/20 transition-colors flex items-center justify-between gap-3 group">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        {/* Title & Status/Role Badges inline */}
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <Link href={projectUrl} className="truncate max-w-[200px] sm:max-w-xs">
                            <h4 className="text-xs font-semibold text-foreground hover:text-primary transition-colors truncate">
                              {task.name || task.title || "Untitled Task"}
                            </h4>
                          </Link>

                          <span className={cn(
                            "text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0",
                            task.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" :
                            task.status === "IN_PROGRESS" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" :
                            "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          )}>
                            {task.status?.replace('_', ' ') || "PENDING"}
                          </span>

                          {task.reviewerId === user.id && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 shrink-0">
                              Reviewer
                            </span>
                          )}
                          {task.createdById === user.id && task.assignedToId !== user.id && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 shrink-0">
                              Created
                            </span>
                          )}
                          {task.assignedToId !== user.id && task.reviewerId !== user.id && task.createdById !== user.id && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 shrink-0">
                              Mentioned
                            </span>
                          )}
                        </div>

                        {/* Project context & Due date */}
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span className="truncate max-w-[140px] font-medium text-muted-foreground/80">
                            {task.project?.name || "External Project"}
                          </span>
                          {taskDate && (
                            <>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="flex items-center gap-1 shrink-0 font-medium">
                                <Clock className="size-2.5 text-muted-foreground/60" />
                                {format(new Date(taskDate), "MMM dd, yyyy")}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <Button asChild variant="ghost" size="icon" className="size-6 shrink-0 text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 rounded-sm">
                        <Link href={projectUrl} title="Open Deliverable">
                          <ExternalLink className="size-3" />
                        </Link>
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            {tasks.total > tasks.assignedTasks.length && permissions.canAccessProjects && (
              <div className="py-2 px-3 border-t border-border/40 bg-muted/10 text-center">
                <Link
                  href="/dashboard/projects/reports"
                  className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  <span>View all {tasks.total} deliverables in Task Management</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            )}
          </div>

          {/* Authorized Resources Shortcuts */}
          <div className="rounded-md bg-card border border-border/80 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                <BookOpen className="size-4 text-primary" />
                Authorized Portals & Resources
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {permissions.canAccessDocuments && (
                <Link
                  href="/dashboard/documents"
                  className="p-3 rounded-md border border-border/70 hover:border-primary/40 hover:bg-muted/20 transition-all flex items-start gap-3 group bg-card"
                >
                  <div className="size-8 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <LibraryIcon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">Document Library</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">Shared templates, specs, and resources</p>
                  </div>
                </Link>
              )}

              {permissions.canAccessFileShare && (
                <Link
                  href="/dashboard/file-share"
                  className="p-3 rounded-md border border-border/70 hover:border-primary/40 hover:bg-muted/20 transition-all flex items-start gap-3 group bg-card"
                >
                  <div className="size-8 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <Share2 className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">File Exchange</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">Deliverable files and uploads</p>
                  </div>
                </Link>
              )}

              {permissions.canAccessPolicies && (
                <Link
                  href="/dashboard/policies"
                  className="p-3 rounded-md border border-border/70 hover:border-primary/40 hover:bg-muted/20 transition-all flex items-start gap-3 group bg-card"
                >
                  <div className="size-8 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <BookOpen className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">Working Guidelines</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">Operational policies & terms</p>
                  </div>
                </Link>
              )}

              {permissions.canAccessCalendar && (
                <Link
                  href="/dashboard/calendar"
                  className="p-3 rounded-md border border-border/70 hover:border-primary/40 hover:bg-muted/20 transition-all flex items-start gap-3 group bg-card"
                >
                  <div className="size-8 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
                    <CalendarDays className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">Company Calendar</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">Holidays and schedules</p>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Personal Todo & Communication Feeds */}
        <div className="lg:col-span-5 space-y-4">
          {/* Personal Scratchpad / To-Do List */}
          <TodoList initialTodos={todos} />
        </div>
      </div>
    </div>
  );
}
