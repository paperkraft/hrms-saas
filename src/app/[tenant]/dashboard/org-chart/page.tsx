import { getOrgData } from "@/actions/org-chart"
import { OrgChart } from "@/components/features/admin/org-chart"
import { PageContainer } from "@/components/ui"
import { Metadata } from "next"
import { Users2 } from "lucide-react"

export const metadata: Metadata = {
  title: "Organization Chart",
  description: "View the company's reporting structure and personnel hierarchy.",
}

export default async function OrgChartPage() {
  const data = await getOrgData()

  return (
    <PageContainer
      maxWidth="full"
      className="h-[calc(100dvh-64px)] max-h-[calc(100dvh-64px)] py-2 sm:py-3 px-2 sm:px-4 md:px-6 flex flex-col min-h-0 overflow-hidden space-y-2 sm:space-y-4"
    >
      {/* ── Executive Header Banner (Desktop Only) ── */}
      <div className="hidden md:flex rounded-md bg-card border border-border/80 p-5 shadow-2xs flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Users2 className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground tracking-tight leading-none mb-1">
              Organization Chart
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              Visualize reporting lines, structural hierarchy, and organizational personnel relationships
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full relative flex flex-col overflow-hidden border border-border/80 rounded-md bg-card shadow-2xs p-1.5 sm:p-2">
        <OrgChart initialData={data} mode="reporting" />
      </div>
    </PageContainer>
  )
}
