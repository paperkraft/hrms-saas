import { PageContainer } from "@/components/ui"
import { getTaskMasters } from "@/actions/task-master"
import { getDepartments } from "@/actions/department"
import { CreateTaskMasterDialog } from "@/components/features/projects/create-task-master-dialog"
import { BulkImportTaskMasterDialog } from "@/components/features/projects/bulk-import-task-master-dialog"
import { TaskMasterTableClient } from "@/components/features/projects/task-master-table-client"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasMenuAccess } from "@/lib/permissions"
import { ListChecks } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Task Master | Project Templates",
  description: "Standardize task durations and activities for each department.",
}

export default async function TaskMasterPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/projects/task-master", "/dashboard/projects")) {
    redirect("/dashboard/projects")
  }
  const taskMastersResult = await getTaskMasters()
  const taskMasters = taskMastersResult.success && taskMastersResult.data ? taskMastersResult.data : []

  const deptsResult = await getDepartments()
  const departments = deptsResult.success && deptsResult.departments ? deptsResult.departments : []

  return (
    <PageContainer maxWidth="full" className="py-6 animate-fade-in space-y-4">
      {/* ── Executive Header Banner ── */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="size-8 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <ListChecks className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 sm:mb-1 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none">
                Task Master
              </h1>
              <Badge variant="outline" className="text-[9px] sm:text-[10px] uppercase font-bold text-primary bg-primary/10 border-primary/20 px-1.5 sm:px-2 py-0.5 rounded-sm">
                Workflow Library
              </Badge>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1 sm:line-clamp-none">
              Standardized task templates, default turn-around durations, and departmental workflow activities
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <BulkImportTaskMasterDialog departments={departments as any} />
          <CreateTaskMasterDialog departments={departments as any} />
        </div>
      </div>

      {/* ── Department Filter Tiles & Interactive Table Client ── */}
      <TaskMasterTableClient taskMasters={taskMasters as any} departments={departments as any} />
    </PageContainer>
  )
}
