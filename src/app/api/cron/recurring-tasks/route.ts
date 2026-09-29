import { NextRequest, NextResponse } from "next/server";
import { processRecurringTasks } from "@/lib/recurring-tasks";

/**
 * SECURE CRON ENDPOINT FOR RECURRING TASKS
 * Triggers automated recurring task generation.
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
    console.log("[CRON] Starting recurring tasks processing...");

    const recurringCount = await processRecurringTasks();
    console.log(`[CRON] Processed ${recurringCount} recurring tasks.`);

    return NextResponse.json({
      success: true,
      processed: {
        recurringTasks: recurringCount,
      },
      time: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[CRON] Recurring tasks processing failed:", error);
    return NextResponse.json({ 
      error: "Automated task failed", 
      details: error.message 
    }, { status: 500 });
  }
}
