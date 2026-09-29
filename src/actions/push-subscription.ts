"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { revalidatePath } from "next/cache";

export async function subscribeToPush(subscription: any, userAgent?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const { endpoint, keys } = subscription;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return { success: false, error: "Invalid subscription" };
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent || null,
        userId: session.user.id,
      },
      create: {
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent || null,
        userId: session.user.id,
      },
    });

    // Enforce max 2 devices per user
    const userSubscriptions = await prisma.pushSubscription.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (userSubscriptions.length > 2) {
      const subscriptionsToDelete = userSubscriptions.slice(2).map(sub => sub.id);
      await prisma.pushSubscription.deleteMany({
        where: {
          id: { in: subscriptionsToDelete },
        },
      });
    }

    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (error) {
    console.error("Failed to subscribe to push:", error);
    return { success: false, error: "Failed to subscribe" };
  }
}

export async function unsubscribeFromPush(endpoint: string) {
  try {
    await prisma.pushSubscription.delete({
      where: { endpoint },
    });
    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (error) {
    console.error("Failed to unsubscribe from push:", error);
    return { success: false, error: "Failed to unsubscribe" };
  }
}

export async function getActiveDevices() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const devices = await prisma.pushSubscription.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userAgent: true,
        createdAt: true,
      }
    });
    return { success: true, data: devices };
  } catch (error) {
    console.error("Failed to get active devices:", error);
    return { success: false, error: "Failed to get active devices" };
  }
}

export async function revokeDevice(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.pushSubscription.deleteMany({
      where: { 
        id,
        userId: session.user.id // ensure they only delete their own
      },
    });
    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (error) {
    console.error("Failed to revoke device:", error);
    return { success: false, error: "Failed to revoke device" };
  }
}
