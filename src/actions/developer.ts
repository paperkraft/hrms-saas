"use server"

import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function getAttendancesForAdjustment(date: Date | string) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "SYSTEM_ADMIN") return { success: false, error: "Unauthorized" }

    // Normalize date to UTC midnight for @db.Date comparison
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const y = dateObj.getUTCFullYear();
    const m = dateObj.getUTCMonth();
    const d = dateObj.getUTCDate();
    const targetDate = new Date(Date.UTC(y, m, d));

    const attendances = await prisma.attendance.findMany({
      where: {
        date: targetDate
      },
      include: {
        user: { 
          select: { 
            id: true,
            name: true, 
            email: true,
            employeeCode: true,
            designation: true,
            avatarUrl: true,
            department: { select: { id: true, name: true } },
            location: { select: { id: true, name: true, lat: true, lng: true } }
          } 
        }
      },
      orderBy: { punchIn: 'desc' }
    });

    return { success: true, attendances }
  } catch (error: any) {
    console.error("Get Attendances Error:", error);
    return { success: false, error: error.message }
  }
}

export async function getUsersForAdjustment() {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "SYSTEM_ADMIN") return { success: false, error: "Unauthorized" }

    const users = await prisma.user.findMany({
      where: {
        role: { not: 'SYSTEM_ADMIN' },
        status: 'ACTIVE',
        NOT: {
          roleDefinition: {
            code: 'SYSTEM_ADMIN'
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
        department: { select: { name: true } },
        location: { select: { name: true, lat: true, lng: true } }
      },
      orderBy: { name: 'asc' }
    });

    return { success: true, users }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function createAttendanceAction(data: {
  userId: string;
  date: Date | string;
  punchIn: Date;
  punchOut?: Date | null;
  isLate?: boolean;
  isLateSpecialCase?: boolean;
  isHalfDay?: boolean;
  isOutsideOffice?: boolean;
  isAutoPunchOut?: boolean;
}) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "SYSTEM_ADMIN") return { success: false, error: "Unauthorized" }

    // Normalize date to UTC midnight
    const dateObj = typeof data.date === 'string' ? new Date(data.date) : data.date;
    const targetDate = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate()));

    // Check if record already exists
    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId: data.userId, date: targetDate } }
    });

    if (existing) {
      return { success: false, error: "An attendance record already exists for this user on this date." };
    }

    await prisma.attendance.create({
      data: {
        userId: data.userId,
        date: targetDate,
        punchIn: data.punchIn,
        punchOut: data.punchOut || null,
        isLate: data.isLate || false,
        isLateSpecialCase: data.isLateSpecialCase || false,
        isHalfDay: data.isHalfDay || false,
        isOutsideOffice: data.isOutsideOffice || false,
        isAutoPunchOut: data.isAutoPunchOut || false
      }
    });

    revalidatePath("/dashboard/admin/developer/attendance", "page")
    return { success: true }
  } catch (error: any) {
    console.error("Create Attendance Error:", error);
    return { success: false, error: error.message }
  }
}

export async function adjustAttendanceAction(id: string, data: {
  punchIn?: Date | null;
  punchOut?: Date | null;
  isLate?: boolean;
  isLateSpecialCase?: boolean;
  isHalfDay?: boolean;
  punchInLat?: number | null;
  punchInLng?: number | null;
  punchOutLat?: number | null;
  punchOutLng?: number | null;
  isOutsideOffice?: boolean;
  isAutoPunchOut?: boolean;
}) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "SYSTEM_ADMIN") return { success: false, error: "Unauthorized" }

    const updateData: any = {};
    if (data.punchIn !== undefined) updateData.punchIn = data.punchIn;
    if (data.punchOut !== undefined) updateData.punchOut = data.punchOut;
    if (data.isLate !== undefined) updateData.isLate = data.isLate;
    if (data.isLateSpecialCase !== undefined) updateData.isLateSpecialCase = data.isLateSpecialCase;
    if (data.isHalfDay !== undefined) updateData.isHalfDay = data.isHalfDay;
    if (data.punchInLat !== undefined) updateData.punchInLat = data.punchInLat;
    if (data.punchInLng !== undefined) updateData.punchInLng = data.punchInLng;
    if (data.punchOutLat !== undefined) updateData.punchOutLat = data.punchOutLat;
    if (data.punchOutLng !== undefined) updateData.punchOutLng = data.punchOutLng;
    if (data.isOutsideOffice !== undefined) updateData.isOutsideOffice = data.isOutsideOffice;
    if (data.isAutoPunchOut !== undefined) updateData.isAutoPunchOut = data.isAutoPunchOut;

    await prisma.attendance.update({
      where: { id },
      data: updateData
    });

    revalidatePath("/dashboard/admin/developer/attendance", "page")
    return { success: true }
  } catch (error: any) {
    console.error("Adjust Attendance Error:", error);
    return { success: false, error: error.message }
  }
}

export async function deleteAttendanceAction(id: string) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "SYSTEM_ADMIN") return { success: false, error: "Unauthorized" }

    await prisma.attendance.delete({
      where: { id }
    });

    revalidatePath("/dashboard/admin/developer/attendance", "page")
    return { success: true }
  } catch (error: any) {
    console.error("Delete Attendance Error:", error);
    return { success: false, error: error.message }
  }
}
