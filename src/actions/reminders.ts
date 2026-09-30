import prisma from "@/lib/prisma";
import { getTodayRange } from "@/lib/attendance-helper";
import { createNotification } from "@/actions/notification";
import { format, addMinutes } from "date-fns";
import { getPayrollEligibleUserWhere } from "@/lib/payroll-helper";

export async function processReminders() {
  const now = new Date();
  // Skip if it's Sunday (0) without making any DB calls
  if (now.getDay() === 0) return 0;

  const { start, end } = getTodayRange();

  // Stage 1: Before 10 minutes
  const beforeTime = addMinutes(now, 10);
  const beforeTimeStr = format(beforeTime, "HH:mm");

  // Stage 2: After 5 minutes (Late/Forgot)
  const afterTime = addMinutes(now, -5);
  const afterTimeStr = format(afterTime, "HH:mm");

  // Fetch all active tenants
  const tenants = await prisma.tenant.findMany({
    where: { status: "ACTIVE" },
    select: { id: true }
  });

  let reminderCount = 0;

  for (const tenant of tenants) {
    const tenantId = tenant.id;

    const [holiday, config] = await Promise.all([
      prisma.publicHoliday.findFirst({
        where: {
          OR: [{ tenantId }, { tenantId: null }],
          date: { gte: start, lte: end }
        }
      }),
      prisma.systemConfig.findUnique({ where: { tenantId } })
    ]);

    if (holiday) continue;

    const globalStart = config?.defaultOfficeStartTime || "09:00";
    const globalEnd = config?.defaultOfficeEndTime || "18:00";

    const orConditions: any[] = [
      { location: { startTime: { in: [beforeTimeStr, afterTimeStr] } } },
      { location: { endTime: { in: [beforeTimeStr, afterTimeStr] } } }
    ];

    if ([beforeTimeStr, afterTimeStr].includes(globalStart) || [beforeTimeStr, afterTimeStr].includes(globalEnd)) {
      orConditions.push({ locationId: null });
    }

    // Find users matching exactly this window within this tenant
    const candidates = await prisma.user.findMany({
      where: getPayrollEligibleUserWhere({
        tenantId,
        isExternal: false,
        role: { not: "ADMIN" },
        OR: orConditions
      }),
      include: {
        roleDefinition: true,
        location: true,
        attendances: { where: { date: { gte: start, lte: end } } },
        leaveRequests: { where: { status: "APPROVED", startDate: { lte: end }, endDate: { gte: start } } },
        notifications: {
          where: {
            createdAt: { gte: start, lte: end },
            title: { in: ["Check-in Reminder", "Late Check-in Alert", "Check-out Reminder", "Check-out Warning"] }
          }
        }
      }
    });

  for (const user of candidates) {
    if (
      user.isExternal ||
      user.roleDefinition?.isExternal ||
      user.roleDefinition?.code === "EXTERNAL_USER"
    ) {
      continue;
    }
    if (user.leaveRequests.length > 0) continue;

    const startTime = user.location?.startTime || globalStart;
    const endTime = user.location?.endTime || globalEnd;
    const attendance = user.attendances[0];

    // --- CHECK-IN LOGIC ---
    if (!attendance || !attendance.punchIn) {
      // 10 Min Before
      if (startTime === beforeTimeStr) {
        const hasNotified = user.notifications.some(n => n.title === "Check-in Reminder");
        if (!hasNotified) {
          await createNotification({
            userId: user.id,
            title: "Check-in Reminder",
            content: `Shift starting in 10 minutes (${startTime}). Don't forget to check in!`,
            type: "WARNING",
            link: "/dashboard"
          });
          reminderCount++;
        }
      }
      // 5 Min After (Late)
      else if (startTime === afterTimeStr) {
        const hasNotified = user.notifications.some(n => n.title === "Late Check-in Alert");
        if (!hasNotified) {
          await createNotification({
            userId: user.id,
            title: "Late Check-in Alert",
            content: `Your shift started at ${startTime}. You haven't checked in yet!`,
            type: "ERROR",
            link: "/dashboard"
          });
          reminderCount++;
        }
      }
    }

    // --- CHECK-OUT LOGIC ---
    if (attendance && attendance.punchIn && !attendance.punchOut) {
      // 10 Min Before
      if (endTime === beforeTimeStr) {
        const hasNotified = user.notifications.some(n => n.title === "Check-out Reminder");
        if (!hasNotified) {
          await createNotification({
            userId: user.id,
            title: "Check-out Reminder",
            content: `Shift ending in 10 minutes (${endTime}). Don't forget to check out!`,
            type: "WARNING",
            link: "/dashboard"
          });
          reminderCount++;
        }
      }
      // 5 Min After (Forgot)
      else if (endTime === afterTimeStr) {
        const hasNotified = user.notifications.some(n => n.title === "Check-out Warning");
        if (!hasNotified) {
          await createNotification({
            userId: user.id,
            title: "Check-out Warning",
            content: `Your shift ended at ${endTime}. Please remember to check out to finalize your hours.`,
            type: "ERROR",
            link: "/dashboard"
          });
          reminderCount++;
        }
      }
    }
  }
}

  return reminderCount;
}
