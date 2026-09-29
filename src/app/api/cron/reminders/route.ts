import { NextRequest, NextResponse } from "next/server";
import { processReminders } from "@/actions/reminders";

/**
 * ATTENDANCE REMINDERS CRON ENDPOINT
 * Triggers check-in and check-out reminders.
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
    console.log("[CRON] Processing attendance reminders...");
    
    const reminderCount = await processReminders();
    
    console.log(`[CRON] Sent ${reminderCount} reminders.`);

    return NextResponse.json({
      success: true,
      processed: {
        remindersCount: reminderCount,
      },
      time: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[CRON] Reminders processing failed:", error);
    return NextResponse.json({ 
      error: "Reminders task failed", 
      details: error.message 
    }, { status: 500 });
  }
}
