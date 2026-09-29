"use client";

import { useState, useEffect } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui";
import { PageContainer } from "@/components/layout/page-layout";
import { format, differenceInCalendarDays } from "date-fns";
import {
  ArrowLeft,
  LayoutGrid,
  List,
  Calendar,
  User,
  Clock,
  Trophy,
  Repeat,
  Building2,
  FileText,
  CheckCircle2,
  UserPlus,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { KanbanBoard } from "./kanban-board";
import { TaskListView } from "./task-list-view";
import { CreateTaskDialog } from "./create-task-dialog";
import { CreateRecurringScheduleDialog } from "./create-recurring-schedule-dialog";
import { TaskDetailsDialog } from "./task-details-dialog";
import { cn } from "@/lib/utils";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
import { GanttChartView } from "./gantt-chart-view";
import { MilestoneList } from "./milestone-list";
import { CreateMilestoneDialog } from "./create-milestone-dialog";
import { RecurringSchedulesList } from "./recurring-schedules-list";
import { ProjectShareModal } from "./project-share-modal";
import { getLatestTask } from "@/actions/projects/tasks";
import { Button } from "@/components/ui/button";

export function ProjectDetailClient({
  project,
  tasks,
  members,
  allMembers,
  departments = [],
  isAdmin = false,
  isTL = false,
  isAccountant = false,
  currentUserId,
  userDepartment,
  ledDepartment,
  ledDepartmentIds = [],
  milestones,
  recurringSchedules = [],
}: {
  project: any;
  tasks: any[];
  members: any[];
  allMembers?: any[];
  departments?: any[];
  isAdmin?: boolean;
  isTL?: boolean;
  isAccountant?: boolean;
  currentUserId: string;
  userDepartment?: any;
  ledDepartment?: any;
  ledDepartmentIds?: string[];
  milestones: any[];
  recurringSchedules?: any[];
}) {
  const [activeTab, setActiveTab] = useState("list");
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const taskId = searchParams.get("taskId");
    if (!taskId) return;

    // 1. Try to find task in local tasks list
    const foundTask = tasks.find((t: any) => t.id === taskId);
    if (foundTask) {
      setSelectedTask(foundTask);
    } else {
      // 2. Fetch fresh task from server if not found in current view/state
      getLatestTask(taskId)
        .then((res: any) => {
          if (res?.success && (res.data || res.task)) {
            setSelectedTask(res.data || res.task);
          }
        })
        .catch(console.error);
    }
  }, [searchParams, tasks]);

  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const isOverdue =
    project.timeLimit &&
    project.status !== "COMPLETED" &&
    progress < 100 &&
    differenceInCalendarDays(new Date(), new Date(project.timeLimit)) > 0;
  const overdueDays = isOverdue
    ? differenceInCalendarDays(new Date(), new Date(project.timeLimit))
    : 0;

  const overdueTasks = tasks.filter(
    (t) => t.status !== "COMPLETED" && t.plannedEnd && new Date(t.plannedEnd) < new Date()
  ).length;

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
  };

  return (
    <PageContainer maxWidth="full" className="py-6 animate-fade-in space-y-4">
      {/* ── 1. NAVIGATION & TOP ACTIONS ───────────────────────────────── */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push("/dashboard/projects");
              }
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline mb-0.5 sm:mb-1 cursor-pointer bg-transparent border-0 p-0"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Projects Overview</span>
          </button>
          <p className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1 sm:line-clamp-none">
            Strategic Project Workspace & Task Execution Hub
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowShareModal(true)}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              <UserPlus className="size-3.5 text-primary" />
              <span>Share Access</span>
            </Button>
          )}
          {(isAdmin || isTL) && (
            <CreateTaskDialog
              projectId={project.id}
              members={members}
              departments={departments}
              isTLorAdmin={isAdmin || isTL}
              currentUserId={currentUserId}
              userDepartment={ledDepartment ?? userDepartment ?? undefined}
              allMembers={allMembers}
            />
          )}
          {(isAdmin || isTL || isAccountant) && (
            <CreateMilestoneDialog projectId={project.id} />
          )}
          {(isAdmin || isTL || isAccountant) && (
            <CreateRecurringScheduleDialog
              projectId={project.id}
              members={members}
              isTLorAdmin={isAdmin || isTL || !!isAccountant}
              currentUserId={currentUserId}
              departments={departments}
              userDepartment={ledDepartment ?? userDepartment ?? undefined}
            />
          )}
        </div>
      </div>

      <ProjectShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        project={project}
      />

      {/* ── 2. HERO OVERVIEW CARD ─────────────────────────────────────── */}
      <div className="bg-card border border-border/80 rounded-md p-5 sm:p-6 shadow-2xs relative overflow-hidden space-y-6">
        <div className="relative z-10 space-y-5">
          {/* Header Row */}
          <div className="space-y-3">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground wrap-break-word">
                  {project.name}
                </h1>
                <span
                  className={cn(
                    "rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider border shrink-0",
                    project.status === "ACTIVE"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
                  )}
                >
                  {project.status}
                </span>

                {isOverdue && (
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-rose-600 bg-rose-500/10 border border-rose-500/30 animate-pulse">
                    Overdue by {overdueDays}d
                  </span>
                )}
              </div>

              {project.description ? (
                <RichTextViewer
                  content={project.description}
                  className="text-muted-foreground text-xs sm:text-sm font-normal max-w-4xl leading-relaxed [&_p]:mb-1 [&_p]:last:mb-0"
                />
              ) : (
                <p className="text-muted-foreground text-xs sm:text-sm font-normal max-w-4xl leading-relaxed">
                  Executing project milestones, client deliverables, and task operations.
                </p>
              )}
            </div>

            {/* Sleek inline Progress Bar */}
            <div className="max-w-md pt-0.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-muted-foreground text-xs">Overall Progress</span>
                  <span className="text-[11px] font-semibold text-foreground font-mono bg-muted/80 px-1.5 py-0.5 rounded border border-border/60">
                    {completedTasks} / {totalTasks} Tasks
                  </span>
                </div>
                <span className="font-bold text-primary font-mono text-xs">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border/40">
                <div
                  className="h-full bg-primary transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* ── Compact Mobile Summary & Dialog Trigger (Mobile Only) ──── */}
          <div className="md:hidden pt-3 border-t border-border/60 space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-xs bg-muted/30 p-2.5 rounded-md border border-border/60">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="size-3.5 text-primary shrink-0" />
                <span className="text-muted-foreground font-medium shrink-0">Client:</span>
                <span className="font-semibold text-foreground truncate">{project.client || "Self-Managed / Internal"}</span>
              </div>
              {project.timeLimit && (
                <span
                  className={cn(
                    "text-[10px] font-mono font-semibold px-2 py-0.5 rounded shrink-0",
                    isOverdue
                      ? "bg-rose-500/15 text-rose-600 border border-rose-500/30"
                      : "bg-background text-muted-foreground border border-border"
                  )}
                >
                  {format(new Date(project.timeLimit), "MMM d, yyyy")}
                </span>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowInfoDialog(true)}
              className="w-full h-8 text-xs font-medium gap-1.5 border-border/80 bg-background/50 hover:bg-muted/50"
            >
              <Info className="size-3.5 text-primary" />
              <span>View Full Project Info & Metadata</span>
            </Button>
          </div>

          {/* ── Key Parameters Grid (Desktop / Tablet Only) ────────────── */}
          <div className="hidden md:grid md:grid-cols-4 gap-3.5 pt-4 border-t border-border/60">
            {/* 1. Client */}
            <div className="p-3 rounded-md bg-background/60 border border-border/70 flex items-start gap-2.5 col-span-2">
              <div className="p-2 rounded-md bg-primary/10 text-primary border border-primary/20 shrink-0 mt-0.5">
                <Building2 className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Client
                </p>
                <p className="text-xs font-bold text-foreground mt-0.5 break-words leading-snug">
                  {project.client || "Self-Managed / Internal"}
                </p>
              </div>
            </div>

            {/* 2. Coordinator */}
            <div className="p-3 rounded-md bg-background/60 border border-border/70 flex items-start gap-2.5">
              <div className="p-2 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20 shrink-0 mt-0.5">
                <User className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Coordinator
                </p>
                <p className="text-xs font-bold text-foreground truncate mt-0.5" title={project.projectCoordinateName || "Not Assigned"}>
                  {project.projectCoordinateName || "Not Assigned"}
                </p>
              </div>
            </div>

            {/* 3. Doc Manager */}
            <div className="p-3 rounded-md bg-background/60 border border-border/70 flex items-start gap-2.5">
              <div className="p-2 rounded-md bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 shrink-0 mt-0.5">
                <FileText className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Doc Manager
                </p>
                <p className="text-xs font-bold text-foreground truncate mt-0.5" title={project.documentManagerName || "Not Assigned"}>
                  {project.documentManagerName || "Not Assigned"}
                </p>
              </div>
            </div>

            {/* 4. Started / Work Order */}
            <div className="p-3 rounded-md bg-background/60 border border-border/70 flex items-start gap-2.5">
              <div className="p-2 rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20 shrink-0 mt-0.5">
                <Calendar className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Work Order / Start
                </p>
                <p className="text-xs font-bold text-foreground truncate mt-0.5 font-mono">
                  {project.dateOfWorkOrder
                    ? format(new Date(project.dateOfWorkOrder), "MMM d, yyyy")
                    : "---"}
                </p>
              </div>
            </div>

            {/* 5. Deadline */}
            <div className="p-3 rounded-md bg-background/60 border border-border/70 flex items-start gap-2.5">
              <div
                className={cn(
                  "p-2 rounded-md shrink-0 mt-0.5 border",
                  isOverdue
                    ? "bg-rose-500/15 text-rose-600 border-rose-500/30"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                )}
              >
                <Clock className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Deadline
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span
                    className={cn(
                      "text-xs font-bold font-mono",
                      isOverdue ? "text-rose-600" : "text-foreground"
                    )}
                  >
                    {project.timeLimit
                      ? format(new Date(project.timeLimit), "MMM d, yyyy")
                      : "No Limit"}
                  </span>
                  {isOverdue && (
                    <span className="text-[9px] font-bold uppercase text-rose-600 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.2 rounded">
                      +{overdueDays}d overdue
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 6. Tasks Health */}
            <div className="p-3 rounded-md bg-background/60 border border-border/70 flex items-start gap-2.5">
              <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0 mt-0.5">
                <CheckCircle2 className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Task Execution
                </p>
                <p className="text-xs font-bold text-foreground truncate mt-0.5">
                  {completedTasks} / {totalTasks} Completed
                </p>
                {overdueTasks > 0 && (
                  <p className="text-[10px] font-semibold text-rose-600 truncate mt-0.5">
                    {overdueTasks} {overdueTasks === 1 ? "task" : "tasks"} overdue
                  </p>
                )}
              </div>
            </div>

            {/* 7. Milestones */}
            {(isAdmin || isAccountant) && (
              <div className="p-3 rounded-md bg-background/60 border border-border/70 flex items-start gap-2.5">
                <div className="p-2 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0 mt-0.5">
                  <Trophy className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Milestones
                  </p>
                  <p className="text-xs font-bold text-foreground truncate mt-0.5">
                    {milestones.filter((m: any) => m.status === "COMPLETED").length} /{" "}
                    {milestones.length} Reached
                  </p>
                  {milestones.find((m: any) => m.status === "PENDING") && (
                    <p className="text-[10px] text-primary truncate mt-0.5 font-medium" title={milestones.find((m: any) => m.status === "PENDING").title}>
                      Next: {milestones.find((m: any) => m.status === "PENDING").title}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 8. Retention Period */}
            <div className="p-3 rounded-md bg-background/60 border border-border/70 flex items-start gap-2.5">
              <div className="p-2 rounded-md bg-cyan-500/10 text-cyan-600 border border-cyan-500/20 shrink-0 mt-0.5">
                <Calendar className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Retention Period
                </p>
                {project.retentionStartDate && project.retentionDurationMonths ? (
                  <div className="flex flex-col mt-0.5">
                    <span className="text-xs font-bold text-foreground truncate">
                      {project.retentionDurationMonths} {project.retentionDurationMonths === 1 ? "Month" : "Months"}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate font-mono">
                      Ends: {project.retentionEndDate ? format(new Date(project.retentionEndDate), "MMM d, yyyy") : "N/A"}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs font-bold text-muted-foreground truncate mt-0.5">
                    Not Configured
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile Project Info Dialog ─────────────────────────────────── */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[85dvh] overflow-y-auto p-4 sm:p-6 rounded-lg">
          <DialogHeader className="pb-3 border-b border-border/60 pr-7">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="text-base font-bold text-foreground">
                Project Information
              </DialogTitle>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border shrink-0",
                  project.status === "ACTIVE"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
                )}
              >
                {project.status}
              </span>
            </div>
            <DialogDescription className="text-xs text-muted-foreground font-medium pt-0.5 truncate">
              {project.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 pt-2">
            {/* Client */}
            <div className="p-2.5 sm:p-3 rounded-lg bg-muted/40 border border-border/60 flex items-start gap-2.5">
              <div className="p-1.5 sm:p-2 rounded-md bg-primary/10 text-primary border border-primary/20 shrink-0 mt-0.5">
                <Building2 className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Client</p>
                <p className="text-xs font-bold text-foreground mt-0.5 break-words">
                  {project.client || "Self-Managed / Internal"}
                </p>
              </div>
            </div>

            {/* Coordinator */}
            <div className="p-2.5 sm:p-3 rounded-lg bg-muted/40 border border-border/60 flex items-start gap-2.5">
              <div className="p-1.5 sm:p-2 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20 shrink-0 mt-0.5">
                <User className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Coordinator</p>
                <p className="text-xs font-bold text-foreground mt-0.5 break-words">
                  {project.projectCoordinateName || "Not Assigned"}
                </p>
              </div>
            </div>

            {/* Doc Manager */}
            <div className="p-2.5 sm:p-3 rounded-lg bg-muted/40 border border-border/60 flex items-start gap-2.5">
              <div className="p-1.5 sm:p-2 rounded-md bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 shrink-0 mt-0.5">
                <FileText className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Doc Manager</p>
                <p className="text-xs font-bold text-foreground mt-0.5 break-words">
                  {project.documentManagerName || "Not Assigned"}
                </p>
              </div>
            </div>

            {/* Work Order / Start */}
            <div className="p-2.5 sm:p-3 rounded-lg bg-muted/40 border border-border/60 flex items-start gap-2.5">
              <div className="p-1.5 sm:p-2 rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20 shrink-0 mt-0.5">
                <Calendar className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Work Order / Start</p>
                <p className="text-xs font-bold text-foreground mt-0.5 font-mono">
                  {project.dateOfWorkOrder ? format(new Date(project.dateOfWorkOrder), "MMMM d, yyyy") : "Not Set"}
                </p>
              </div>
            </div>

            {/* Deadline */}
            <div className="p-2.5 sm:p-3 rounded-lg bg-muted/40 border border-border/60 flex items-start gap-2.5">
              <div
                className={cn(
                  "p-1.5 sm:p-2 rounded-md shrink-0 mt-0.5 border",
                  isOverdue
                    ? "bg-rose-500/15 text-rose-600 border-rose-500/30"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                )}
              >
                <Clock className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deadline</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className={cn("text-xs font-bold font-mono", isOverdue ? "text-rose-600" : "text-foreground")}>
                    {project.timeLimit ? format(new Date(project.timeLimit), "MMMM d, yyyy") : "No Limit"}
                  </span>
                  {isOverdue && (
                    <span className="text-[9px] font-bold uppercase text-rose-600 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.2 rounded">
                      +{overdueDays}d overdue
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Task Execution Health */}
            <div className="p-2.5 sm:p-3 rounded-lg bg-muted/40 border border-border/60 flex items-start gap-2.5">
              <div className="p-1.5 sm:p-2 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0 mt-0.5">
                <CheckCircle2 className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Task Execution</p>
                <p className="text-xs font-bold text-foreground mt-0.5">
                  {completedTasks} / {totalTasks} Completed ({progress}%)
                </p>
                {overdueTasks > 0 && (
                  <p className="text-[10px] font-semibold text-rose-600 mt-0.5">
                    {overdueTasks} {overdueTasks === 1 ? "task" : "tasks"} overdue
                  </p>
                )}
              </div>
            </div>

            {/* Milestones */}
            {(isAdmin || isAccountant) && (
              <div className="p-2.5 sm:p-3 rounded-lg bg-muted/40 border border-border/60 flex items-start gap-2.5">
                <div className="p-1.5 sm:p-2 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0 mt-0.5">
                  <Trophy className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Milestones</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">
                    {milestones.filter((m: any) => m.status === "COMPLETED").length} / {milestones.length} Reached
                  </p>
                  {milestones.find((m: any) => m.status === "PENDING") && (
                    <p className="text-[10px] text-primary mt-0.5 font-medium">
                      Next: {milestones.find((m: any) => m.status === "PENDING").title}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Retention Period */}
            <div className="p-2.5 sm:p-3 rounded-lg bg-muted/40 border border-border/60 flex items-start gap-2.5">
              <div className="p-1.5 sm:p-2 rounded-md bg-cyan-500/10 text-cyan-600 border border-cyan-500/20 shrink-0 mt-0.5">
                <Calendar className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Retention Period</p>
                {project.retentionStartDate && project.retentionDurationMonths ? (
                  <div className="flex flex-col mt-0.5">
                    <span className="text-xs font-bold text-foreground">
                      {project.retentionDurationMonths} {project.retentionDurationMonths === 1 ? "Month" : "Months"}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Ends: {project.retentionEndDate ? format(new Date(project.retentionEndDate), "MMMM d, yyyy") : "N/A"}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs font-bold text-muted-foreground mt-0.5">Not Configured</p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 3. WORKSPACE VIEW TABS ─────────────────────────────────────── */}
      <Tabs defaultValue="list" className="space-y-4" onValueChange={setActiveTab}>
        {/* Sticky Tab Navigator */}
        <div className="bg-card border border-border/80 rounded-md p-1.5 shadow-2xs sticky top-4 z-30 flex items-center justify-between overflow-x-auto scrollbar-hide">
          <TabsList className="bg-transparent h-9 gap-1.5 p-0 w-max">
            <TabsTrigger
              value="list"
              className="rounded-md px-4 text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all gap-1.5 cursor-pointer shadow-2xs"
            >
              <List className="size-3.5" />
              <span>List View</span>
              <span className="text-[10px] font-mono opacity-80">({tasks.length})</span>
            </TabsTrigger>

            <TabsTrigger
              value="board"
              className="hidden md:inline-flex rounded-md px-4 text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all gap-1.5 cursor-pointer shadow-2xs"
            >
              <LayoutGrid className="size-3.5" />
              <span>Kanban Board</span>
            </TabsTrigger>

            <TabsTrigger
              value="timeline"
              className="hidden md:inline-flex rounded-md px-4 text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all gap-1.5 cursor-pointer shadow-2xs"
            >
              <Clock className="size-3.5" />
              <span>Gantt Timeline</span>
            </TabsTrigger>

            {(isAdmin || isAccountant) && (
              <TabsTrigger
                value="milestones"
                className="rounded-md px-4 text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all gap-1.5 cursor-pointer shadow-2xs"
              >
                <Trophy className="size-3.5" />
                <span>Milestones</span>
                <span className="text-[10px] font-mono opacity-80">({milestones.length})</span>
              </TabsTrigger>
            )}

            {(isAdmin || isAccountant) && (
              <TabsTrigger
                value="recurring"
                className="rounded-md px-4 text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all gap-1.5 cursor-pointer shadow-2xs"
              >
                <Repeat className="size-3.5" />
                <span>Recurring</span>
                <span className="text-[10px] font-mono opacity-80">
                  ({recurringSchedules.length})
                </span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Tab Contents */}
        <TabsContent value="list" className="animate-in fade-in duration-300 m-0">
          <TaskListView
            tasks={tasks}
            isAdmin={isAdmin}
            isTL={isTL}
            userDepartment={userDepartment}
            ledDepartment={ledDepartment}
            ledDepartmentIds={ledDepartmentIds}
            currentUserId={currentUserId}
            members={members}
            allMembers={allMembers}
            onTaskClick={handleTaskClick}
          />
        </TabsContent>

        <TabsContent value="board" className="animate-in fade-in duration-300 m-0">
          <KanbanBoard
            initialTasks={tasks}
            members={members}
            allMembers={allMembers}
            projectName={project?.name}
            onTaskClick={handleTaskClick}
          />
        </TabsContent>

        <TabsContent value="timeline" className="animate-in fade-in duration-300 m-0 outline-none">
          <GanttChartView
            tasks={tasks}
            members={members}
            onTaskClick={handleTaskClick}
            isAdmin={isAdmin || isTL}
            milestones={milestones}
          />
        </TabsContent>

        {(isAdmin || isAccountant) && (
          <TabsContent value="milestones" className="animate-in fade-in duration-300 m-0">
            <MilestoneList
              projectId={project.id}
              milestones={milestones}
              isTLorAdmin={isAdmin || isAccountant}
            />
          </TabsContent>
        )}

        {(isAdmin || isAccountant) && (
          <TabsContent value="recurring" className="animate-in fade-in duration-300 m-0">
            <RecurringSchedulesList
              schedules={recurringSchedules || []}
              isAdmin={isAdmin || !!isAccountant}
              members={members}
              currentUserId={currentUserId}
              projectId={project.id}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Task Details Modal */}
      <TaskDetailsDialog
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTask(null);
            const newParams = new URLSearchParams(window.location.search);
            if (newParams.has("taskId")) {
              newParams.delete("taskId");
              const newUrl = newParams.toString()
                ? `${pathname}?${newParams.toString()}`
                : pathname;
              router.replace(newUrl, { scroll: false });
            }
          }
        }}
        members={members}
        allMembers={allMembers}
      />
    </PageContainer>
  );
}
