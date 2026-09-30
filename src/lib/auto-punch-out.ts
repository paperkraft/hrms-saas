import prisma from "@/lib/prisma";
import { getTodayRange } from "./attendance-helper";

/**
 * Checks for any un-finished attendance records from previous days
 * and automatically punches them out 2 hours after the office end time.
 * Also increments the user's autoPunchOutCount.
 */
export async function processAutoPunchOuts(userId: string) {
  const { start: todayStart } = getTodayRange();

  // 1. Find all records for this user that are today or older and have no punchOut
  const missingPunchOuts = await prisma.attendance.findMany({
    where: {
      userId,
      punchOut: null,
      date: { lte: todayStart }
    },
    include: {
      user: {
        include: { location: true }
      }
    }
  });

  if (missingPunchOuts.length === 0) return 0;
  return await executeAutoPunchOuts(missingPunchOuts);
}

/**
 * System-wide version of auto punch-out.
 * Processes all users who forgotten to punch out yesterday or before.
 */
export async function processAllAutoPunchOuts() {
  const { start: todayStart } = getTodayRange();

  // 1. Find ALL records system-wide that are today or older and have no punchOut
  const missingPunchOuts = await prisma.attendance.findMany({
    where: {
      punchOut: null,
      date: { lte: todayStart }
    },
    include: {
      user: {
        include: { location: true }
      }
    }
  });

  if (missingPunchOuts.length === 0) return 0;
  return await executeAutoPunchOuts(missingPunchOuts);
}

/**
 * Shared internal logic for processing a list of forgotten punch-outs.
 */
async function executeAutoPunchOuts(records: any[]) {
  // Pre-fetch system config for all tenants in these records
  const tenantIds = Array.from(new Set(records.map(r => r.tenantId || r.user?.tenantId).filter(Boolean)));
  const configs = await prisma.systemConfig.findMany({
    where: { tenantId: { in: tenantIds } }
  });
  const configMap = new Map(configs.map(c => [c.tenantId, c as any]));

  // Pre-fetch relevant leaves to handle custom auto punch-out times for HALF/SHORT leaves
  const userIds = Array.from(new Set(records.map(r => r.userId as string)));
  const dates = records.map(r => new Date(r.date));
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  minDate.setHours(0, 0, 0, 0);
  maxDate.setHours(23, 59, 59, 999);

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      userId: { in: userIds },
      status: "APPROVED",
      duration: { in: ["HALF", "SHORT"] },
      startDate: { lte: maxDate },
      endDate: { gte: minDate }
    }
  });

  const userIncrements: Record<string, number> = {};
  let totalProcessed = 0;

  for (const record of records) {
    const recordTenantId = record.tenantId || record.user?.tenantId;
    const config = recordTenantId ? configMap.get(recordTenantId) : null;

    if (config && !config.autoPunchOutEnabled) continue;

    const globalEndTime = config?.defaultOfficeEndTime || "18:00";
    const delayHours = config?.autoPunchOutDelayHours ?? 2;
    const globalSecondHalfStartTime = config?.secondHalfStartTime || "13:30";

    const shiftEndTime = record.user.location?.endTime || globalEndTime;

    // Find matching leave for this record's date
    const recordDate = new Date(record.date);
    recordDate.setHours(0, 0, 0, 0);

    const matchingLeave = leaves.find(l => {
      const lStart = new Date(l.startDate);
      lStart.setHours(0, 0, 0, 0);
      const lEnd = new Date(l.endDate);
      lEnd.setHours(23, 59, 59, 999);
      return l.userId === record.userId && recordDate >= lStart && recordDate <= lEnd;
    });

    let punchOutTimeString = shiftEndTime;
    let applyDelay = true;
    let isPenalty = true;

    if (matchingLeave) {
      if (matchingLeave.duration === "SHORT" && matchingLeave.startTime) {
        const [leaveStartHour] = matchingLeave.startTime.split(":").map(Number);
        if (leaveStartHour >= 16) {
          punchOutTimeString = matchingLeave.startTime;
          applyDelay = false;
          isPenalty = false;
        } else {
          punchOutTimeString = shiftEndTime;
          applyDelay = true;
        }
      } else if (matchingLeave.duration === "HALF") {
        if (matchingLeave.halfDayType === "SECOND_HALF") {
          punchOutTimeString = globalSecondHalfStartTime;
          applyDelay = false;
          isPenalty = false;
        } else if (matchingLeave.halfDayType === "FIRST_HALF") {
          punchOutTimeString = shiftEndTime;
          applyDelay = true;
        }
      }
    }

    const [hours, minutes] = punchOutTimeString.split(":").map(Number);
    const autoPunchOutTime = new Date(record.date);
    autoPunchOutTime.setHours(hours + (applyDelay ? delayHours : 0), minutes, 0, 0);

    // Skip if the auto-punch-out time hasn't reached yet (for today's records)
    if (autoPunchOutTime > new Date()) continue;

    // Update the attendance record
    await prisma.attendance.update({
      where: { id: record.id },
      data: {
        punchOut: autoPunchOutTime,
        isAutoPunchOut: true
      } as any
    });

    if (isPenalty) {
      userIncrements[record.userId] = (userIncrements[record.userId] || 0) + 1;
    }
    totalProcessed++;
  }

  // Update user counters
  for (const [userId, count] of Object.entries(userIncrements)) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        autoPunchOutCount: { increment: count }
      } as any
    });
  }

  return totalProcessed;
}
