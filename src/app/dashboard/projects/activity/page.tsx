import { PageContainer } from "@/components/ui"
import { getActivityLogs, getArchivedActivityLogs, getActivityStats } from "@/actions/activity"
import { ManualArchiveButton } from "@/components/features/projects/manual-archive-button"
import { ActivityTableClient } from "./activity-table-client"
import Link from "next/link"
import { Activity, Layers, CheckCircle2, History, RotateCw, RefreshCw, FileText, Archive } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Project Activity Feed | Audit & Logs",
  description: "Real-time audit log of all project and task operations.",
}

export default async function ActivityLogPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string, page?: string, sortBy?: string, sortOrder?: string }>
}) {
  const params = await searchParams
  const isArchive = params.tab === "archive"
  const page = parseInt(params.page || "1")
  const pageSize = 15
  const sortBy = params.sortBy || "createdAt"
  const sortOrder = params.sortOrder || "desc"

  const [result, statsResult] = await Promise.all([
    isArchive
      ? getArchivedActivityLogs(page, pageSize, sortBy, sortOrder)
      : getActivityLogs(page, pageSize, sortBy, sortOrder),
    getActivityStats()
  ])

  const logs = (result.success && result.data) ? result.data : []
  const total = result.success && result.total ? result.total : 0
  const totalPages = Math.ceil(total / pageSize)
  const stats = statsResult.stats || {
    activeTotal: 0,
    archivedTotal: 0,
    createsCount: 0,
    updatesCount: 0,
    deletesCount: 0,
  }

  return (
    <PageContainer maxWidth="full" className="py-6 animate-fade-in space-y-4">
      {/* ── Executive Header Banner ── */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="size-8 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Activity className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 sm:mb-1 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none">
                Project Activity Feed
              </h1>
              <Badge variant="outline" className="text-[9px] sm:text-[10px] uppercase font-bold text-primary bg-primary/10 border-primary/20 px-1.5 sm:px-2 py-0.5 rounded-sm">
                Audit System
              </Badge>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1 sm:line-clamp-none">
              Real-time audit log of all project lifecycle operations, task status transitions, and team contributions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Active / Archive Toggle */}
          <div className="flex items-center bg-muted/40 p-1 rounded-md border border-border/70">
            <Link 
              href="?tab=active" 
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer", 
                !isArchive ? "bg-background shadow-xs text-foreground font-bold" : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              )}
            >
              Active Logs ({stats.activeTotal})
            </Link>
            <Link 
              href="?tab=archive" 
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer", 
                isArchive ? "bg-background shadow-xs text-foreground font-bold" : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              )}
            >
              Archived ({stats.archivedTotal})
            </Link>
          </div>

          <ManualArchiveButton />

          <Link href={`?tab=${isArchive ? "archive" : "active"}`}>
            <Button
              variant="outline"
              size="sm"
              className="h-8.5 px-3 text-xs font-semibold gap-1.5 rounded-md hover:bg-muted"
              title="Refresh logs"
            >
              <RefreshCw className="size-3.5 text-primary" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Active Operations</span>
            <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground tracking-tight">{stats.activeTotal}</span>
            <span className="text-[11px] text-muted-foreground">recorded</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-block size-2 rounded-full bg-emerald-500" />
            <span>Real-time operational pool</span>
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Creation Events</span>
            <div className="size-8 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">{stats.createsCount}</span>
            <span className="text-[11px] text-muted-foreground">created</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            <span>Projects, tasks & milestones</span>
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Updates & Progress</span>
            <div className="size-8 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <FileText className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-sky-600 dark:text-sky-400 tracking-tight">{stats.updatesCount}</span>
            <span className="text-[11px] text-muted-foreground">modifications</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            <span>Status changes & task edits</span>
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Archived Storage</span>
            <div className="size-8 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Archive className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground tracking-tight">{stats.archivedTotal}</span>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">cold-storage</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            <span>Preserved audit archives</span>
          </div>
        </div>
      </div>

      {/* ── Table & Search Content ── */}
      <ActivityTableClient 
        logs={logs} 
        isArchive={isArchive} 
        sortBy={sortBy} 
        sortOrder={sortOrder} 
        page={page} 
        totalPages={totalPages} 
        pageSize={pageSize} 
        total={total} 
      />
    </PageContainer>
  )
}
