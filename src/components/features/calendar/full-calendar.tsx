"use client";

import { useState, useMemo } from "react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  eachDayOfInterval,
  isToday,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Gift,
  PartyPopper,
  Megaphone,
  Palmtree,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

interface FullCalendarProps {
  initialHolidays: any[];
  initialBirthdays: any[];
  initialAnniversaries: any[];
  initialAnnouncements: any[];
  className?: string;
}

export function FullCalendar({
  initialHolidays,
  initialBirthdays,
  initialAnniversaries,
  initialAnnouncements,
  className,
}: FullCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const holidays = useMemo(
    () =>
      initialHolidays.map((h) => ({
        ...h,
        title: h.name || h.title,
        date: new Date(h.date),
        type: "HOLIDAY",
      })),
    [initialHolidays]
  );

  const announcements = useMemo(
    () =>
      initialAnnouncements.map((a) => ({
        ...a,
        date: new Date(a.date || a.createdAt),
        type: "ANNOUNCEMENT",
      })),
    [initialAnnouncements]
  );

  const birthdays = useMemo(() => {
    const year = currentDate.getFullYear();
    return (initialBirthdays || []).map((b) => {
      const orig = new Date(b.originalDate || b.date);
      return {
        ...b,
        date: new Date(year, orig.getMonth(), orig.getDate()),
        type: "BIRTHDAY",
      };
    });
  }, [initialBirthdays, currentDate]);

  const anniversaries = useMemo(() => {
    const year = currentDate.getFullYear();
    return (initialAnniversaries || [])
      .map((a) => {
        const orig = new Date(a.originalDate || a.date);
        const years = year - orig.getFullYear();
        if (years <= 0) return null;
        return {
          ...a,
          title: a.empName
            ? `${a.empName}'s ${years}${getOrdinal(years)} Anniversary`
            : a.title,
          date: new Date(year, orig.getMonth(), orig.getDate()),
          type: "ANNIVERSARY",
          years,
        };
      })
      .filter(Boolean);
  }, [initialAnniversaries, currentDate]);

  const allEvents = useMemo(
    () => [...holidays, ...birthdays, ...anniversaries, ...announcements],
    [holidays, birthdays, anniversaries, announcements]
  );

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const getDayEvents = (day: Date) => {
    return allEvents.filter((event) => isSameDay(event.date, day));
  };

  const selectedDayEvents = useMemo(
    () => getDayEvents(selectedDate),
    [selectedDate, allEvents]
  );

  const upcomingEvents = useMemo(() => {
    return allEvents
      .filter((event) => isSameMonth(event.date, currentDate))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [currentDate, allEvents]);

  // Month counts
  const monthHolidayCount = upcomingEvents.filter((e) => e.type === "HOLIDAY").length;
  const monthBirthdayCount = upcomingEvents.filter((e) => e.type === "BIRTHDAY").length;
  const monthAnniversaryCount = upcomingEvents.filter((e) => e.type === "ANNIVERSARY").length;

  const getEventBadgeStyle = (type: string) => {
    switch (type) {
      case "HOLIDAY":
        return {
          badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/25",
          dot: "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]",
          icon: Palmtree,
          label: "Holiday",
        };
      case "BIRTHDAY":
        return {
          badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25",
          dot: "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]",
          icon: Gift,
          label: "Birthday",
        };
      case "ANNIVERSARY":
        return {
          badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25",
          dot: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]",
          icon: PartyPopper,
          label: "Anniversary",
        };
      case "ANNOUNCEMENT":
      default:
        return {
          badge: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/25",
          dot: "bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.5)]",
          icon: Megaphone,
          label: "Announcement",
        };
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col lg:flex-row bg-card border border-border/80 rounded-md shadow-xs overflow-hidden",
        "h-auto lg:h-[calc(100vh-230px)] min-h-0 lg:min-h-[640px]",
        className
      )}
    >
      {/* ── LEFT SIDEBAR: Event Schedule & Details ──────────────────────── */}
      <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-r border-border/70 flex flex-col shrink-0 bg-muted/20 dark:bg-muted/10 order-2 lg:order-1 h-[360px] sm:h-[420px] lg:h-full">
        {/* Sidebar Header */}
        <div className="px-4 py-3 sm:py-3.5 h-12 sm:h-14 border-b border-border/60 bg-card/60 backdrop-blur-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <CalendarIcon className="size-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Schedule
              </h3>
              <p className="text-[10px] text-muted-foreground">
                {format(currentDate, "MMMM yyyy")}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
            {upcomingEvents.length} events
          </span>
        </div>

        {/* Sidebar Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Selected Day View */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                <span>{format(selectedDate, "EEEE, MMM d")}</span>
              </span>
              {isToday(selectedDate) && (
                <span className="text-[9px] font-black uppercase text-primary px-2 py-0.5 bg-primary/15 border border-primary/30 rounded-md">
                  Today
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              {selectedDayEvents.length > 0 ? (
                selectedDayEvents.map((event, idx) => {
                  const style = getEventBadgeStyle(event.type);
                  const Icon = style.icon;

                  return (
                    <div
                      key={event.id || idx}
                      className="flex flex-col gap-1.5 p-3 rounded-md border border-border/70 bg-card shadow-2xs hover:border-primary/40 transition-all"
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={cn(
                            "p-1.5 rounded-md shrink-0 mt-0.5 border",
                            style.badge
                          )}
                        >
                          <Icon className="size-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground leading-snug">
                            {event.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={cn(
                                "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border",
                                style.badge
                              )}
                            >
                              {style.label}
                            </span>
                            {event.description && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                {event.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-6 flex flex-col items-center justify-center text-center px-4 rounded-md border border-dashed border-border/70 bg-card/40">
                  <Clock className="size-4 text-muted-foreground/40 mb-1.5" />
                  <p className="text-[11px] text-muted-foreground font-medium">
                    No events on this day
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Monthly Overview */}
          <div className="pt-2 border-t border-border/60">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                This Month Highlights
              </span>
              <span className="text-[9px] text-muted-foreground font-mono">
                {upcomingEvents.length}
              </span>
            </div>

            <div className="space-y-1">
              {upcomingEvents.map((event, idx) => {
                const style = getEventBadgeStyle(event.type);
                const isSelected = isSameDay(event.date, selectedDate);
                const Icon = style.icon;

                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-all border border-transparent",
                      isSelected
                        ? "bg-primary/10 border-primary/30 shadow-2xs"
                        : "hover:bg-card hover:border-border/60"
                    )}
                    onClick={() => {
                      setSelectedDate(event.date);
                      setCurrentDate(event.date);
                    }}
                  >
                    <div className="flex flex-col items-center justify-center min-w-[32px] py-0.5 px-1 rounded-md bg-muted/60 border border-border/50 text-center shrink-0">
                      <span className="text-[8px] font-black uppercase text-muted-foreground leading-none">
                        {format(event.date, "MMM")}
                      </span>
                      <span className="text-xs font-black text-foreground tabular-nums leading-tight mt-0.5">
                        {format(event.date, "dd")}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {event.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={cn("size-1.5 rounded-full", style.dot)} />
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">
                          {style.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {upcomingEvents.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6 italic">
                  No events scheduled for {format(currentDate, "MMMM yyyy")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Legend Footer */}
        <div className="p-3 border-t border-border/70 bg-card/60 backdrop-blur-xs grid grid-cols-2 gap-2 text-[10px]">
          <div className="flex items-center gap-1.5 font-medium text-foreground/80">
            <div className="size-2 rounded-full bg-rose-500" />
            <span>Holiday ({monthHolidayCount})</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-foreground/80">
            <div className="size-2 rounded-full bg-amber-500" />
            <span>Birthday ({monthBirthdayCount})</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-foreground/80">
            <div className="size-2 rounded-full bg-emerald-500" />
            <span>Anniversary ({monthAnniversaryCount})</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-foreground/80">
            <div className="size-2 rounded-full bg-indigo-500" />
            <span>Announcement</span>
          </div>
        </div>
      </div>

      {/* ── MAIN CALENDAR GRID ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 order-1 lg:order-2 h-auto lg:h-full bg-card">
        {/* Calendar Header Bar */}
        <div className="h-12 sm:h-14 px-3 sm:px-4 lg:px-6 border-b border-border/70 flex items-center justify-between bg-card sticky top-0 z-10">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-foreground tracking-tight flex items-center gap-1.5 sm:gap-2 truncate">
              <span className="truncate">{format(currentDate, "MMMM yyyy")}</span>
              {isSameMonth(currentDate, new Date()) && (
                <span className="hidden xs:inline-block text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">
                  Current
                </span>
              )}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-muted/40 p-0.5 sm:p-1 rounded-lg border border-border/70 shadow-2xs">
              <Button
                variant="ghost"
                size="icon"
                onClick={prevMonth}
                className="size-7 rounded-md hover:bg-card hover:shadow-xs transition-all cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="size-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  setCurrentDate(today);
                  setSelectedDate(today);
                }}
                className="h-7 px-2.5 sm:px-3 text-xs font-bold rounded-md hover:bg-card hover:shadow-xs transition-all cursor-pointer"
              >
                Today
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={nextMonth}
                className="size-7 rounded-md hover:bg-card hover:shadow-xs transition-all cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Weekday Column Headers */}
        <div className="grid grid-cols-7 border-b border-border/70 bg-muted/30 dark:bg-muted/20">
          {[
            { name: "Sunday", short: "Sun", isWeekend: true },
            { name: "Monday", short: "Mon" },
            { name: "Tuesday", short: "Tue" },
            { name: "Wednesday", short: "Wed" },
            { name: "Thursday", short: "Thu" },
            { name: "Friday", short: "Fri" },
            { name: "Saturday", short: "Sat" },
          ].map((day) => (
            <div key={day.name} className="py-2 sm:py-2.5 px-0.5 sm:px-2 text-center">
              <span
                className={cn(
                  "text-[10px] sm:text-[11px] font-bold uppercase tracking-wider",
                  day.isWeekend
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-muted-foreground font-semibold"
                )}
              >
                {day.short}
              </span>
            </div>
          ))}
        </div>

        {/* Calendar Day Grid */}
        <div className="flex-1 grid grid-cols-7 divide-x divide-y divide-border/60 bg-muted/15 dark:bg-background overflow-y-auto">
          {calendarDays.map((day, idx) => {
            const events = getDayEvents(day);
            const isCurrentMonthDay = isSameMonth(day, monthStart);
            const isTodayDay = isToday(day);
            const isSelected = isSameDay(day, selectedDate);
            const isSunday = day.getDay() === 0;
            const isHoliday = events.some((e) => e.type === "HOLIDAY");

            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "h-full min-h-[50px] sm:min-h-[75px] lg:min-h-[90px] p-1 sm:p-1.5 transition-all relative flex flex-col justify-between cursor-pointer group select-none",
                  // Cell backgrounds for high contrast
                  !isCurrentMonthDay && "bg-muted/40 dark:bg-muted/15 opacity-40 hover:opacity-70",
                  isCurrentMonthDay && !isSelected && "bg-card hover:bg-accent/40",
                  isSunday && isCurrentMonthDay && !isSelected && "bg-rose-500/[0.03] dark:bg-rose-500/[0.05]",
                  isHoliday && isCurrentMonthDay && !isSelected && "bg-rose-500/[0.05] dark:bg-rose-500/[0.08]",
                  // Active selection styling
                  isSelected && "bg-primary/10 ring-2 ring-inset ring-primary z-2 shadow-sm"
                )}
              >
                {/* Desktop Day Header (Number + Top Right Dots) */}
                <div className="hidden sm:flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "text-xs font-bold tabular-nums min-w-[22px] h-[22px] px-1 rounded-md flex items-center justify-center transition-all",
                      isTodayDay
                        ? "bg-primary text-primary-foreground font-extrabold shadow-sm scale-105"
                        : isSelected
                        ? "bg-primary/20 text-primary font-bold"
                        : isSunday || isHoliday
                        ? "text-rose-600 dark:text-rose-400 font-bold"
                        : isCurrentMonthDay
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground/60"
                    )}
                  >
                    {format(day, "d")}
                  </span>

                  {events.length > 0 && (
                    <div className="flex items-center gap-0.5">
                      {events.slice(0, 3).map((event, eIdx) => {
                        const style = getEventBadgeStyle(event.type);
                        return (
                          <div
                            key={eIdx}
                            className={cn("size-1.5 rounded-full", style.dot)}
                            title={`${event.type}: ${event.title}`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Mobile Day Header (Centered Date Number + Dots Underneath) */}
                <div className="flex sm:hidden flex-col items-center justify-center py-0.5">
                  <span
                    className={cn(
                      "text-xs font-bold tabular-nums size-6 rounded-md flex items-center justify-center transition-all",
                      isTodayDay
                        ? "bg-primary text-primary-foreground font-extrabold shadow-sm"
                        : isSelected
                        ? "bg-primary/20 text-primary font-bold"
                        : isSunday || isHoliday
                        ? "text-rose-600 dark:text-rose-400 font-bold"
                        : isCurrentMonthDay
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground/60"
                    )}
                  >
                    {format(day, "d")}
                  </span>

                  {/* Mobile Dots Indicator */}
                  {events.length > 0 && (
                    <div className="flex items-center justify-center gap-0.5 mt-0.5 flex-wrap max-w-full px-0.5">
                      {events.slice(0, 3).map((event, eIdx) => {
                        const style = getEventBadgeStyle(event.type);
                        return (
                          <span
                            key={eIdx}
                            className={cn("size-1.5 rounded-full shrink-0", style.dot)}
                            title={`${event.type}: ${event.title}`}
                          />
                        );
                      })}
                      {events.length > 3 && (
                        <span className="text-[8px] font-black text-muted-foreground leading-none scale-90">
                          +{events.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Desktop Day Events Pill Tags (Hidden on Mobile) */}
                <div className="hidden sm:flex flex-1 flex-col gap-1 overflow-hidden mt-1">
                  {events.slice(0, 2).map((event, eIdx) => {
                    const style = getEventBadgeStyle(event.type);
                    const Icon = style.icon;

                    return (
                      <div
                        key={eIdx}
                        className={cn(
                          "flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium leading-tight truncate transition-all shadow-2xs",
                          style.badge
                        )}
                        title={event.title}
                      >
                        <Icon className="size-2.5 shrink-0" />
                        <span className="truncate font-semibold">{event.title}</span>
                      </div>
                    );
                  })}

                  {events.length > 2 && (
                    <span className="text-[9px] font-bold text-muted-foreground px-1 hover:text-primary">
                      +{events.length - 2} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
