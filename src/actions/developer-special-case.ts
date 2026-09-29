"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { format } from "date-fns";

export async function getSpecialCaseUsers() {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SYSTEM_ADMIN") {
      return { success: false, error: "Unauthorized: Developer access required." };
    }

    const users = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        NOT: {
          roleDefinition: {
            code: "SYSTEM_ADMIN"
          }
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeCode: true,
        designation: true,
        avatarUrl: true,
        gender: true,
        department: { select: { id: true, name: true } },
        location: { select: { id: true, name: true, startTime: true, endTime: true, graceTimeMinutes: true } }
      },
      orderBy: { name: "asc" }
    });

    return { success: true, users };
  } catch (error: any) {
    console.error("getSpecialCaseUsers error:", error);
    return { success: false, error: error.message };
  }
}

export async function getUserAttendanceForSpecialCase(
  userId: string,
  startDateStr: string,
  endDateStr: string
) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SYSTEM_ADMIN") {
      return { success: false, error: "Unauthorized: Developer access required." };
    }

    const startObj = new Date(startDateStr);
    const endObj = new Date(endDateStr);

    const start = new Date(Date.UTC(startObj.getUTCFullYear(), startObj.getUTCMonth(), startObj.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(Date.UTC(endObj.getUTCFullYear(), endObj.getUTCMonth(), endObj.getUTCDate(), 23, 59, 59, 999));

    // Fetch user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        employeeCode: true,
        designation: true,
        avatarUrl: true,
        gender: true,
        department: { select: { name: true } },
        location: { select: { name: true, startTime: true, endTime: true, graceTimeMinutes: true } }
      }
    });

    if (!user) {
      return { success: false, error: "User not found." };
    }

    // Fetch attendance records in date range
    const attendances = await prisma.attendance.findMany({
      where: {
        userId,
        date: { gte: start, lte: end }
      },
      orderBy: { date: "asc" }
    });

    // Fetch approved leaves in date range
    const leaves = await prisma.leaveRequest.findMany({
      where: {
        userId,
        status: "APPROVED",
        OR: [
          { startDate: { gte: start, lte: end } },
          { endDate: { gte: start, lte: end } },
          { startDate: { lte: start }, endDate: { gte: end } }
        ]
      }
    });

    // Build day-by-day mapping
    const attendanceByDate: Record<string, any> = {};
    attendances.forEach(att => {
      const dStr = format(new Date(att.date), "yyyy-MM-dd");
      attendanceByDate[dStr] = att;
    });

    const leaveByDate: Record<string, any> = {};
    leaves.forEach(l => {
      let cur = new Date(l.startDate);
      const lEnd = new Date(l.endDate);
      while (cur <= lEnd) {
        const dStr = format(cur, "yyyy-MM-dd");
        leaveByDate[dStr] = l;
        cur.setDate(cur.getDate() + 1);
      }
    });

    const daysList: any[] = [];
    let curDate = new Date(start);

    while (curDate <= end) {
      const dStr = format(curDate, "yyyy-MM-dd");
      const att = attendanceByDate[dStr] || null;
      const leave = leaveByDate[dStr] || null;
      const isSunday = curDate.getDay() === 0;

      let totalHours = 0;
      if (att?.punchIn && att?.punchOut) {
        const diffMs = new Date(att.punchOut).getTime() - new Date(att.punchIn).getTime();
        totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
      }

      daysList.push({
        dateStr: dStr,
        date: new Date(curDate),
        dayName: format(curDate, "EEEE"),
        shortDay: format(curDate, "EEE"),
        isSunday,
        attendance: att
          ? {
              id: att.id,
              punchIn: att.punchIn,
              punchOut: att.punchOut,
              isLate: att.isLate,
              isLateSpecialCase: att.isLateSpecialCase,
              isHalfDay: att.isHalfDay,
              isEarlyLogoff: att.isEarlyLogoff,
              isOutsideOffice: att.isOutsideOffice,
              totalHours
            }
          : null,
        leave: leave
          ? {
              id: leave.id,
              duration: leave.duration,
              category: leave.category,
              leaveType: leave.leaveType,
              halfDayType: leave.halfDayType,
              startTime: leave.startTime,
              endTime: leave.endTime
            }
          : null
      });

      curDate.setDate(curDate.getDate() + 1);
    }

    // Compute stats
    const totalDays = daysList.filter(d => !d.isSunday).length;
    const presentRecords = daysList.filter(d => d.attendance?.punchIn);
    const presentCount = presentRecords.length;
    const unwaivedLateCount = presentRecords.filter(d => d.attendance?.isLate && !d.attendance?.isLateSpecialCase).length;
    const waivedSpecialCaseCount = presentRecords.filter(d => d.attendance?.isLateSpecialCase).length;
    const totalLateMarks = presentRecords.filter(d => d.attendance?.isLate).length;
    const totalHoursWorked = presentRecords.reduce((acc, d) => acc + (d.attendance?.totalHours || 0), 0);

    return {
      success: true,
      user,
      days: daysList,
      stats: {
        totalDays,
        presentCount,
        unwaivedLateCount,
        waivedSpecialCaseCount,
        totalLateMarks,
        totalHoursWorked: parseFloat(totalHoursWorked.toFixed(1))
      }
    };
  } catch (error: any) {
    console.error("getUserAttendanceForSpecialCase error:", error);
    return { success: false, error: error.message };
  }
}

export async function toggleSpecialCaseDay(attendanceId: string, isLateSpecialCase: boolean) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SYSTEM_ADMIN") {
      return { success: false, error: "Unauthorized: Developer access required." };
    }

    const updated = await prisma.attendance.update({
      where: { id: attendanceId },
      data: { isLateSpecialCase }
    });

    revalidatePath("/dashboard/admin/developer/special-case");
    revalidatePath("/dashboard/accountant");
    revalidatePath("/dashboard/employee/attendance");

    return { success: true, updated };
  } catch (error: any) {
    console.error("toggleSpecialCaseDay error:", error);
    return { success: false, error: error.message };
  }
}

export async function batchUpdateSpecialCase(
  userId: string,
  startDateStr: string,
  endDateStr: string,
  mode: "WAIVE_LATE_ONLY" | "ALL_DAYS" | "CLEAR"
) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SYSTEM_ADMIN") {
      return { success: false, error: "Unauthorized: Developer access required." };
    }

    const startObj = new Date(startDateStr);
    const endObj = new Date(endDateStr);

    const start = new Date(Date.UTC(startObj.getUTCFullYear(), startObj.getUTCMonth(), startObj.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(Date.UTC(endObj.getUTCFullYear(), endObj.getUTCMonth(), endObj.getUTCDate(), 23, 59, 59, 999));

    let whereClause: any = {
      userId,
      date: { gte: start, lte: end }
    };

    let newFlag = true;

    if (mode === "WAIVE_LATE_ONLY") {
      whereClause.isLate = true;
      newFlag = true;
    } else if (mode === "ALL_DAYS") {
      newFlag = true;
    } else if (mode === "CLEAR") {
      newFlag = false;
    }

    const result = await prisma.attendance.updateMany({
      where: whereClause,
      data: {
        isLateSpecialCase: newFlag
      }
    });

    revalidatePath("/dashboard/admin/developer/special-case");
    revalidatePath("/dashboard/accountant");
    revalidatePath("/dashboard/employee/attendance");

    return { success: true, updatedCount: result.count };
  } catch (error: any) {
    console.error("batchUpdateSpecialCase error:", error);
    return { success: false, error: error.message };
  }
}
