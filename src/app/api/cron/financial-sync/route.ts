import { NextRequest, NextResponse } from "next/server";
import { generateAllMonthlyBalances, syncAllBalances } from "@/lib/balance-accrual";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("key") || request.headers.get("Authorization")?.replace("Bearer ", "");
  const serverSecret = process.env.CRON_SECRET;

  if (serverSecret && secret !== serverSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[CRON] Starting Financial Sync...");
    
    const accrualCount = await generateAllMonthlyBalances();
    const syncCount = await syncAllBalances();
    
    console.log(`[CRON] Financial Sync Complete: ${syncCount} records reconciled, ${accrualCount} cycle points verified.`);

    return NextResponse.json({
      success: true,
      processed: {
        recordsReconciled: syncCount,
        accrualsVerified: accrualCount
      },
      time: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[CRON] Financial Sync failed:", error);
    return NextResponse.json({ 
      error: "Financial Sync failed", 
      details: error.message 
    }, { status: 500 });
  }
}
