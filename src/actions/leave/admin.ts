"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { processLeaveRequestStatus } from "./core";
export async function updateLeaveStatus(requestId: string, status: "APPROVED" | "REJECTED", note?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false as const, error: "Login required." };

  const { id: currentUserId, role, isTeamLeader } = session.user as any;
  const isAdmin = role === "ADMIN" || role === "SYSTEM_ADMIN";

  try {
    const requestMeta = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: { user: { select: { id: true, managerId: true, departmentId: true } } }
    });

    if (!requestMeta) return { success: false as const, error: "Request not found." };
    if (requestMeta.status !== "PENDING") return { success: true as const };

    // Authorization logic: strictly Admin and System Admin
    if (!isAdmin) {
      return { success: false as const, error: "Unauthorized. Only Administrators can approve or reject leave requests." };
    }

    return await processLeaveRequestStatus(requestId, status, note);

  } catch (error: any) {
    console.error("Status update error:", error);
    if (error.message.startsWith("BALANCE_NOT_FOUND")) {
      return { success: false as const, error: "One or more leave balance records not found. Please contact admin." };
    }
    return { success: false as const, error: "Failed to update request status. " + error.message };
  }
}
