"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasMenuAccess } from "@/lib/permissions";
import { createNotification } from "@/actions/notification";

export async function requestAllowance(data: {
  date?: string | Date;
  fromDate?: string;
  toDate?: string;
  location?: string;
  amount?: number;
  type?: string;
  description?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.tenantId) {
    return { error: "Unauthorized" };
  }

  try {
    const rawDate = data.date || data.fromDate || new Date();
    const date = new Date(rawDate);
    const amount = data.amount ?? 350;
    const type = data.type || data.location || "Travel Allowance";
    const description = data.description || (data.location ? `Location: ${data.location}` : null);

    const allowance = await prisma.allowance.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        date,
        amount,
        type,
        description,
      },
      include: {
        user: true,
      }
    });

    // Notify Accountant / Admin
    const accountants = await prisma.user.findMany({
      where: {
        tenantId: session.user.tenantId,
        OR: [
          { role: "ADMIN" },
          { roleDefinition: { code: "ACCOUNTANT" } }
        ]
      },
      select: { id: true }
    });

    const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    for (const acc of accountants) {
      await createNotification({
        userId: acc.id,
        title: "New Allowance Request",
        message: `${allowance.user.name || allowance.user.email} submitted allowance (${type} - ₹${amount}) for ${dateStr}.`,
        type: "INFO",
        link: "/dashboard/accountant"
      });
    }

    revalidatePath("/dashboard/employee");
    revalidatePath("/dashboard/employee/leaves");
    revalidatePath("/dashboard/accountant");
    return { success: true };
  } catch (error) {
    console.error("Failed to request allowance:", error);
    return { error: "Failed to submit allowance request" };
  }
}

export async function cancelAllowance(allowanceId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.tenantId) {
    return { error: "Unauthorized" };
  }

  try {
    const allowance = await prisma.allowance.findUnique({
      where: { id: allowanceId },
    });

    if (!allowance) {
      return { error: "Allowance request not found" };
    }

    const isOwner = allowance.userId === session.user.id;
    const isPrivileged = hasMenuAccess(session.user, "/dashboard/accountant");

    if (!isOwner && !isPrivileged) {
      return { error: "Unauthorized to cancel this allowance request" };
    }

    await prisma.allowance.delete({
      where: { id: allowanceId },
    });

    revalidatePath("/dashboard/employee");
    revalidatePath("/dashboard/employee/leaves");
    revalidatePath("/dashboard/accountant");
    return { success: true };
  } catch (error) {
    console.error("Failed to cancel allowance request:", error);
    return { error: "Failed to cancel allowance request" };
  }
}

export async function createAllowance(data: {
  userId: string;
  date?: string | Date;
  fromDate?: string;
  toDate?: string;
  location?: string;
  amount?: number;
  type?: string;
  description?: string;
  status?: "APPROVED" | "PENDING" | "REJECTED";
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.tenantId || !hasMenuAccess(session.user, "/dashboard/accountant")) {
    return { error: "Unauthorized" };
  }

  try {
    const rawDate = data.date || data.fromDate || new Date();
    const date = new Date(rawDate);
    const amount = data.amount ?? 350;
    const type = data.type || data.location || "Travel Allowance";
    const description = data.description || (data.location ? `Location: ${data.location}` : null);

    await prisma.allowance.create({
      data: {
        tenantId: session.user.tenantId,
        userId: data.userId,
        date,
        amount,
        type,
        description,
      },
    });

    revalidatePath("/dashboard/accountant");
    return { success: true };
  } catch (error) {
    return { error: "An unexpected error occurred" };
  }
}

export async function processAllowanceStatus(
  allowanceId: string,
  status: "APPROVED" | "REJECTED"
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.tenantId || !hasMenuAccess(session.user, "/dashboard/accountant")) {
    return { error: "Unauthorized" };
  }

  try {
    const allowance = await prisma.allowance.findUnique({
      where: { id: allowanceId },
      include: { user: true }
    });

    if (!allowance) return { error: "Allowance not found" };

    if (status === "REJECTED") {
      await prisma.allowance.delete({
        where: { id: allowanceId }
      });
    }

    const dateStr = new Date(allowance.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    await createNotification({
      userId: allowance.userId,
      title: `Allowance Request ${status.charAt(0) + status.slice(1).toLowerCase()}`,
      message: `Your allowance request for ${allowance.type} on ${dateStr} has been ${status.toLowerCase()}.`,
      type: status === "APPROVED" ? "SUCCESS" : "ERROR",
      link: "/dashboard/employee/leaves"
    });

    revalidatePath("/dashboard/employee");
    revalidatePath("/dashboard/accountant");
    return { success: true };
  } catch (error) {
    console.error("Failed to process allowance status:", error);
    return { error: "Failed to process allowance status" };
  }
}

export const applyForAllowance = requestAllowance;