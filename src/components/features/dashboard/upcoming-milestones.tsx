"use client";

import { Calendar, Cake, Gift, PartyPopper } from "lucide-react";
import { format, isToday, isTomorrow, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type EventType = "BIRTHDAY" | "ANNIVERSARY" | "HOLIDAY";

interface DashboardEvent {
  id: string;
  name: string;
  date: Date;
  type: EventType;
}

interface Holiday {
  id: string;
  name: string;
  date: Date | string;
}

interface UpcomingMilestonesProps {
  holidays: Holiday[];
  upcomingBirthdays?: { name: string | null; date: string | Date }[];
  upcomingAnniversaries?: { name: string | null; date: string | Date; years: number }[];
}

export function UpcomingMilestones({
  holidays: initialHolidays,
  upcomingBirthdays = [],
  upcomingAnniversaries = [],
}: UpcomingMilestonesProps) {
  const events: DashboardEvent[] = initialHolidays.map((h, idx) => ({
    id: `holiday-${h.id}-${idx}`,
    name: h.name,
    date: new Date(h.date),
    type: "HOLIDAY" as EventType,
  }));

  upcomingBirthdays.forEach((bday, index) => {
    events.push({
      id: `bday-${index}-${bday.name}`,
      name: `${bday.name}'s Birthday`,
      date: new Date(bday.date),
      type: "BIRTHDAY",
    });
  });

  upcomingAnniversaries.forEach((anniv, index) => {
    events.push({
      id: `anniv-${index}-${anniv.name}`,
      name: `${anniv.name}'s Work Anniversary (${anniv.years}y)`,
      date: new Date(anniv.date),
      type: "ANNIVERSARY",
    });
  });

  const sortedEvents = events
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 20);

  const eventConfigs = {
    BIRTHDAY: { icon: Cake, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", label: "Birthday" },
    ANNIVERSARY: { icon: Gift, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", label: "Anniversary" },
    HOLIDAY: { icon: Calendar, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10", label: "Holiday" },
  };

  return (
    <div className="bg-card border border-border/80 rounded-md overflow-hidden flex flex-col h-[430px] shadow-2xs">
      <div className="px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-border/70 flex items-center justify-between bg-muted/20 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <PartyPopper className="size-3.5 text-amber-500 shrink-0" /> Upcoming Events
            </h2>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
              {sortedEvents.length} Events
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5">
            Team birthdays, work anniversaries, and official holidays.
          </p>
        </div>
      </div>

      <div className="divide-y divide-border/40 flex-1 overflow-y-auto">
        {sortedEvents.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Calendar className="size-8 opacity-40" />
            <p className="text-xs font-semibold">No upcoming events on the horizon</p>
          </div>
        ) : (
          sortedEvents.map((event, idx) => {
            const today = isToday(event.date);
            const tomorrow = isTomorrow(event.date);
            const daysLeft = differenceInDays(event.date, new Date());
            const config = eventConfigs[event.type];
            const Icon = config.icon;

            return (
              <div
                key={`milestone-${event.id}-${idx}`}
                className="px-5 py-3.5 flex items-center justify-between group hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "size-9 rounded-md border flex flex-col items-center justify-center shrink-0 transition-colors",
                      today ? "bg-primary/10 border-primary/30 text-primary font-bold" : "bg-muted/50 border-border/60 text-muted-foreground"
                    )}
                  >
                    <span className="text-[9px] uppercase font-bold leading-none">{format(event.date, "MMM")}</span>
                    <span className="text-xs font-bold leading-none mt-0.5">{format(event.date, "dd")}</span>
                  </div>

                  <div className="truncate">
                    <h4 className="text-xs font-semibold text-foreground truncate">{event.name}</h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0.2 rounded-sm gap-1", config.color, config.bg)}>
                        <Icon className="size-2.5" />
                        <span>{config.label}</span>
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {today ? "Today" : tomorrow ? "Tomorrow" : `${daysLeft} days away`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
