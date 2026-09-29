"use server";

import { generateAllMonthlyBalances, syncAllBalances } from "@/lib/balance-accrual";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasMenuAccess } from "@/lib/permissions";

export async function triggerFinancialSync() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/accountant", "/dashboard/admin")) {
    return { error: "Unauthorized." };
  }

  try {
    const accrualCount = await generateAllMonthlyBalances();
    const syncCount = await syncAllBalances();

    revalidatePath("/dashboard/accountant");
    revalidatePath("/dashboard/admin");

    return {
      success: true,
      message: `Financial Sync Complete: ${syncCount} records reconciled. ${accrualCount} cycle points verified.`
    };
  } catch (error: any) {
    return { error: "Processing failed: " + error.message };
  }
}
