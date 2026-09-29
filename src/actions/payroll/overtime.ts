"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasMenuAccess } from "@/lib/permissions";
import { createNotification, createManyNotifications } from "@/actions/notification";

export async function applyForOvertime(data: {
  date: string;
  hours: number;
  reason: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.tenantId) {
    return { error: "Unauthorized" };
  }

  try {
    // Parse date components safely (handles YYYY-MM-DD format)
    const [year, month, day] = data.date.split('-').map(Number);
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    // Check if an overtime request already exists for this user on the same date
    const existingOvertime = await prisma.overtimeRequest.findFirst({
      where: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { in: ["PENDING", "APPROVED"] },
      },
    });

    if (existingOvertime) {
      const statusText = existingOvertime.status === "PENDING" ? "a pending" : "an approved";
      return {
        error: `You already have ${statusText} overtime request for this date. Only one request per date is allowed.`,
      };
    }

    // Fetch config to check max overtime hours
    const config = await prisma.systemConfig.findUnique({
      where: { tenantId: session.user.tenantId }
    });
    const maxHours = (config as any)?.maxOvertimeHoursPerDay || 4;

    if (data.hours > maxHours) {
      return { error: `Overtime cannot exceed ${maxHours} hours per day.` };
    }

    const applicant = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, managerId: true }
    });
    const applicantName = applicant?.name || session.user.name || "Employee";

    await prisma.overtimeRequest.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        date: startOfDay,
        hours: data.hours,
        reason: data.reason,
        status: "PENDING",
      },
    });

    const dateStr = startOfDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const usersToNotify = await prisma.user.findMany({
      where: {
        tenantId: session.user.tenantId,
        AND: [
          { id: { not: session.user.id } },
          {
            OR: [
              { role: "ADMIN" },
              { roleDefinition: { code: { in: ["ADMIN", "ACCOUNTANT"] } } },
              { id: applicant?.managerId || undefined }
            ]
          }
        ]
      },
      select: { id: true, role: true, email: true }
    });

    if (usersToNotify.length > 0) {
      await createManyNotifications(
        usersToNotify.map(u => ({
          userId: u.id,
          title: `Overtime Request: ${applicantName}`,
          message: `${applicantName} has requested ${data.hours} hours of overtime on ${dateStr}.`,
          type: "INFO",
          link: "/dashboard/accountant?tab=overtime"
        }))
      );
    }

    await createNotification({
      userId: session.user.id,
      title: "Overtime Request Submitted",
      message: `Your request for ${data.hours} hours of overtime on ${dateStr} is pending review.`,
      type: "INFO",
      link: "/dashboard"
    });

    revalidatePath("/dashboard/employee");
    revalidatePath("/dashboard/employee/leaves");
    revalidatePath("/dashboard/accountant");
    revalidatePath("/dashboard/leaves/manage");
    return { success: true };
  } catch (error) {
    console.error("Failed to apply for overtime:", error);
    return { error: "Failed to submit overtime request" };
  }
}

export async function cancelOvertime(overtimeId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.tenantId) {
    return { error: "Unauthorized" };
  }

  try {
    const overtime = await prisma.overtimeRequest.findUnique({
      where: { id: overtimeId },
    });

    if (!overtime) {
      return { error: "Overtime request not found" };
    }

    const isOwner = overtime.userId === session.user.id;
    const isPrivileged = hasMenuAccess(session.user, "/dashboard/accountant", "/dashboard/leaves/manage");

    if (!isOwner && !isPrivileged) {
      return { error: "Unauthorized to cancel this overtime request" };
    }

    if (overtime.status !== "PENDING" && !isPrivileged) {
      return { error: "Only pending overtime requests can be cancelled" };
    }

    await prisma.overtimeRequest.delete({
      where: { id: overtimeId },
    });

    revalidatePath("/dashboard/employee");
    revalidatePath("/dashboard/employee/leaves");
    revalidatePath("/dashboard/accountant");
    revalidatePath("/dashboard/leaves/manage");
    return { success: true };
  } catch (error) {
    console.error("Failed to cancel overtime request:", error);
    return { error: "Failed to cancel overtime request" };
  }
}

export async function processOvertimeStatus(
  overtimeId: string,
  status: "APPROVED" | "REJECTED"
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.tenantId) {
    return { error: "Unauthorized" };
  }

  try {
    const overtime = await prisma.overtimeRequest.findUnique({
      where: { id: overtimeId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            managerId: true,
            departmentId: true,
          }
        }
      }
    });

    if (!overtime) {
      return { error: "Overtime request not found" };
    }

    // Permission checks
    const isAllowedRole = hasMenuAccess(session.user, "/dashboard/accountant", "/dashboard/leaves/manage");
    const isManager = overtime.user.managerId === session.user.id;
    
    // Check if user is TL of the requester's department
    const ledDept = await prisma.department.findFirst({
      where: { tenantId: session.user.tenantId, teamLeaderId: session.user.id }
    });
    const isTL = ledDept && overtime.user.departmentId === ledDept.id;

    if (!isAllowedRole && !isManager && !isTL) {
      return { error: "Unauthorized" };
    }

    const updatedOvertime = await prisma.overtimeRequest.update({
      where: { id: overtimeId },
      data: { status },
      include: { user: true }
    });

    const dateStr = new Date(updatedOvertime.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    await createNotification({
      userId: updatedOvertime.userId,
      title: `Overtime Request ${status.charAt(0) + status.slice(1).toLowerCase()}`,
      message: `Your request for ${updatedOvertime.hours} hours of overtime on ${dateStr} has been ${status.toLowerCase()}.`,
      type: status === "APPROVED" ? "SUCCESS" : "ERROR",
      link: "/dashboard/employee/leaves"
    });

    revalidatePath("/dashboard/employee");
    revalidatePath("/dashboard/employee/leaves");
    revalidatePath("/dashboard/accountant");
    revalidatePath("/dashboard/leaves/manage");
    return { success: true };
  } catch (error) {
    console.error("Failed to process overtime status:", error);
    return { error: "Failed to update overtime status" };
  }
}

export const cancelOvertimeRequest = cancelOvertime;