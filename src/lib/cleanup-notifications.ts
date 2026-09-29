import prisma from "@/lib/prisma";

/**
 * Automatically purges:
 * 1. Past Birthday & Work Anniversary notifications older than today.
 * 2. Expired announcements or announcement notifications older than 14 days.
 * 3. Past daily Check-in / Check-out reminders older than 24 hours.
 */
export async function cleanupOldNotifications() {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Purge past celebration notifications (Birthday & Work Anniversary older than 7 days)
    const deletedCelebrations = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: sevenDaysAgo },
        OR: [
          { title: { contains: "Birthday" } },
          { title: { contains: "Work Anniversary" } },
          { title: { contains: "Happy Birthday" } },
        ],
      },
    });

    // 2. Find expired or inactive announcements
    const expiredAnnouncements = await prisma.announcement.findMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { isActive: false }
        ]
      },
      select: { title: true },
    });
    const expiredTitles = expiredAnnouncements.map((a) => a.title);

    // 3. Purge announcement notifications for expired announcements or notifications older than 14 days
    const deletedAnnouncements = await prisma.notification.deleteMany({
      where: {
        OR: [
          ...(expiredTitles.length > 0
            ? [
                {
                  title: { contains: "Announcement" },
                  content: { in: expiredTitles },
                },
              ]
            : []),
          {
            title: { contains: "Announcement" },
            createdAt: { lt: fourteenDaysAgo },
          },
        ],
      },
    });

    // 4. Purge daily check-in / check-out reminders older than 24 hours
    const deletedReminders = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: oneDayAgo },
        OR: [
          { title: { in: ["Check-in Reminder", "Late Check-in Alert", "Check-out Reminder", "Check-out Warning", "Check-out Reverted"] } },
          { title: { contains: "Check-in" } },
          { title: { contains: "Check-out" } },
        ],
      },
    });

    // 5. Purge applied leave and leave status notifications older than 7 days
    const deletedLeaves = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: sevenDaysAgo },
        OR: [
          { title: { contains: "Leave Applied" } },
          { title: { contains: "Leave Request" } },
          { title: { contains: "Leave Application" } },
          { title: { contains: "Leave Approved" } },
          { title: { contains: "Leave Rejected" } },
          { title: { contains: "Leave Cancelled" } },
          { link: { contains: "/leaves" } },
        ],
      },
    });

    // 6. Purge Task Reviews, Leave Applications, Shared Files, Comments, Overtime & Allowance requests older than 30 days
    const deletedActivity = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo },
        OR: [
          { title: { contains: "Task Ready for Review" } },
          { title: { contains: "Ready for Review" } },
          { title: { contains: "Leave" } },
          { link: { contains: "/leaves" } },
          { title: { contains: "New Files Shared" } },
          { title: { contains: "New File Shared" } },
          { title: { contains: "Files Shared" } },
          { link: { contains: "/file-share" } },
          { title: { contains: "New Comment" } },
          { title: { contains: "Comment" } },
          { title: { contains: "mentioned in a Task" } },
          { title: { contains: "Overtime Request" } },
          { title: { contains: "Overtime" } },
          { title: { contains: "Allowance Request" } },
          { title: { contains: "Allowance" } },
        ],
      },
    });

    const result = {
      celebrations: deletedCelebrations.count,
      announcements: deletedAnnouncements.count,
      reminders: deletedReminders.count,
      leaves: deletedLeaves.count,
      activity: deletedActivity.count,
      total: deletedCelebrations.count + deletedAnnouncements.count + deletedReminders.count + deletedLeaves.count + deletedActivity.count,
    };

    console.log("[NotificationCleanup] Auto-cleanup summary:", result);
    return result;
  } catch (error) {
    console.error("[NotificationCleanup] Error during notification cleanup:", error);
    return { celebrations: 0, announcements: 0, reminders: 0, leaves: 0, activity: 0, total: 0 };
  }
}

