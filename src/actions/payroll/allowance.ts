"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasMenuAccess } from "@/lib/permissions";

export async function requestAllowance(data: {
  fromDate: string;
  toDate: string;
  location: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  try {
    const fromDate = new Date(data.fromDate);
    const toDate = new Date(data.toDate);

    if (fromDate > toDate) {
      return { error: "From date cannot be after To date" };
    }

    const allowance = await prisma.allowance.create({
      data: {
        userId: session.user.id,
        fromDate,
        toDate,
        location: data.location,
        status: "PENDING",
      },
      include: {
        user: true,
      }
    });

    // Notify Accountant/Admin
    const accountants = await prisma.user.findMany({
      where: {
        role: { in: ["ACCOUNTANT", "ADMIN"] }
      },
      select: { id: true }
    });

    const startStr = fromDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const endStr = toDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const dateRange = startStr === endStr ? `for ${startStr}` : `from ${startStr} to ${endStr}`;

    for (const acc of accountants) {
      await prisma.notification.create({
        data: {
          userId: acc.id,
          title: "New Business Meet Allowance Request",
          content: `${allowance.user.name || allowance.user.email} requested allowance for ${data.location} (${dateRange}).`,
          type: "INFO",
          link: "/dashboard/accountant"
        }
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
  if (!session?.user) {
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

    if (allowance.status !== "PENDING" && !isPrivileged) {
      return { error: "Only pending allowance requests can be cancelled" };
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
  fromDate: string;
  toDate: string;
  location: string;
  status?: "APPROVED" | "PENDING" | "REJECTED";
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/accountant")) {
    return { error: "Unauthorized" };
  }

  try {
    const fromDate = new Date(data.fromDate);
    const toDate = new Date(data.toDate);

    await prisma.allowance.create({
      data: {
        userId: data.userId,
        fromDate,
        toDate,
        location: data.location,
        status: data.status || "APPROVED",
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
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/accountant")) {
    return { error: "Unauthorized" };
  }

  try {
    const updatedAllowance = await prisma.allowance.update({
      where: { id: allowanceId },
      data: { status },
      include: { user: true }
    });

    const startStr = new Date(updatedAllowance.fromDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const endStr = new Date(updatedAllowance.toDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const dateRange = startStr === endStr ? `on ${startStr}` : `from ${startStr} to ${endStr}`;

    await prisma.notification.create({
      data: {
        userId: updatedAllowance.userId,
        title: `Allowance Request ${status.charAt(0) + status.slice(1).toLowerCase()}`,
        content: `Your business meet allowance request for ${updatedAllowance.location} ${dateRange} has been ${status.toLowerCase()}.`,
        type: status === "APPROVED" ? "SUCCESS" : "ERROR",
        link: "/dashboard/employee/leaves"
      }
    });

    revalidatePath("/dashboard/employee");
    revalidatePath("/dashboard/accountant");
    return { success: true };
  } catch (error) {
    console.error("Failed to process allowance status:", error);
    return { error: "Failed to update allowance status" };
  }
}

export const applyForAllowance = requestAllowance;