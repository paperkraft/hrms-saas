import { PageContainer } from "@/components/ui";
import { FullCalendar } from "@/components/features/calendar/full-calendar";
import { getCalendarEvents } from "@/actions/calendar";
import { Calendar } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const result = await getCalendarEvents();

  if (!result.success) {
    return (
      <PageContainer maxWidth="full" className="py-6 animate-fade-in space-y-4">
        <div className="p-8 text-center bg-card border border-border/80 rounded-md">
          <p className="text-rose-500 font-bold uppercase tracking-widest text-xs">Error loading calendar</p>
        </div>
      </PageContainer>
    );
  }

  const { holidays, birthdays, announcements, anniversaries } = result.data!;

  return (
    <PageContainer maxWidth="full" className="py-3 sm:py-6 animate-fade-in space-y-3 sm:space-y-4">
      {/* ── Executive Header Banner (Desktop Only) ── */}
      <div className="hidden md:flex rounded-md bg-card border border-border/80 p-5 shadow-2xs flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Calendar className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground tracking-tight leading-none mb-1">
              Company Calendar
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              Global view of company holidays, team birthdays, work anniversaries, and scheduled events
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1">
        <FullCalendar
          initialHolidays={holidays}
          initialBirthdays={birthdays}
          initialAnniversaries={anniversaries}
          initialAnnouncements={announcements}
        />
      </div>
    </PageContainer>
  );
}
