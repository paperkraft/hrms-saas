"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { format, differenceInMinutes, addDays, getDay } from "date-fns";
import { calculateAttendanceStatusFlags } from "@/actions/attendance/sync";

export interface BackfillEmployee {
  id: string;
  name: string | null;
  email: string | null;
  employeeCode: string | null;
  designation: string | null;
  avatarUrl: string | null;
  createdAt: Date | string | null;
  department: { id: string; name: string } | null;
  location: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    graceTimeMinutes: number;
  } | null;
}

export interface PreviewDayItem {
  dateStr: string;
  date: Date;
  dayName: string;
  shortDay: string;
  isSunday: boolean;
  isSaturday: boolean;
  isFuture: boolean;
  isHoliday: boolean;
  holidayName?: string | null;
  status: "MISSING" | "EXISTS" | "ON_LEAVE" | "SUNDAY" | "HOLIDAY" | "FUTURE";
  selected: boolean;
  proposedPunchIn: string; // "09:30" or "09:27"
  proposedPunchOut: string; // "18:00" or "18:05"
  existingAttendance: {
    id: string;
    punchIn: string | Date;
    punchOut: string | Date | null;
    isLate: boolean;
    isLateSpecialCase: boolean;
    isHalfDay: boolean;
    totalHours: number;
  } | null;
  approvedLeave: {
    id: string;
    duration: string;
    category: string;
    leaveType: string | null;
    halfDayType: string | null;
    startTime: string | null;
    endTime: string | null;
  } | null;
}

export interface PreviewOptions {
  customPunchIn?: string; // "HH:mm"
  customPunchOut?: string; // "HH:mm"
  addJitter?: boolean;
  jitterMinutes?: number; // default: 5
  skipSundays?: boolean;
  skipHolidays?: boolean;
  skipLeaves?: boolean;
  isSpecialCase?: boolean;
}

/**
 * Fetch all active non-admin users for backfill attendance selection
 */
export async function getBackfillEmployees() {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SYSTEM_ADMIN") {
      return { success: false, error: "Unauthorized: Developer access required." };
    }

    const users = await prisma.user.findMany({
      where: {
        role: { not: "SYSTEM_ADMIN" },
        status: "ACTIVE",
        NOT: {
          roleDefinition: {
            code: "SYSTEM_ADMIN",
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeCode: true,
        designation: true,
        avatarUrl: true,
        createdAt: true,
        department: { select: { id: true, name: true } },
        location: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
            graceTimeMinutes: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return { success: true, users };
  } catch (error: any) {
    console.error("getBackfillEmployees error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Generates an interactive preview schedule for the specified user and date range
 */
export async function previewBackfillSchedule(
  userId: string,
  startDateStr: string,
  endDateStr: string,
  options: PreviewOptions = {}
) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SYSTEM_ADMIN") {
      return { success: false, error: "Unauthorized: Developer access required." };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { location: true, department: true },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const globalConfig = await prisma.systemConfig.findUnique({
      where: { id: "GLOBAL_CONFIG" },
    });

    const defaultInStr = options.customPunchIn || user.location?.startTime || globalConfig?.defaultOfficeStartTime || "09:30";
    const defaultOutStr = options.customPunchOut || user.location?.endTime || globalConfig?.defaultOfficeEndTime || "18:00";

    const [inHour, inMin] = defaultInStr.split(":").map(Number);
    const [outHour, outMin] = defaultOutStr.split(":").map(Number);

    const startObj = new Date(startDateStr);
    const endObj = new Date(endDateStr);

    const utcStart = new Date(Date.UTC(startObj.getFullYear(), startObj.getMonth(), startObj.getDate(), 0, 0, 0));
    const utcEnd = new Date(Date.UTC(endObj.getFullYear(), endObj.getMonth(), endObj.getDate(), 23, 59, 59, 999));

    // Fetch existing attendances
    const existingAttendances = await prisma.attendance.findMany({
      where: {
        userId,
        date: { gte: utcStart, lte: utcEnd },
      },
      orderBy: { date: "asc" },
    });

    // Fetch approved leaves
    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        userId,
        status: "APPROVED",
        startDate: { lte: utcEnd },
        endDate: { gte: utcStart },
      },
    });

    // Fetch public holidays
    const publicHolidays = await prisma.publicHoliday.findMany({
      where: {
        date: { gte: utcStart, lte: utcEnd },
      },
    });

    const attendancesMap = new Map<string, any>();
    for (const att of existingAttendances) {
      const key = format(new Date(att.date), "yyyy-MM-dd");
      attendancesMap.set(key, att);
    }

    const days: PreviewDayItem[] = [];
    let cur = new Date(startObj);

    // Deterministic pseudo-random seed helper for natural jitter
    const getJitterMins = (dateStr: string, maxJitter: number) => {
      let hash = 0;
      for (let i = 0; i < dateStr.length; i++) {
        hash = (hash << 5) - hash + dateStr.charCodeAt(i);
        hash |= 0;
      }
      // Range: -maxJitter to +maxJitter (e.g. -4 to +3)
      const mod = (Math.abs(hash) % (maxJitter * 2 + 1)) - maxJitter;
      return mod;
    };

    while (cur <= endObj) {
      const dateStr = format(cur, "yyyy-MM-dd");
      const dayOfWeek = getDay(cur);
      const isSunday = dayOfWeek === 0;
      const isSaturday = dayOfWeek === 6;

      const dayName = format(cur, "EEEE");
      const shortDay = format(cur, "EEE").toUpperCase();

      const existing = attendancesMap.get(dateStr) || null;

      // Check for approved leave
      const curStart = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 0, 0, 0);
      const curEnd = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 23, 59, 59);

      const leaveMatch = approvedLeaves.find((l) => {
        const lStart = new Date(l.startDate);
        const lEnd = new Date(l.endDate);
        return lStart <= curEnd && lEnd >= curStart;
      }) || null;

      // Check for public holiday
      const holidayMatch = publicHolidays.find((h) => {
        const hDateStr = format(new Date(h.date), "yyyy-MM-dd");
        return hDateStr === dateStr;
      }) || null;

      const isHoliday = !!holidayMatch;
      const holidayName = holidayMatch ? holidayMatch.name : null;

      // Compute proposed punch in / out
      let pInH = inHour;
      let pInM = inMin;
      let pOutH = outHour;
      let pOutM = outMin;

      if (options.addJitter) {
        const maxJ = options.jitterMinutes || 5;
        const jIn = getJitterMins(dateStr + "_in", maxJ);
        const jOut = getJitterMins(dateStr + "_out", maxJ);

        pInM += jIn;
        if (pInM < 0) {
          pInH -= 1;
          pInM += 60;
        } else if (pInM >= 60) {
          pInH += 1;
          pInM -= 60;
        }

        pOutM += jOut;
        if (pOutM < 0) {
          pOutH -= 1;
          pOutM += 60;
        } else if (pOutM >= 60) {
          pOutH += 1;
          pOutM -= 60;
        }
      }

      const proposedPunchInStr = `${String(pInH).padStart(2, "0")}:${String(pInM).padStart(2, "0")}`;
      const proposedPunchOutStr = `${String(pOutH).padStart(2, "0")}:${String(pOutM).padStart(2, "0")}`;

      // Determine Status & Default Selection
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const isFuture = dateStr > todayStr;
      let status: "MISSING" | "EXISTS" | "ON_LEAVE" | "SUNDAY" | "HOLIDAY" | "FUTURE" = "MISSING";
      let shouldSelect = true;

      if (isFuture) {
        status = "FUTURE";
        shouldSelect = false;
      } else if (existing && existing.punchIn) {
        status = "EXISTS";
        shouldSelect = false;
      } else if (isHoliday) {
        status = "HOLIDAY";
        if (options.skipHolidays !== false) shouldSelect = false;
      } else if (isSunday) {
        status = "SUNDAY";
        if (options.skipSundays !== false) shouldSelect = false;
      } else if (leaveMatch && leaveMatch.duration === "FULL") {
        status = "ON_LEAVE";
        if (options.skipLeaves !== false) shouldSelect = false;
      }

      let formattedExisting = null;
      if (existing) {
        let totalHours = 0;
        if (existing.punchIn && existing.punchOut) {
          const diff = differenceInMinutes(new Date(existing.punchOut), new Date(existing.punchIn));
          totalHours = Math.round((diff / 60) * 10) / 10;
        }
        formattedExisting = {
          id: existing.id,
          punchIn: existing.punchIn,
          punchOut: existing.punchOut,
          isLate: existing.isLate || false,
          isLateSpecialCase: existing.isLateSpecialCase || false,
          isHalfDay: existing.isHalfDay || false,
          totalHours,
        };
      }

      let formattedLeave = null;
      if (leaveMatch) {
        formattedLeave = {
          id: leaveMatch.id,
          duration: leaveMatch.duration,
          category: leaveMatch.category,
          leaveType: leaveMatch.leaveType,
          halfDayType: leaveMatch.halfDayType,
          startTime: leaveMatch.startTime,
          endTime: leaveMatch.endTime,
        };
      }

      days.push({
        dateStr,
        date: new Date(cur),
        dayName,
        shortDay,
        isSunday,
        isSaturday,
        isFuture,
        isHoliday,
        holidayName,
        status,
        selected: shouldSelect,
        proposedPunchIn: proposedPunchInStr,
        proposedPunchOut: proposedPunchOutStr,
        existingAttendance: formattedExisting,
        approvedLeave: formattedLeave,
      });

      cur = addDays(cur, 1);
    }

    const totalDays = days.length;
    const missingDaysCount = days.filter((d) => d.status === "MISSING" && !d.isFuture).length;
    const existingDaysCount = days.filter((d) => d.status === "EXISTS").length;
    const sundayDaysCount = days.filter((d) => d.status === "SUNDAY" && !d.isFuture).length;
    const holidayDaysCount = days.filter((d) => d.status === "HOLIDAY" && !d.isFuture).length;
    const leaveDaysCount = days.filter((d) => d.status === "ON_LEAVE" && !d.isFuture).length;
    const futureDaysCount = days.filter((d) => d.isFuture).length;

    return {
      success: true,
      user,
      days,
      stats: {
        totalDays,
        missingDaysCount,
        existingDaysCount,
        sundayDaysCount,
        holidayDaysCount,
        leaveDaysCount,
        futureDaysCount,
      },
    };
  } catch (error: any) {
    console.error("previewBackfillSchedule error:", error);
    return { success: false, error: error.message };
  }
}

export interface BackfillEntryInput {
  dateStr: string;
  punchInStr: string; // "09:30"
  punchOutStr: string; // "18:00"
  isLateSpecialCase?: boolean;
}

/**
 * Executes the backfill creation for selected days in the database
 */
export async function executeBackfillAttendance(
  userId: string,
  entries: BackfillEntryInput[],
  options: { overwriteExisting?: boolean; markAsSpecialCase?: boolean } = {}
) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SYSTEM_ADMIN") {
      return { success: false, error: "Unauthorized: Developer access required." };
    }

    if (!entries || entries.length === 0) {
      return { success: false, error: "No days selected for backfill." };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { location: true },
    });

    if (!user) {
      return { success: false, error: "User not found." };
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const entry of entries) {
      const [year, month, day] = entry.dateStr.split("-").map(Number);
      const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

      const [inH, inM] = entry.punchInStr.split(":").map(Number);
      const punchInDate = new Date(year, month - 1, day, inH, inM, 0, 0);

      let punchOutDate: Date | null = null;
      if (entry.punchOutStr) {
        const [outH, outM] = entry.punchOutStr.split(":").map(Number);
        punchOutDate = new Date(year, month - 1, day, outH, outM, 0, 0);
      }

      // Calculate accurate status flags against location shift and leaves
      const flags = await calculateAttendanceStatusFlags(
        userId,
        targetDate,
        punchInDate,
        punchOutDate,
        false
      );

      const finalIsSpecialCase =
        options.markAsSpecialCase ||
        entry.isLateSpecialCase ||
        flags.isLateSpecialCase ||
        false;

      const existing = await prisma.attendance.findUnique({
        where: {
          userId_date: {
            userId,
            date: targetDate,
          },
        },
      });

      if (existing) {
        if (options.overwriteExisting) {
          await prisma.attendance.update({
            where: { id: existing.id },
            data: {
              punchIn: punchInDate,
              punchOut: punchOutDate,
              isLate: flags.isLate,
              isLateSpecialCase: finalIsSpecialCase,
              isHalfDay: flags.isHalfDay,
              isEarlyLogoff: flags.isEarlyLogoff,
            },
          });
          updatedCount++;
        }
      } else {
        await prisma.attendance.create({
          data: {
            userId,
            date: targetDate,
            punchIn: punchInDate,
            punchOut: punchOutDate,
            isLate: flags.isLate,
            isLateSpecialCase: finalIsSpecialCase,
            isHalfDay: flags.isHalfDay,
            isEarlyLogoff: flags.isEarlyLogoff,
            isOutsideOffice: false,
            isAutoPunchOut: false,
          },
        });
        createdCount++;
      }
    }

    revalidatePath("/dashboard/admin/developer/attendance", "page");
    revalidatePath("/dashboard/admin/developer/special-case", "page");
    revalidatePath("/dashboard/accountant/attendance", "page");
    revalidatePath("/dashboard/attendance", "page");

    return {
      success: true,
      createdCount,
      updatedCount,
      message: `Successfully created ${createdCount} and updated ${updatedCount} attendance records.`,
    };
  } catch (error: any) {
    console.error("executeBackfillAttendance error:", error);
    return { success: false, error: error.message };
  }
}
