import prisma from "@/lib/prisma";

export async function calculateAttendanceStatusFlags(
  userId: string,
  date: Date,
  punchIn: Date | null,
  punchOut: Date | null,
  isOutsideOffice: boolean = false
) {
  if (!punchIn) {
    return { isLate: false, isLateSpecialCase: false, isEarlyLogoff: false, isHalfDay: false };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { location: true }
  });

  const config = user?.tenantId
    ? await prisma.systemConfig.findUnique({
        where: { tenantId: user.tenantId }
      })
    : null;

  const startTime = user?.location?.startTime || config?.defaultOfficeStartTime || "09:00";
  const endTime = user?.location?.endTime || config?.defaultOfficeEndTime || "18:00";
  const graceMinutes = user?.location?.graceTimeMinutes ?? config?.defaultGraceTimeMinutes ?? 0;

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const dayStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const dayEnd = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

  // Find any approved leave for this date
  const approvedLeave = await prisma.leaveRequest.findFirst({
    where: {
      userId: userId,
      status: "APPROVED",
      startDate: { lte: dayEnd },
      endDate: { gte: dayStart }
    }
  });

  // 1. Calculate isLate & isHalfDay
  const lateHalfDayThresholdStr = (config as any)?.lateHalfDayThreshold || "11:30";
  const [halfDayH, halfDayM] = lateHalfDayThresholdStr.split(":").map(Number);
  const lateHalfDayThreshold = new Date(year, month, day, halfDayH, halfDayM, 0, 0);

  const isApprovedFullLeave = approvedLeave?.duration === "FULL";
  const isApprovedHalfLeave = approvedLeave?.duration === "HALF";
  const isFirstHalfLeave = isApprovedHalfLeave && approvedLeave?.halfDayType === "FIRST_HALF";
  const isSecondHalfLeave = isApprovedHalfLeave && approvedLeave?.halfDayType === "SECOND_HALF";

  // Check if approved short leave exists covering morning / late arrival
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

  const [sH, sM] = effectiveStartTime.split(":").map(Number);
  const lateThreshold = new Date(year, month, day, sH, sM + graceMinutes, 0, 0);

  const isSunday = dayStart.getDay() === 0 || date.getDay() === 0;
  const lateMarkEnabled = config?.lateMarkEnabled ?? true;

  let isLate = false;
  let isHalfDay = false;

  if (lateMarkEnabled && !isSunday && !isApprovedFullLeave) {
    if (isApprovedHalfLeave || isMorningShortLeave) {
      // If approved half-day leave or morning short leave exists:
      // Never mark technical isHalfDay (avoid double penalty).
      isHalfDay = false;
      if (punchIn > lateThreshold) {
        isLate = true;
      }
    } else if (isShortLeave) {
      // Short leave exists (e.g. afternoon or midday)
      isHalfDay = false;
      if (punchIn > lateThreshold) {
        isLate = true;
      }
    } else if (punchIn > lateHalfDayThreshold) {
      // Technical half-day without any leave
      isHalfDay = true;
      isLate = false;
    } else if (punchIn > lateThreshold) {
      isLate = true;
    }
  }

  // 2. Calculate isEarlyLogoff
  let isEarlyLogoff = false;
  if (punchOut && !isApprovedFullLeave) {
    const earlyLogoffEnabled = (config as any)?.earlyLogoffEnabled ?? false;
    const [eH, eM] = endTime.split(":").map(Number);
    const shiftEnd = new Date(year, month, day, eH, eM, 0, 0);

    if (earlyLogoffEnabled && punchOut < shiftEnd) {
      isEarlyLogoff = true;

      // Excused if 2nd half leave is approved
      if (isSecondHalfLeave) {
        const firstHalfEndStr = config?.firstHalfEndTime || "13:30";
        const [fhH, fhM] = firstHalfEndStr.split(":").map(Number);
        const firstHalfEnd = new Date(year, month, day, fhH, fhM, 0, 0);
        if (punchOut >= firstHalfEnd) {
          isEarlyLogoff = false;
        }
      } else if (isShortLeave && approvedLeave?.startTime) {
        // Excused if short leave covers the evening logoff
        const [slsH, slsM] = approvedLeave.startTime.split(":").map(Number);
        const slStart = new Date(year, month, day, slsH, slsM, 0, 0);
        if (punchOut >= slStart) {
          isEarlyLogoff = false;
        }
      }
    }
  }

  // 3. Calculate isLateSpecialCase (late waiver by staying late)
  let isLateSpecialCase = false;
  const specialCaseEnabled = (config as any)?.specialCaseEnabled ?? true;
  const extraMinutes = (config as any)?.specialCaseExtraMinutes ?? 0;

  if (specialCaseEnabled && isLate && !isHalfDay && punchOut && !isOutsideOffice) {
    const [shiftSH, shiftSM] = startTime.split(":").map(s => parseInt(s, 10));
    const [shiftEH, shiftEM] = endTime.split(":").map(s => parseInt(s, 10));

    if (!isNaN(shiftSH) && !isNaN(shiftEH)) {
      let standardMinutes = (shiftEH * 60 + (shiftEM || 0)) - (shiftSH * 60 + (shiftSM || 0));

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

      const punchInMs = punchIn.getTime();
      const punchOutMs = punchOut.getTime();
      let actualMinutes = Math.floor((punchOutMs - punchInMs) / (1000 * 60));
      const requiredMinutes = standardMinutes + extraMinutes;

      if (approvedLeave?.duration === "SHORT" && approvedLeave.startTime && approvedLeave.endTime) {
        const [slsH, slsM] = approvedLeave.startTime.split(":").map(Number);
        const slStart = new Date(year, month, day, slsH, slsM, 0, 0);

        const [sleH, sleM] = approvedLeave.endTime.split(":").map(Number);
        const slEnd = new Date(year, month, day, sleH, sleM, 0, 0);

        const overlapStartMs = Math.max(punchInMs, slStart.getTime());
        const overlapEndMs = Math.min(punchOutMs, slEnd.getTime());

        if (overlapStartMs < overlapEndMs) {
          const overlapMinutes = Math.floor((overlapEndMs - overlapStartMs) / (1000 * 60));
          actualMinutes -= overlapMinutes;
        }
      }

      const maxLateMinutes = (config as any)?.specialCaseMaxLateMinutes ?? 10;
      const [esH, esM] = effectiveStartTime.split(":").map(Number);
      const maxLateThreshold = new Date(year, month, day, esH, esM + graceMinutes + maxLateMinutes, 0, 0);

      if (punchIn <= maxLateThreshold && actualMinutes >= requiredMinutes) {
        isLateSpecialCase = true;
      }
    }
  }

  return { isLate, isLateSpecialCase, isEarlyLogoff, isHalfDay };
}

export async function syncAttendanceWithApprovedLeaves(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  try {
    const start = new Date(startDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);

    const attendances = await prisma.attendance.findMany({
      where: {
        userId,
        date: { gte: start, lte: end }
      }
    });

    for (const att of attendances) {
      if (!att.punchIn) continue;

      const flags = await calculateAttendanceStatusFlags(
        userId,
        att.date,
        att.punchIn,
        att.punchOut,
        att.isOutsideOffice
      );

      await prisma.attendance.update({
        where: { id: att.id },
        data: {
          isLate: flags.isLate,
          isHalfDay: flags.isHalfDay,
          isEarlyLogoff: flags.isEarlyLogoff,
          isLateSpecialCase: flags.isLateSpecialCase
        }
      });
    }
  } catch (error) {
    console.error(`[syncAttendanceWithApprovedLeaves] Error syncing attendance for user ${userId}:`, error);
  }
}
