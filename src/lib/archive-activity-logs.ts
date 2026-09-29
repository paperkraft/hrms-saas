import prisma from "@/lib/prisma";

const BATCH_SIZE = 500;

export async function archiveOldActivityLogs() {
  console.log("[CRON] Starting ActivityLog archival process...");
  
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

  let totalArchived = 0;

  try {
    while (true) {
      // 1. Find a batch of logs older than 15 days
      const oldLogs = await prisma.activityLog.findMany({
        where: {
          createdAt: {
            lt: fifteenDaysAgo,
          },
        },
        take: BATCH_SIZE,
      });

      if (oldLogs.length === 0) {
        break;
      }

      console.log(`[CRON] Archiving batch of ${oldLogs.length} activity logs...`);

      // 2. Map them to the archive structure
      const archiveData = oldLogs.map((log) => ({
        id: log.id,
        projectId: log.projectId,
        taskId: log.taskId,
        userId: log.userId,
        action: log.action,
        details: log.details,
        createdAt: log.createdAt,
      }));

      const logIds = oldLogs.map((log) => log.id);

      // 3. Use an interactive transaction to safely move the batch of records
      await prisma.$transaction(
        async (tx) => {
          // Create records in the archive table
          await tx.activityLogArchive.createMany({
            data: archiveData,
            skipDuplicates: true, // In case of retries
          });

          // Delete the archived records from the active table
          await tx.activityLog.deleteMany({
            where: {
              id: {
                in: logIds,
              },
            },
          });
        },
        {
          timeout: 20000, // 20 seconds timeout per batch
          maxWait: 10000,  // 10 seconds max wait for DB connection
        }
      );

      totalArchived += oldLogs.length;
    }

    if (totalArchived === 0) {
      console.log("[CRON] No old activity logs to archive.");
    } else {
      console.log(`[CRON] Successfully archived a total of ${totalArchived} activity logs.`);
    }

    return totalArchived;
  } catch (error) {
    console.error("[CRON] Failed to archive activity logs:", error);
    throw error;
  }
}

