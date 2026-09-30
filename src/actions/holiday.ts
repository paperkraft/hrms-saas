"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getHolidays() {
  try {
    const session = await getServerSession(authOptions);
    const tenantId = session?.user?.tenantId;

    const holidays = await prisma.publicHoliday.findMany({
      where: tenantId
        ? { OR: [{ tenantId }, { tenantId: null }] }
        : undefined,
      orderBy: { date: "asc" },
    });
    return { success: true, data: holidays };
  } catch (error) {
    console.error("Failed to fetch holidays:", error);
    return { success: false, error: "Failed to fetch holidays" };
  }
}

export async function addHoliday(name: string, date: Date) {
  try {
    const session = await getServerSession(authOptions);
    const tenantId = session?.user?.tenantId;

    const holiday = await prisma.publicHoliday.create({
      data: {
        tenantId,
        name,
        date,
      },
    });
    revalidatePath("/dashboard/admin/settings");
    revalidatePath("/dashboard/accountant/settings");
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/employee");
    revalidatePath("/dashboard/calendar");
    return { success: true, data: holiday };
  } catch (error: any) {
    console.error("Failed to add holiday:", error);
    if (error?.code === "P2002") {
      return { success: false, error: "A holiday already exists on this date." };
    }
    return { success: false, error: "Failed to add holiday" };
  }
}

export async function updateHoliday(id: string, name: string, date: Date) {
  try {
    const session = await getServerSession(authOptions);
    const tenantId = session?.user?.tenantId;

    const existing = await prisma.publicHoliday.findFirst({
      where: {
        id,
        ...(tenantId ? { tenantId } : {})
      }
    });

    if (!existing) {
      return { success: false, error: "Holiday not found or unauthorized." };
    }

    const holiday = await prisma.publicHoliday.update({
      where: { id },
      data: {
        name,
        date,
      },
    });
    revalidatePath("/dashboard/admin/settings");
    revalidatePath("/dashboard/accountant/settings");
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/employee");
    revalidatePath("/dashboard/calendar");
    return { success: true, data: holiday };
  } catch (error: any) {
    console.error("Failed to update holiday:", error);
    if (error?.code === "P2002") {
      return { success: false, error: "A holiday already exists on this date." };
    }
    return { success: false, error: "Failed to update holiday" };
  }
}

export async function deleteHoliday(id: string) {
  try {
    const session = await getServerSession(authOptions);
    const tenantId = session?.user?.tenantId;

    const existing = await prisma.publicHoliday.findFirst({
      where: {
        id,
        ...(tenantId ? { tenantId } : {})
      }
    });

    if (!existing) {
      return { success: false, error: "Holiday not found or unauthorized." };
    }

    await prisma.publicHoliday.delete({
      where: { id },
    });
    revalidatePath("/dashboard/admin/settings");
    revalidatePath("/dashboard/accountant/settings");
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/employee");
    revalidatePath("/dashboard/calendar");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete holiday:", error);
    return { success: false, error: "Failed to delete holiday" };
  }
}

export async function getUpcomingHolidays(limit: number = 5) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  try {
    const session = await getServerSession(authOptions);
    const tenantId = session?.user?.tenantId;

    const holidays = await prisma.publicHoliday.findMany({
      where: {
        ...(tenantId ? { OR: [{ tenantId }, { tenantId: null }] } : {}),
        date: {
          gte: now,
        },
      },
      orderBy: { date: "asc" },
      take: limit,
    });
    return { success: true, data: holidays };
  } catch (error) {
    console.error("Failed to fetch upcoming holidays:", error);
    return { success: false, error: "Failed to fetch upcoming holidays" };
  }
}
