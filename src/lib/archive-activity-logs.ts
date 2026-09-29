import prisma from "@/lib/prisma";

export async function archiveOldActivityLogs() {
  console.log("[CRON] Starting ActivityLog cleanup process...");
  
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  try {
    const deleted = await prisma.activityLog.deleteMany({
      where: {
        createdAt: {
          lt: ninetyDaysAgo,
        },
      },
    });

    console.log(`[CRON] Cleaned up ${deleted.count} old activity logs.`);
    return deleted.count;
  } catch (error) {
    console.error("[CRON] Failed to clean up activity logs:", error);
    throw error;
  }
}
