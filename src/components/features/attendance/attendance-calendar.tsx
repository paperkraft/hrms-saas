"use client";

import React, { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CalendarDays,
  Plane,
  Clock,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AttendanceLog {
  id: string;
  date: Date;
  punchIn: Date | null;
  punchOut: Date | null;
  isLate: boolean;
  isLateSpecialCase?: boolean;
  isHalfDay?: boolean;
  isAutoPunchOut: boolean;
  isOutsideOffice: boolean;
}

interface LeaveLog {
  id: string;
  startDate: Date;
  endDate: Date;
  category: string;
  reason: string | null;
}

interface PublicHolidayLog {
  id: string;
  name: string;
  date: Date;
}

interface AttendanceCalendarProps {
  logs: AttendanceLog[];
  leaves: LeaveLog[];
  holidays?: PublicHolidayLog[];
  joinedDate?: Date;
  currentDate?: Date;
}

export function AttendanceCalendar({ logs, leaves, holidays = [], joinedDate, currentDate = new Date() }: AttendanceCalendarProps) {
  const [selectedDayInfo, setSelectedDayInfo] = useState<{
    date: Date;
    status: "present" | "late" | "halfDay" | "absent" | "leave" | "weekend" | "future" | "holiday" | "disabled";
    log?: AttendanceLog;
    leave?: LeaveLog;
    holiday?: PublicHolidayLog;
  } | null>(null);

  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();



  // Generate calendar days
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Shift index so Monday is index 0
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const days = [];

    // Previous month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month padding to complete the last week row
    const remainingCells = days.length % 7 === 0 ? 0 : 7 - (days.length % 7);
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [month, year]);

  // Match dates and categories
  const daysWithStatus = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return calendarDays.map((day) => {
      const d = new Date(day.date);
      d.setHours(0, 0, 0, 0);

      const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat
      const isWeekend = dayOfWeek === 0; // Saturday is a working day, only Sunday is weekend
      const isFuture = d > today;

      // Check if it's a public holiday
      const matchingHoliday = holidays.find((h) => {
        const holidayDate = new Date(h.date);
        holidayDate.setHours(0, 0, 0, 0);
        return d.getTime() === holidayDate.getTime();
      });

      // Check if covered by an approved leave
      const matchingLeave = leaves.find((leave) => {
        const start = new Date(leave.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(leave.endDate);
        end.setHours(0, 0, 0, 0);
        return d >= start && d <= end;
      });

      // Check if has attendance log
      const matchingLog = logs.find((log) => {
        const logDate = new Date(log.date);
        logDate.setHours(0, 0, 0, 0);
        return d.getTime() === logDate.getTime();
      });

      // Priority 1: Actual attendance
      if (matchingLog) {
        const isHalfDay = matchingLog.isHalfDay;
        const isLate = matchingLog.isLate && !matchingLog.isLateSpecialCase;
        let status: "halfDay" | "late" | "present" = "present";
        if (isHalfDay) {
          status = "halfDay";
        } else if (isLate) {
          status = "late";
        }
        return {
          ...day,
          status,
          log: matchingLog,
          leave: matchingLeave,
          holiday: matchingHoliday,
        };
      }

      // Priority 2: Public Holiday
      if (matchingHoliday) {
        return {
          ...day,
          status: "holiday" as const,
          holiday: matchingHoliday,
          log: undefined,
          leave: undefined,
        };
      }

      // Priority 3: Weekend (Sunday)
      if (isWeekend) {
        return {
          ...day,
          status: "weekend" as const,
          log: undefined,
          leave: undefined,
          holiday: matchingHoliday,
        };
      }

      // Priority 4: Leave
      if (matchingLeave) {
        return {
          ...day,
          status: "leave" as const,
          leave: matchingLeave,
          holiday: matchingHoliday,
          log: undefined,
        };
      }

      // Priority 5: Future
      if (isFuture) {
        return {
          ...day,
          status: "future" as const,
          log: undefined,
          leave: undefined,
          holiday: matchingHoliday,
        };
      }

      // Priority 6: Before Joining Date
      if (joinedDate) {
        const join = new Date(joinedDate);
        join.setHours(0, 0, 0, 0);
        if (d < join) {
          return {
            ...day,
            status: "disabled" as const,
            log: undefined,
            leave: undefined,
            holiday: undefined,
          };
        }
      }

      // Default: Absent (since Saturday is a working day, missed Saturday without leave counts as absent)
      return {
        ...day,
        status: "absent" as const,
        log: undefined,
        leave: undefined,
        holiday: matchingHoliday,
      };
    });
  }, [calendarDays, logs, leaves, holidays, joinedDate]);

  const monthLabel = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const getStatusColor = (status: string, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) {
      return "bg-transparent text-muted-foreground/20 pointer-events-none";
    }
    switch (status) {
      case "present":
        return "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/20";
      case "late":
        return "bg-amber-500/10 border-amber-500/20 text-amber-600 hover:bg-amber-500/20";
      case "halfDay":
        return "bg-purple-500/10 border-purple-500/20 text-purple-600 hover:bg-purple-500/20";
      case "leave":
        return "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 hover:bg-indigo-500/20";
      case "absent":
        return "bg-rose-500/10 border-rose-500/20 text-rose-600 hover:bg-rose-500/20";
      case "holiday":
        return "bg-violet-500/10 border-violet-500/20 text-violet-600 hover:bg-violet-500/20";
      case "weekend":
        return "bg-muted/10 border-border/10 text-muted-foreground/40 hover:bg-muted/20";
      case "disabled":
        return "bg-transparent border-dashed border-border/20 text-muted-foreground/20 cursor-not-allowed";
      default:
        return "bg-transparent border-transparent text-muted-foreground hover:bg-muted/10";
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case "present":
        return <span className="size-1.5 rounded-full bg-emerald-500" />;
      case "late":
        return <span className="size-1.5 rounded-full bg-amber-500" />;
      case "halfDay":
        return <span className="size-1.5 rounded-full bg-purple-500" />;
      case "leave":
        return <span className="size-1.5 rounded-full bg-indigo-500" />;
      case "absent":
        return <span className="size-1.5 rounded-full bg-rose-500" />;
      case "holiday":
        return <span className="size-1.5 rounded-full bg-violet-500" />;
      default:
        return null;
    }
  };

  const formatHours = (inStr: Date | null | string, outStr: Date | null | string) => {
    if (!inStr || !outStr) return "N/A";
    const inDate = new Date(inStr);
    const outDate = new Date(outStr);
    const diffMs = outDate.getTime() - inDate.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    return hours > 0 ? `${hours.toFixed(1)} hrs` : "N/A";
  };

  return (
    <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs flex flex-col h-full animate-fade-in">
      {/* Calendar Header */}
      <div className="px-5 py-4 border-b border-border/70 bg-muted/20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <CalendarDays className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">
              Attendance Calendar
            </h3>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              Interactive shift compliance tracker
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-foreground px-2.5 py-1 rounded-md bg-muted/30 border border-border/70">
          {monthLabel}
        </span>
      </div>

      {/* Main Grid View */}
      <div className="p-4 grid grid-cols-7 gap-1.5 flex-1">
        {/* Days of Week */}
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
          <div
            key={day}
            className={cn(
              "text-[10px] font-black uppercase text-center py-1.5 tracking-widest",
              day === "Su" ? "text-rose-500" : "text-muted-foreground"
            )}
          >
            {day}
          </div>
        ))}

        {/* Days cells */}
        {daysWithStatus.map((day, idx) => {
          const isSelected = selectedDayInfo && selectedDayInfo.date.toDateString() === day.date.toDateString();
          return (
            <button
              key={idx}
              onClick={() => {
                if (day.isCurrentMonth) {
                  setSelectedDayInfo({
                    date: day.date,
                    status: day.status,
                    log: day.log,
                    leave: day.leave,
                  });
                }
              }}
              disabled={!day.isCurrentMonth}
              className={cn(
                "aspect-square rounded-md border flex flex-col items-center justify-between p-1.5 text-xs font-bold transition-all relative overflow-hidden cursor-pointer",
                getStatusColor(day.status, day.isCurrentMonth),
                isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-card shadow-xs"
              )}
            >
              <span className={cn(
                "self-start text-[10px] leading-none flex items-center justify-between w-full",
                (day.date.getDay() === 0 || day.holiday) && day.isCurrentMonth && "text-rose-500 font-black"
              )}>
                <span>{day.date.getDate()}</span>
                {day.status === "halfDay" && (
                  <span className="text-[7px] font-black text-purple-600 dark:text-purple-400 bg-purple-500/15 border border-purple-500/30 px-1 py-0.5 rounded-md leading-none">
                    HL
                  </span>
                )}
              </span>
              <div className="absolute bottom-1.5 flex items-center justify-center gap-0.5">
                {getStatusDot(day.status)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Info Detail Sidebar / Footer */}
      <div className="border-t border-border/70 p-4 bg-muted/10 min-h-35 flex flex-col justify-center">
        {selectedDayInfo ? (
          <div className="space-y-3 animate-scale-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                {selectedDayInfo.date.toLocaleDateString("en-US", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <div className="flex items-center gap-2">
                {selectedDayInfo.status === "present" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <CheckCircle2 className="size-2.5" /> Present
                  </span>
                )}
                {selectedDayInfo.status === "late" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20">
                    <AlertTriangle className="size-2.5" /> Late Entry
                  </span>
                )}
                {selectedDayInfo.status === "halfDay" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 border border-purple-500/20">
                    <AlertTriangle className="size-2.5" /> Half Day (Late Entry)
                  </span>
                )}
                {selectedDayInfo.status === "leave" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                    <Plane className="size-2.5" /> On Leave
                  </span>
                )}
                {selectedDayInfo.status === "absent" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 border border-rose-500/20">
                    <XCircle className="size-2.5" /> Absent / Unpunched
                  </span>
                )}
                {selectedDayInfo.status === "weekend" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-muted text-muted-foreground/60 border border-border">
                    Weekend
                  </span>
                )}
                {selectedDayInfo.status === "holiday" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-violet-500/10 text-violet-600 border border-violet-500/20">
                    <Sparkles className="size-2.5" /> Public Holiday
                  </span>
                )}
              </div>
            </div>

            {selectedDayInfo.holiday && (
              <div className="bg-violet-500/5 border border-violet-500/10 rounded-sm p-3 space-y-1 animate-fade-in">
                <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest flex items-center gap-1">
                  <Sparkles className="size-3 text-violet-500 animate-pulse" /> Public Holiday 🎉
                </p>
                <p className="text-xs font-bold text-foreground">
                  {selectedDayInfo.holiday.name}
                </p>
              </div>
            )}

            {selectedDayInfo.status === "leave" && selectedDayInfo.leave && (
              <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-sm p-3 space-y-1">
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                  Leave Details ({selectedDayInfo.leave.category})
                </p>
                <p className="text-xs font-bold text-foreground">
                  Reason: {selectedDayInfo.leave.reason || "No reason specified"}
                </p>
              </div>
            )}

            {(selectedDayInfo.status === "present" || selectedDayInfo.status === "late" || selectedDayInfo.status === "halfDay") && selectedDayInfo.log && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/10 border border-border/40 rounded-sm p-2 flex flex-col">
                  <span className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-widest mb-0.5">
                    Punch In
                  </span>
                  <span className="text-xs font-bold text-foreground flex items-center gap-1">
                    <Clock className="size-3 text-muted-foreground/60" />
                    {selectedDayInfo.log.punchIn
                      ? new Date(selectedDayInfo.log.punchIn).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })
                      : "—"}
                  </span>
                </div>
                <div className="bg-muted/10 border border-border/40 rounded-sm p-2 flex flex-col">
                  <span className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-widest mb-0.5">
                    Punch Out
                  </span>
                  <span className="text-xs font-bold text-foreground flex items-center gap-1">
                    <Clock className="size-3 text-muted-foreground/60" />
                    {selectedDayInfo.log.punchOut
                      ? new Date(selectedDayInfo.log.punchOut).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })
                      : "—"}
                  </span>
                </div>
                <div className="col-span-2 bg-primary/3 border border-primary/5 rounded-sm p-2 flex justify-between items-center">
                  <span className="text-[9px] font-black text-primary/70 uppercase tracking-widest">
                    Active Duration
                  </span>
                  <span className="text-xs font-extrabold text-foreground">
                    {formatHours(selectedDayInfo.log.punchIn, selectedDayInfo.log.punchOut)}
                  </span>
                </div>
              </div>
            )}

            {selectedDayInfo.status === "absent" && (
              <p className="text-xs font-medium text-muted-foreground italic">
                No attendance punch found for this day. If you forgot to punch in, please drop a regularisation request to your manager.
              </p>
            )}

            {selectedDayInfo.status === "weekend" && (
              <p className="text-xs font-medium text-muted-foreground italic">
                Rest day. No punch required. Enjoy your weekend!
              </p>
            )}

            {selectedDayInfo.status === "holiday" && (
              <p className="text-xs font-medium text-muted-foreground italic">
                Official company-wide holiday. No attendance punch is required. Have a wonderful break!
              </p>
            )}

            {selectedDayInfo.status === "disabled" && (
              <p className="text-xs font-medium text-muted-foreground italic">
                Date prior to your joining. No attendance records available.
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-4 flex flex-col items-center gap-2 opacity-35">
            <CalendarDays className="size-8 text-muted-foreground" />
            <p className="text-[10px] font-black uppercase tracking-widest">
              Select any current month day above for detailed logs
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
