"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { GrievanceType, LeaveStatus } from "@prisma/client";
import { createNotification } from "@/actions/notification";

export async function submitGrievance(data: {
  date: Date;
  grievanceType: GrievanceType;
  requestedTime: string;
  requestedOutTime?: string;
  reason: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" };
    }

    const { date, grievanceType, requestedTime, requestedOutTime, reason } = data;

    // Restrict to 7 days in the past
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const checkDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

    if (checkDate < sevenDaysAgo) {
      return { success: false, message: "You can only submit grievances for dates within the last 7 days." };
    }

    const grievance = await prisma.attendanceGrievance.create({
      data: {
        userId: session.user.id,
        date: checkDate,
        grievanceType,
        requestedTime,
        requestedOutTime,
        reason,
        status: LeaveStatus.PENDING,
      },
    });

    // Notify Manager
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, managerId: true } });
    const notifyUserIds = new Set<string>();

    if (user?.managerId) {
      notifyUserIds.add(user.managerId);
    }

    // Notify Admins and Accountants
    const privilegedUsers = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'ACCOUNTANT'] } },
      select: { id: true }
    });

    for (const pUser of privilegedUsers) {
      notifyUserIds.add(pUser.id);
    }

    // Send notifications
    for (const targetUserId of Array.from(notifyUserIds)) {
      await createNotification({
        userId: targetUserId,
        title: "New Attendance Grievance",
        content: `${user?.name || "An employee"} submitted an attendance grievance for ${checkDate.toLocaleDateString()}`,
        type: "INFO",
        link: "/dashboard/accountant?tab=grievances"
      });
    }

    revalidatePath("/dashboard/employee");
    return { success: true, message: "Grievance submitted successfully", data: grievance };
  } catch (error: any) {
    console.error("Error submitting grievance:", error);
    return { success: false, message: error.message || "Failed to submit grievance" };
  }
}

export async function getEmployeeGrievances() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized", data: [] };
    }

    const grievances = await prisma.attendanceGrievance.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: grievances };
  } catch (error: any) {
    return { success: false, message: "Failed to fetch grievances", data: [] };
  }
}

export async function getPendingGrievances(managerId?: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized", data: [] };
    }

    let whereClause: any = { status: LeaveStatus.PENDING };

    if (managerId) {
      whereClause.user = { managerId };
    }

    const grievances = await prisma.attendanceGrievance.findMany({
      where: whereClause,
      include: { user: { select: { name: true, email: true, employeeCode: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: grievances };
  } catch (error: any) {
    return { success: false, message: "Failed to fetch grievances", data: [] };
  }
}

import { calculateAttendanceStatusFlags } from "@/actions/attendance/sync";
export { calculateAttendanceStatusFlags };

export async function approveGrievance(id: string, requestedTime: string, managerNote?: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" };
    }

    const grievance = await prisma.attendanceGrievance.findUnique({ where: { id } });
    if (!grievance) return { success: false, message: "Grievance not found" };

    const [hours, minutes] = requestedTime.split(':').map(Number);

    // The date from DB is midnight UTC for that date.
    const targetDate = new Date(
      grievance.date.getUTCFullYear(),
      grievance.date.getUTCMonth(),
      grievance.date.getUTCDate(),
      hours,
      minutes,
      0,
      0
    );

    let targetOutDate: Date | undefined;
    if (grievance.grievanceType === 'FORGOT_BOTH' && grievance.requestedOutTime) {
      const [outHours, outMinutes] = grievance.requestedOutTime.split(':').map(Number);
      targetOutDate = new Date(
        grievance.date.getUTCFullYear(),
        grievance.date.getUTCMonth(),
        grievance.date.getUTCDate(),
        outHours,
        outMinutes,
        0,
        0
      );
    }

    // 1. Mark as Approved
    await prisma.attendanceGrievance.update({
      where: { id },
      data: { status: LeaveStatus.APPROVED, managerNote },
    });

    // 2. Fix the Attendance Record
    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId: grievance.userId,
          date: grievance.date,
        }
      }
    });

    let finalPunchIn: Date | null = null;
    let finalPunchOut: Date | null = null;
    const isOutsideOffice = existingAttendance?.isOutsideOffice || false;

    if (grievance.grievanceType === 'FORGOT_PUNCH_IN') {
      finalPunchIn = targetDate;
      finalPunchOut = existingAttendance?.punchOut || null;
    } else if (grievance.grievanceType === 'FORGOT_PUNCH_OUT') {
      finalPunchIn = existingAttendance?.punchIn || targetDate;
      finalPunchOut = targetDate;
    } else if (grievance.grievanceType === 'FORGOT_BOTH') {
      finalPunchIn = targetDate;
      finalPunchOut = targetOutDate || null;
    } else {
      // OTHER
      finalPunchIn = targetDate;
      finalPunchOut = targetOutDate || existingAttendance?.punchOut || null;
    }

    const { isLate, isLateSpecialCase, isEarlyLogoff, isHalfDay } = await calculateAttendanceStatusFlags(
      grievance.userId,
      grievance.date,
      finalPunchIn,
      finalPunchOut,
      isOutsideOffice
    );

    if (existingAttendance) {
      await prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          punchIn: finalPunchIn || existingAttendance.punchIn,
          punchOut: finalPunchOut,
          isLate,
          isLateSpecialCase,
          isEarlyLogoff,
          isHalfDay,
          isAutoPunchOut: false
        }
      });
    } else {
      await prisma.attendance.create({
        data: {
          userId: grievance.userId,
          date: grievance.date,
          punchIn: finalPunchIn || targetDate,
          punchOut: finalPunchOut,
          isLate,
          isLateSpecialCase,
          isEarlyLogoff,
          isHalfDay,
          isOutsideOffice: false,
          isAutoPunchOut: false
        }
      });
    }

    // Notify employee
    await createNotification({
      userId: grievance.userId,
      title: "Grievance Approved",
      content: `Your attendance grievance for ${grievance.date.toLocaleDateString()} has been approved.`,
      type: "SUCCESS",
      link: "/dashboard/employee/attendance"
    });

    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/accountant");
    return { success: true, message: "Grievance approved and attendance corrected." };

  } catch (error: any) {
    console.error(error);
    return { success: false, message: error.message || "Failed to approve grievance" };
  }
}

export async function rejectGrievance(id: string, managerNote: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" };
    }

    const grievance = await prisma.attendanceGrievance.update({
      where: { id },
      data: { status: LeaveStatus.REJECTED, managerNote },
    });

    // Notify employee
    await createNotification({
      userId: grievance.userId,
      title: "Grievance Rejected",
      content: `Your attendance grievance for ${grievance.date.toLocaleDateString()} was rejected. Note: ${managerNote}`,
      type: "ERROR",
      link: "/dashboard/employee/attendance"
    });

    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/accountant");
    return { success: true, message: "Grievance rejected successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to reject grievance" };
  }
}
