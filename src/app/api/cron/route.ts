import { NextRequest, NextResponse } from "next/server";
import { processAllAutoPunchOuts } from "@/lib/auto-punch-out";
import { archiveOldActivityLogs } from "@/lib/archive-activity-logs";
import { processRetentionNotifications } from "@/lib/project-retention";
import { cleanupOldNotifications } from "@/lib/cleanup-notifications";

/**
 * SECURE CRON ENDPOINT
 * Triggers automated processing tasks for HRM.
 * 
 * Authorization: 
 * 1. Bearer Token in header: `Authorization: Bearer <CRON_SECRET>`
 * 2. Query Parameter: `?key=<CRON_SECRET>`
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("key") || request.headers.get("Authorization")?.replace("Bearer ", "");

  const serverSecret = process.env.CRON_SECRET;

  // Basic security check
  if (serverSecret && secret !== serverSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[CRON] Starting automated processing tasks...");

    // 1. Proactive Auto Punch-Out
    const punchOutCount = await processAllAutoPunchOuts();
    console.log(`[CRON] Processed ${punchOutCount} auto punch-outs.`);

    // 2. Archive Old Activity Logs
    const archivedLogsCount = await archiveOldActivityLogs();

    // 3. Process Project Retention Notifications
    const retentionCount = await processRetentionNotifications();

    // 4. Clean up past celebration alerts, expired announcements, and old reminders
    const notificationCleanupStats = await cleanupOldNotifications();

    return NextResponse.json({
      success: true,
      processed: {
        autoPunchOuts: punchOutCount,
        archivedLogs: archivedLogsCount,
        retentionNotifications: retentionCount,
        cleanedNotifications: notificationCleanupStats,
      },
      time: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[CRON] Automated processing failed:", error);
    return NextResponse.json({ 
      error: "Automated task failed", 
      details: error.message 
    }, { status: 500 });
  }
}

