"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasMenuAccess } from "@/lib/permissions";

export async function applyForOvertime(data: {
  date: string;
  hours: number;
  reason: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
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
      where: { id: "GLOBAL_CONFIG" }
    });
    const maxHours = config?.maxOvertimeHoursPerDay || 4;

    if (data.hours > maxHours) {
      return { error: `Overtime cannot exceed ${maxHours} hours per day.` };
    }

    const applicant = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, managerId: true }
    });
    const applicantName = applicant?.name || session.user.name || "Employee";

    const newOvertime = await prisma.overtimeRequest.create({
      data: {
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
        AND: [
          { id: { not: session.user.id } },
          {
            OR: [
              { role: { in: ["ADMIN", "SYSTEM_ADMIN", "ACCOUNTANT"] } },
              { id: applicant?.managerId || undefined }
            ]
          }
        ]
      },
      select: { id: true, role: true, email: true }
    });

    if (usersToNotify.length > 0) {
      await prisma.notification.createMany({
        data: usersToNotify.map(u => {
          let link = "/dashboard";
          if (["ADMIN", "SYSTEM_ADMIN", "ACCOUNTANT"].includes(u.role)) {
            link = "/dashboard/accountant?tab=overtime";
          }
          return {
            userId: u.id,
            title: `Overtime Request: ${applicantName}`,
            content: `${applicantName} has requested ${data.hours} hours of overtime on ${dateStr}.`,
            type: "INFO",
            link
          };
        })
      });
    }

    await prisma.notification.create({
      data: {
        userId: session.user.id,
        title: "Overtime Request Submitted",
        content: `Your request for ${data.hours} hours of overtime on ${dateStr} is pending review.`,
        type: "INFO",
        link: "/dashboard"
      }
    });

    revalidatePath("/dashboard/employee");
    revalidatePath("/dashboard/employee/leaves");
    revalidatePath("/dashboard/accountant");
    revalidatePath("/dashboard/leaves/manage");
    return { success: true };
  } catch (error) {
    console.error("Failed to apply for overtime:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function cancelOvertimeRequest(overtimeId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
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
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  try {
    const overtime = await prisma.overtimeRequest.findUnique({
      where: { id: overtimeId },
      include: { user: true }
    });

    if (!overtime) {
      return { error: "Overtime request not found" };
    }

    const isAllowedRole = hasMenuAccess(session.user, "/dashboard/accountant", "/dashboard/leaves/manage");
    const isManager = overtime.user.managerId === session.user.id;

    const ledDept = await prisma.department.findFirst({
      where: { teamLeaderId: session.user.id }
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

    await prisma.notification.create({
      data: {
        userId: updatedOvertime.userId,
        title: `Overtime Request ${status.charAt(0) + status.slice(1).toLowerCase()}`,
        content: `Your request for ${updatedOvertime.hours} hours of overtime on ${dateStr} has been ${status.toLowerCase()}.`,
        type: status === "APPROVED" ? "SUCCESS" : "ERROR",
        link: "/dashboard/employee/leaves"
      }
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