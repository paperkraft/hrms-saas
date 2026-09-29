"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { processLeaveRequestStatus } from "./core";
import { revalidatePath } from "next/cache";

async function verifySystemAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (session.user.role !== "SYSTEM_ADMIN") {
    throw new Error("Forbidden: Developer access only (SYSTEM_ADMIN).");
  }
  return session.user.id;
}

export async function developerCreateLeave(data: any) {
  try {
    await verifySystemAdmin();

    const { userId, startDate, endDate, duration, category, leaveType, halfDayType, startTime, endTime, reason } = data;

    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
    if (!targetUser) throw new Error("User not found");

    // Direct insertion bypasses all checks (overlap, backdated logic, minimum days)
    const newRequest = await prisma.leaveRequest.create({
      data: {
        tenantId: targetUser.tenantId,
        userId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        duration,
        category,
        leaveType: category === "MONTHLY_POLICY_1" ? leaveType : null,
        halfDayType: duration === "HALF" ? halfDayType : null,
        startTime: duration === "SHORT" ? startTime : null,
        endTime: duration === "SHORT" ? endTime : null,
        reason: reason || "System Adjustment",
        status: "PENDING",
        systemNote: "System leave adjustment applied directly.",
        managerNote: "Auto-approved by System Adjustment",
      }
    });

    // Automatically approve to trigger deduction logic
    await processLeaveRequestStatus(newRequest.id, "APPROVED", "System Override Approval");

    revalidatePath("/dashboard/admin/developer/leave-adjustment");
    return { success: true };
  } catch (error: any) {
    console.error("System Leave Create Error:", error);
    return { success: false, error: error.message };
  }
}

export async function developerUpdateLeaveDuration(data: any) {
  try {
    await verifySystemAdmin();

    const { leaveId, newDuration, newHalfDayType, newStartTime, newEndTime, reason } = data;

    const original = await prisma.leaveRequest.findUnique({ where: { id: leaveId } });
    if (!original) throw new Error("Leave not found.");

    if (original.status !== "APPROVED") {
      await prisma.leaveRequest.update({
        where: { id: leaveId },
        data: {
          duration: newDuration,
          halfDayType: newDuration === "HALF" ? newHalfDayType : null,
          startTime: newDuration === "SHORT" ? newStartTime : null,
          endTime: newDuration === "SHORT" ? newEndTime : null,
          systemNote: (original.systemNote || "") + ` | Updated to ${newDuration} by system (${reason}).`
        }
      });
      return { success: true };
    }

    let diffDays = 0;
    const getDays = (duration: string) => {
      if (duration === "FULL") return 1;
      if (duration === "HALF") return 0.5;
      return 0;
    };

    const oldDays = getDays(original.duration);
    const newDays = getDays(newDuration);
    diffDays = newDays - oldDays;

    if (diffDays !== 0) {
      const partMonth = original.startDate.getMonth() + 1;
      const partYear = original.startDate.getFullYear();

      const balance = await prisma.leaveBalance.findFirst({
        where: { userId: original.userId, month: partMonth, year: partYear }
      });

      if (balance) {
        let balanceField = "";
        let takenField = "";

        if (original.category === "MONTHLY_POLICY_1") {
          balanceField = "remainingFull";
          takenField = "fullTaken";
        } else if (original.category === "SEMI_ANNUAL_POLICY_2") {
          balanceField = "semiAnnualRemaining";
          takenField = "semiAnnualTaken";
        } else if (original.category === "UNPAID") {
          takenField = "unpaidTaken";
        }

        const updates: any = {};
        if (takenField) {
          updates[takenField] = { increment: diffDays };
        }
        if (balanceField && balanceField !== "unpaidTaken") {
          updates[balanceField] = { decrement: diffDays };
        }

        if (Object.keys(updates).length > 0) {
          await prisma.leaveBalance.update({
            where: { id: balance.id },
            data: updates
          });
        }
      }
    }

    await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        duration: newDuration,
        halfDayType: newDuration === "HALF" ? newHalfDayType : null,
        startTime: newDuration === "SHORT" ? newStartTime : null,
        endTime: newDuration === "SHORT" ? newEndTime : null,
        systemNote: (original.systemNote || "") + ` | Duration changed to ${newDuration} by system (${reason}).`
      }
    });

    revalidatePath("/dashboard/admin/developer/leave-adjustment");
    return { success: true };

  } catch (error: any) {
    console.error("Developer Leave Update Error:", error);
    return { success: false, error: error.message };
  }
}

export async function fetchUserLeaves(userId: string) {
  try {
    await verifySystemAdmin();
    const leaves = await prisma.leaveRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20
    });
    return { success: true, leaves };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function fetchRecentLeaves(month?: number, year?: number, limit = 200) {
  try {
    await verifySystemAdmin();

    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || (now.getMonth() + 1);

    // Calculate month boundary
    const startOfMonth = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        user: {
          NOT: {
            roleDefinition: { code: "SYSTEM_ADMIN" }
          }
        },
        OR: [
          {
            startDate: {
              gte: startOfMonth,
              lte: endOfMonth
            }
          },
          {
            endDate: {
              gte: startOfMonth,
              lte: endOfMonth
            }
          },
          {
            AND: [
              { startDate: { lte: startOfMonth } },
              { endDate: { gte: endOfMonth } }
            ]
          }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeCode: true,
            designation: true,
            avatarUrl: true,
            department: { select: { name: true } }
          }
        }
      },
      orderBy: { startDate: "desc" },
      take: limit
    });
    return { success: true, leaves, targetMonth, targetYear };
  } catch (error: any) {
    console.error("Fetch Recent Leaves Error:", error);
    return { success: false, error: error.message };
  }
}

export async function developerDeleteLeave(leaveId: string) {
  try {
    await verifySystemAdmin();

    const original = await prisma.leaveRequest.findUnique({ where: { id: leaveId } });
    if (!original) throw new Error("Leave record not found.");

    // If approved, restore deducted days back to leave balance
    if (original.status === "APPROVED") {
      let days = 0;
      if (original.duration === "FULL") {
        const start = new Date(original.startDate);
        const end = new Date(original.endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      } else if (original.duration === "HALF") {
        days = 0.5;
      }

      if (days > 0) {
        const partMonth = original.startDate.getMonth() + 1;
        const partYear = original.startDate.getFullYear();

        const balance = await prisma.leaveBalance.findFirst({
          where: { userId: original.userId, month: partMonth, year: partYear }
        });

        if (balance) {
          let balanceField = "";
          let takenField = "";

          if (original.category === "MONTHLY_POLICY_1") {
            balanceField = "remainingFull";
            takenField = "fullTaken";
          } else if (original.category === "SEMI_ANNUAL_POLICY_2") {
            balanceField = "semiAnnualRemaining";
            takenField = "semiAnnualTaken";
          } else if (original.category === "UNPAID") {
            takenField = "unpaidTaken";
          }

          const updates: any = {};
          if (takenField) {
            updates[takenField] = { decrement: days };
          }
          if (balanceField && balanceField !== "unpaidTaken") {
            updates[balanceField] = { increment: days };
          }

          if (Object.keys(updates).length > 0) {
            await prisma.leaveBalance.update({
              where: { id: balance.id },
              data: updates
            });
          }
        }
      }
    }

    await prisma.leaveRequest.delete({
      where: { id: leaveId }
    });

    revalidatePath("/dashboard/admin/developer/leave-adjustment");
    return { success: true };
  } catch (error: any) {
    console.error("Developer Delete Leave Error:", error);
    return { success: false, error: error.message };
  }
}

