import { getSystemConfig, getLocations } from "@/actions/settings"
import { getHolidays } from "@/actions/holiday"
import { getDepartments } from "@/actions/department"
import { getAllAnnouncementsForAdmin } from "@/actions/announcement"
import { SettingsForm } from "@/components/features/admin/settings-form"
import { PageContainer } from "@/components/ui"
import { Settings2 } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const config = await getSystemConfig()
  const locations = await getLocations()
  const holidaysResult = await getHolidays()
  const holidays = holidaysResult.success ? holidaysResult.data : []

  const deptsResult = await getDepartments()
  const departments = deptsResult.success ? deptsResult.departments : []

  const announcementsResult = await getAllAnnouncementsForAdmin()
  const announcements = announcementsResult.success ? announcementsResult.data : []

  return (
    <PageContainer maxWidth="full" className="py-6 animate-fade-in space-y-4">
      {/* Page Header Banner (Desktop Only) */}
      <div className="hidden md:flex rounded-md bg-card border border-border/80 p-5 shadow-2xs flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Settings2 className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground tracking-tight leading-none mb-1">
              System Configuration
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              Manage global working hours, office locations, attendance policies, and system announcements
            </p>
          </div>
        </div>
      </div>

      <SettingsForm
        initialData={{
          defaultOfficeStartTime: config?.defaultOfficeStartTime ?? "09:30",
          defaultOfficeEndTime: config?.defaultOfficeEndTime ?? "18:00",
          defaultGraceTimeMinutes: config?.defaultGraceTimeMinutes ?? 10,
          lateMarkEnabled: config?.lateMarkEnabled ?? true,
          lateMarkAllowedCount: config?.lateMarkAllowedCount ?? 3,
          specialCaseEnabled: (config as any)?.specialCaseEnabled ?? true,
          specialCaseExtraMinutes: (config as any)?.specialCaseExtraMinutes ?? 0,
          specialCaseMaxLateMinutes: (config as any)?.specialCaseMaxLateMinutes ?? 10,
          autoPunchOutEnabled: config?.autoPunchOutEnabled ?? true,
          autoPunchOutDelayHours: config?.autoPunchOutDelayHours ?? 2,
          autoPunchOutWarningThreshold: config?.autoPunchOutWarningThreshold ?? 3,
          semiAnnualPolicyEnabled: config?.semiAnnualPolicyEnabled ?? true,
          semiAnnualCycleStartMonth: config?.semiAnnualCycleStartMonth ?? 4,
          firstHalfEndTime: config?.firstHalfEndTime ?? "13:30",
          secondHalfStartTime: config?.secondHalfStartTime ?? "13:30",
          earlyLogoffEnabled: (config as any)?.earlyLogoffEnabled ?? true,
          earlyLogoffAllowedCount: (config as any)?.earlyLogoffAllowedCount ?? 3,
          maxOvertimeHoursPerDay: (config as any)?.maxOvertimeHoursPerDay ?? 4,
        }}
        initialLocations={locations}
        initialHolidays={holidays || []}
        initialDepartments={departments || []}
        initialAnnouncements={announcements || []}
      />
    </PageContainer>
  )
}
