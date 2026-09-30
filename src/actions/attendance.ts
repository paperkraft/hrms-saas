"use server"

import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { getTodayRange } from "@/lib/attendance-helper"
import { headers } from "next/headers"
import { getDistanceInMeters } from "@/lib/geofencing"
import { createNotification } from "./notification"
import { appConfig } from "@/lib/app-config"


export async function punchInOutAction(coords?: { lat: number; lng: number; accuracy?: number }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { success: false, error: "Unauthorized" }

    const headerList = await headers();
    const forwarded = headerList.get("x-forwarded-for");
    const ipAddress = forwarded ? forwarded.split(',')[0] : "127.0.0.1";

    const { start, end } = getTodayRange();

    const tenantId = session.user.tenantId;

    // 1. Fetch user profile, system config, leave request, and attendance log in parallel
    const [user, config, approvedLeave, existingLog] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          location: true,
          additionalLocations: true
        }
      }),
      tenantId ? prisma.systemConfig.findUnique({ where: { tenantId } }) : null,
      prisma.leaveRequest.findFirst({
        where: {
          userId: session.user.id,
          status: "APPROVED",
          duration: { in: ["HALF", "SHORT"] },
          startDate: { lte: end },
          endDate: { gte: start }
        }
      }),
      prisma.attendance.findFirst({
        where: {
          userId: session.user.id,
          date: { gte: start, lte: end }
        }
      })
    ]);

    if (!user) return { success: false, error: "User not found" };
    if (user.status && user.status !== "ACTIVE") {
      return { success: false, error: "Your account is inactive or resigned. Please contact an administrator." };
    }

    // Priority for timings: Location > System Default
    const startTime = user.location?.startTime || config?.defaultOfficeStartTime || "09:00"
    const endTime = user.location?.endTime || config?.defaultOfficeEndTime || "18:00"
    const graceMinutes = user.location?.graceTimeMinutes ?? config?.defaultGraceTimeMinutes ?? 0

    // 2. Geofencing Logic based on Work Mode & Allowed Locations
    let isOutsideOffice = false;

    // Collect all permitted locations for this user (primary + additional)
    let allowedLocations: any[] = [];
    if (user.location) allowedLocations.push(user.location);
    if ((user as any).additionalLocations && Array.isArray((user as any).additionalLocations)) {
      allowedLocations.push(...(user as any).additionalLocations);
    }

    // Fallback: If user has no explicit locations assigned and is on-site/hybrid,
    // check against all non-remote locations configured in the system for this tenant
    if (allowedLocations.length === 0 && user.workMode !== "REMOTE") {
      const allLocations = await prisma.location.findMany({
        where: {
          isRemote: false,
          ...(user.tenantId ? { tenantId: user.tenantId } : {})
        }
      });
      if (allLocations.length > 0) {
        allowedLocations = allLocations;
      }
    }

    if (user.workMode === "REMOTE") {
      // Remote workers are in-office by definition unless specific check-in locations are enforced
      if (allowedLocations.length > 0 && coords) {
        const isNearAnyAllowed = allowedLocations.some(loc => {
          if (loc.isRemote) return true;
          if (loc.lat == null || loc.lng == null) return false;
          const distance = getDistanceInMeters(coords.lat, coords.lng, loc.lat, loc.lng);
          const accuracyBuffer = Math.min(Math.max(50, coords.accuracy || 0), 200);
          return distance <= (loc.radiusMeters + accuracyBuffer);
        });
        isOutsideOffice = !isNearAnyAllowed;
      } else {
        isOutsideOffice = false;
      }
    } else {
      // OFFICE or HYBRID
      if (allowedLocations.length > 0) {
        if (coords) {
          const isNearAnyAllowed = allowedLocations.some(loc => {
            if (loc.isRemote) return true; // Remote/WFH site allows punches anywhere
            if (loc.lat == null || loc.lng == null) return false;
            const distance = getDistanceInMeters(coords.lat, coords.lng, loc.lat, loc.lng);
            // Dynamic accuracy buffer for indoor drift (min 50m, up to 200m based on device GPS accuracy)
            const accuracyBuffer = Math.min(Math.max(50, coords.accuracy || 0), 200);
            return distance <= (loc.radiusMeters + accuracyBuffer);
          });

          if (!isNearAnyAllowed) {
            isOutsideOffice = true;
          }
        } else {
          // If coords missing and user is on-site
          isOutsideOffice = true;
        }
      } else {
        isOutsideOffice = false;
      }
    }

    if (!existingLog) {
      const punchInTime = new Date()

      // Calculate Late & Half Day Threshold
      const lateHalfDayThresholdStr = (config as any)?.lateHalfDayThreshold || "11:30";
      const [halfDayH, halfDayM] = lateHalfDayThresholdStr.split(":").map(Number);
      const lateHalfDayThreshold = new Date(start);
      lateHalfDayThreshold.setHours(halfDayH, halfDayM, 0, 0);

      // Check if approved leave exists
      const isApprovedFullLeave = approvedLeave?.duration === "FULL";
      const isApprovedHalfLeave = approvedLeave?.duration === "HALF";
      const isFirstHalfLeave = isApprovedHalfLeave && approvedLeave?.halfDayType === "FIRST_HALF";

      const isShortLeave = approvedLeave?.duration === "SHORT" && !!approvedLeave.startTime && !!approvedLeave.endTime;
      const isMorningShortLeave = isShortLeave && (
        approvedLeave!.startTime! <= startTime ||
        approvedLeave!.startTime! <= lateHalfDayThresholdStr
      );

      let effectiveStartTime = startTime;
      if (isFirstHalfLeave) {
        effectiveStartTime = config?.secondHalfStartTime || "13:30";
      } else if (isMorningShortLeave && approvedLeave?.endTime) {
        effectiveStartTime = approvedLeave.endTime;
      }

      const [hours, minutes] = effectiveStartTime.split(":").map(Number)
      const lateThreshold = new Date(start)
      lateThreshold.setHours(hours, minutes + graceMinutes, 0, 0)

      const isSunday = start.getDay() === 0;

      const lateMarkEnabled = config?.lateMarkEnabled ?? false;
      let isLate = false;
      let isHalfDay = false;

      if (lateMarkEnabled && !isSunday && !isApprovedFullLeave) {
        if (isApprovedHalfLeave || isMorningShortLeave) {
          // If approved half-day leave or morning short leave exists:
          // Never mark technical isHalfDay.
          // Mark as late ONLY if punch-in exceeds the effective lateThreshold (e.g. 13:30 + grace for 1st half leave)
          isHalfDay = false;
          if (punchInTime > lateThreshold) {
            isLate = true;
          }
        } else if (isShortLeave) {
          isHalfDay = false;
          if (punchInTime > lateThreshold) {
            isLate = true;
          }
        } else if (punchInTime > lateHalfDayThreshold) {
          // Technical half-day: set isHalfDay = true, but isLate = false (to avoid double deduction with late mark penalties)
          isHalfDay = true;
          isLate = false;
        } else if (punchInTime > lateThreshold) {
          isLate = true;
        }
      }

      try {
        await prisma.attendance.create({
          data: {
            tenantId: tenantId || user.tenantId,
            userId: session.user.id,
            date: start,
            punchIn: punchInTime,
            isLate,
            isHalfDay,
            punchInLat: coords?.lat,
            punchInLng: coords?.lng,
            ipAddress,
            isOutsideOffice
          }
        });
      } catch (createErr: any) {
        if (createErr?.code === "P2002") {
          console.warn(`[Concurrent PunchIn Handled] User ${session.user.id} already has a record for date ${start.toISOString()}`);
          return { success: true };
        }
        throw createErr;
      }

      // Non-blocking auto-delete check-in and late-alert reminders for today
      prisma.notification.deleteMany({
        where: {
          userId: session.user.id,
          title: { in: ["Check-in Reminder", "Late Check-in Alert"] },
          createdAt: { gte: start, lte: end }
        }
      }).catch(err => console.error("Non-blocking notification delete error:", err));
    } else if (!existingLog.punchOut) {
      const punchOutTime = new Date();

      // Calculate Early Log-off
      let isEarlyLogoff = false;
      const earlyLogoffEnabled = (config as any)?.earlyLogoffEnabled ?? false;

      const [eH, eM] = endTime.split(":").map(Number);
      const shiftEnd = new Date(start);
      shiftEnd.setHours(eH, eM, 0, 0);

      if (earlyLogoffEnabled && punchOutTime < shiftEnd) {
        isEarlyLogoff = true;
        // Check if covered by short leave
        if (approvedLeave?.duration === "SHORT" && approvedLeave.startTime && approvedLeave.endTime) {
          // If short leave covers the shift end (e.g. ends at 18:00 or later)
          if (approvedLeave.endTime >= endTime) {
            // If they punch out at or after the start of their approved short leave
            const [slH, slM] = approvedLeave.startTime.split(":").map(Number);
            const slStart = new Date(start);
            slStart.setHours(slH, slM, 0, 0);
            if (punchOutTime >= slStart) {
              isEarlyLogoff = false;
            }
          }
        }
      }

      let isSpecialCase = false;
      const specialCaseEnabled = (config as any)?.specialCaseEnabled ?? true; // Align with Prisma default
      const extraMinutes = (config as any)?.specialCaseExtraMinutes ?? 0;

      if (specialCaseEnabled && existingLog.isLate && !existingLog.isHalfDay && !isOutsideOffice) {
        // Robust parsing for shift times
        const [sH, sM] = startTime.split(":").map(s => parseInt(s, 10));
        const [eH, eM] = endTime.split(":").map(s => parseInt(s, 10));

        if (isNaN(sH) || isNaN(eH)) {
          console.error(`[Attendance] Invalid shift times: start=${startTime}, end=${endTime}`);
          return;
        }

        let standardMinutes = (eH * 60 + (eM || 0)) - (sH * 60 + (sM || 0));

        // Adjust standard minutes if there's a short or half leave
        if (approvedLeave) {
          if (approvedLeave.duration === "SHORT" && approvedLeave.startTime && approvedLeave.endTime) {
            const [slsH, slsM] = approvedLeave.startTime.split(":").map(s => parseInt(s, 10));
            const [sleH, sleM] = approvedLeave.endTime.split(":").map(s => parseInt(s, 10));
            const shortLeaveDuration = (sleH * 60 + (sleM || 0)) - (slsH * 60 + (slsM || 0));
            standardMinutes -= shortLeaveDuration;
          } else if (approvedLeave.duration === "HALF") {
            standardMinutes = Math.round(standardMinutes / 2);
          }
        }

        const punchInMs = existingLog.punchIn.getTime();
        const punchOutMs = punchOutTime.getTime();
        let actualMinutes = Math.floor((punchOutMs - punchInMs) / (1000 * 60));
        const requiredMinutes = standardMinutes + extraMinutes;

        // Subtract short leave overlap from actualMinutes so they don't get free time
        if (approvedLeave?.duration === "SHORT" && approvedLeave.startTime && approvedLeave.endTime) {
          const slStart = new Date(start);
          const [slsH, slsM] = approvedLeave.startTime.split(":").map(Number);
          slStart.setHours(slsH, slsM, 0, 0);

          const slEnd = new Date(start);
          const [sleH, sleM] = approvedLeave.endTime.split(":").map(Number);
          slEnd.setHours(sleH, sleM, 0, 0);

          const overlapStartMs = Math.max(punchInMs, slStart.getTime());
          const overlapEndMs = Math.min(punchOutMs, slEnd.getTime());

          if (overlapStartMs < overlapEndMs) {
            const overlapMinutes = Math.floor((overlapEndMs - overlapStartMs) / (1000 * 60));
            actualMinutes -= overlapMinutes;
          }
        }

        // Enforce max late threshold
        let effectiveStartTime = startTime;
        if (approvedLeave?.duration === "SHORT" && approvedLeave.startTime && approvedLeave.endTime) {
          if (approvedLeave.startTime <= startTime) {
            effectiveStartTime = approvedLeave.endTime;
          }
        }
        const maxLateMinutes = (config as any)?.specialCaseMaxLateMinutes ?? 10;
        const [esH, esM] = effectiveStartTime.split(":").map(Number);
        const maxLateThreshold = new Date(start);
        maxLateThreshold.setHours(esH, esM + graceMinutes + maxLateMinutes, 0, 0);

        if (existingLog.punchIn > maxLateThreshold) {
          isSpecialCase = false;
          console.log(`[SpecialCaseCheck] RESULT: NOT Applied (PunchIn ${existingLog.punchIn.toISOString()} exceeded max late threshold ${maxLateThreshold.toISOString()})`);
        } else if (actualMinutes >= requiredMinutes) {
          isSpecialCase = true;
          console.log(`[SpecialCaseCheck] RESULT: Special Case Applied`);
        } else {
          console.log(`[SpecialCaseCheck] RESULT: Special Case NOT Applied (Short by ${requiredMinutes - actualMinutes} mins)`);
        }
      }

      await prisma.attendance.update({
        where: { id: existingLog.id },
        data: {
          punchOut: punchOutTime,
          isLateSpecialCase: isSpecialCase,
          isEarlyLogoff,
          punchOutLat: coords?.lat,
          punchOutLng: coords?.lng,
          ipAddress: ipAddress ?? (existingLog as any).ipAddress,
          // Preserve the original punch-in location status: punch-out does not invalidate in-office attendance
          isOutsideOffice: existingLog.isOutsideOffice
        }
      })

      // Auto-delete check-out and checkout-warning reminders for today
      await prisma.notification.deleteMany({
        where: {
          userId: session.user.id,
          title: { in: ["Check-out Reminder", "Check-out Warning"] },
          createdAt: { gte: start, lte: end }
        }
      });
    }

    revalidatePath("/dashboard/employee");
    revalidatePath("/dashboard/employee/attendance");
    revalidatePath("/dashboard/admin");
    return { success: true }
  } catch (error: any) {
    console.error("Punch Error:", error);
    return { success: false, error: "Failed to process punch: " + error.message }
  }
}

export async function revertPunchOutAction(attendanceId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { success: false, error: "Unauthorized" }

    // Role check: Only Accountant, Admin, or System Admin can revert
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!currentUser || !["ACCOUNTANT", "ADMIN", "SYSTEM_ADMIN"].includes(currentUser.role)) {
      return { success: false, error: "Insufficient permissions to revert check-out" };
    }

    const log = await prisma.attendance.findUnique({
      where: { id: attendanceId }
    });

    if (!log) return { success: false, error: "Attendance log not found" };

    // Date check: Only today's check-outs can be reverted
    const { start, end } = getTodayRange();
    const logDate = new Date(log.date);
    if (logDate < start || logDate > end) {
      return { success: false, error: "You can only revert check-outs for today's logs. Past records cannot be modified." };
    }

    if (!log.punchOut) return { success: false, error: "User is already punched in" };

    await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        punchOut: null,
        punchOutLat: null,
        punchOutLng: null,
        isLateSpecialCase: false, // Reset special case if checkout is reverted
        isAutoPunchOut: false     // Also reset auto-checkout flag if present
      }
    });

    // 4. Create Notification for the User
    try {
      await createNotification({
        userId: log.userId,
        title: "Check-out Reverted",
        content: `Your check-out for today has been reverted by ${session.user.name || "Administration"}. Your session is now active again.`,
        type: "WARNING"
      });
    } catch (notifError) {
      console.error("Failed to notify user about revert:", notifError);
    }

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (error: any) {
    console.error("Revert Error:", error);
    return { success: false, error: "Failed to revert check-out: " + error.message };
  }
}

export async function getLocationLogsAction(reqMonth?: number, reqYear?: number, reqDate?: string) {
  try {
    const session = await getServerSession(authOptions);
    const tenantId = session?.user?.tenantId;

    const now = new Date();
    const currentYear = reqYear || now.getUTCFullYear();
    const currentMonth = reqMonth || now.getUTCMonth() + 1;

    let whereClause: any = {
      ...(tenantId ? { tenantId } : {})
    };

    if (reqDate) {
      const [y, m, d] = reqDate.split('-').map(Number);
      const startOfDay = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
      whereClause.date = { gte: startOfDay, lte: endOfDay };
    } else {
      const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0, 0));
      const endOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999));
      whereClause.date = { gte: startOfMonth, lte: endOfMonth };
    }

    const attendances = await prisma.attendance.findMany({
      where: {
        ...whereClause,
        user: {
          role: { not: "SYSTEM_ADMIN" },
          NOT: [
            { email: { in: [appConfig.devAdminEmail, "dev@sigma.com"] } },
            { roleDefinition: { code: "SYSTEM_ADMIN" } }
          ]
        }
      },
      include: { user: { select: { name: true, email: true, avatarUrl: true } } },
      orderBy: { date: 'desc' },
    });

    return {
      success: true,
      data: {
        logs: attendances.map(a => ({
          id: a.id,
          userName: a.user.name || a.user.email,
          avatarUrl: a.user.avatarUrl,
          date: a.date,
          punchIn: a.punchIn,
          punchOut: a.punchOut,
          punchInLat: a.punchInLat,
          punchInLng: a.punchInLng,
          punchOutLat: a.punchOutLat,
          punchOutLng: a.punchOutLng,
          isOutsideOffice: a.isOutsideOffice,
          ipAddress: a.ipAddress,
        })),
        stats: {
          total: attendances.length,
          outside: attendances.filter(a => a.isOutsideOffice).length,
          inside: attendances.filter(a => !a.isOutsideOffice).length,
          monthName: new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' }),
          year: currentYear,
          month: currentMonth,
          date: reqDate || null
        }
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}