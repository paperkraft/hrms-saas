"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { getTodayRange } from "@/lib/attendance-helper";
import { getPayrollEligibleUserWhere } from "@/lib/payroll-helper";
import webpush from "web-push";

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      `mailto:${process.env.ADMIN_EMAIL || "noreply@infraplan.co.in"}`,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } catch (e) {
    console.warn("Web push VAPID setup skipped:", (e as any)?.message);
  }
}

export async function getNotifications(limit?: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const { start, end } = getTodayRange();
    const tenantId = session.user.tenantId;

    const [notifications, user, config, todaysLog] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId: session.user.id,
          ...(tenantId ? { tenantId } : {})
        },
        orderBy: { createdAt: "desc" },
        ...(limit ? { take: limit } : {}),
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          location: { select: { startTime: true, endTime: true } }
        }
      }),
      tenantId ? prisma.systemConfig.findUnique({ where: { tenantId } }) : null,
      prisma.attendance.findFirst({
        where: {
          userId: session.user.id,
          ...(tenantId ? { tenantId } : {}),
          date: { gte: start, lte: end }
        }
      })
    ]);

    const startTime = user?.location?.startTime || config?.defaultOfficeStartTime || "09:00";
    const endTime = user?.location?.endTime || config?.defaultOfficeEndTime || "18:00";

    const formattedNotifications = notifications.map(n => ({
      ...n,
      content: n.message,
      isRead: n.read,
    }));

    return { 
      success: true, 
      data: formattedNotifications as any[],
      attendance: {
        startTime,
        endTime,
        hasPunchedIn: !!todaysLog,
        hasPunchedOut: !!todaysLog?.punchOut
      }
    };
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return { success: false, error: "Failed to fetch notifications", data: [] };
  }
}

function isCheckInOutNotification(title?: string): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return (
    lower.includes("check-in") ||
    lower.includes("check-out") ||
    lower.includes("checkin") ||
    lower.includes("checkout") ||
    lower.includes("punch-in") ||
    lower.includes("punch-out")
  );
}

export async function createNotification(data: {
  userId: string;
  title: string;
  content?: string;
  message?: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "ERROR" | string;
  link?: string;
  tenantId?: string;
}) {
  try {
    let targetUserId = data.userId;

    if (!targetUserId || targetUserId === "current") {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) return { success: false, error: "Unauthorized" };
      targetUserId = session.user.id;
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        tenantId: true,
        isExternal: true,
        role: true,
        roleDefinition: {
          select: { isExternal: true, code: true }
        }
      }
    });

    if (!targetUser) return { success: false, error: "User not found" };

    // Suppress check in/out notifications for external users
    if (isCheckInOutNotification(data.title)) {
      if (
        targetUser.isExternal ||
        targetUser.roleDefinition?.isExternal ||
        targetUser.roleDefinition?.code === "EXTERNAL_USER"
      ) {
        return { success: true, message: "Suppressed check in/out notification for external user" };
      }
    }

    const tenantId = data.tenantId || targetUser.tenantId;
    const messageContent = data.message || data.content || "";

    const notification = await prisma.notification.create({
      data: {
        tenantId,
        userId: targetUserId,
        title: data.title,
        message: messageContent,
        type: data.type || "INFO",
        link: data.link,
      },
    });
    revalidatePath("/dashboard");

    // Send Web Push Notification
    try {
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId: targetUserId }
      });

      const payload = JSON.stringify({
        title: data.title,
        content: messageContent,
        link: data.link || "/dashboard"
      });

      const pushPromises = subscriptions.map(sub => 
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payload
        ).catch(async (err: any) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          } else {
            console.error(`[Push] Error sending to ${sub.endpoint.slice(0, 30)}...:`, err.statusCode || err.message);
          }
        })
      );
      
      await Promise.allSettled(pushPromises);
    } catch (pushError) {
      console.error("Failed to process web push:", pushError);
    }

    return { success: true, data: notification };
  } catch (error) {
    console.error("Failed to create notification:", error);
    return { success: false, error: "Failed to create notification" };
  }
}

export async function createManyNotifications(notifications: {
  userId: string;
  title: string;
  content?: string;
  message?: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "ERROR" | string;
  link?: string;
  tenantId?: string;
}[]) {
  try {
    if (!notifications || notifications.length === 0) return { success: true };

    const userIds = Array.from(new Set(notifications.map(n => n.userId)));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        tenantId: true,
        isExternal: true,
        role: true,
        roleDefinition: {
          select: { isExternal: true, code: true }
        }
      }
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    let formattedData = notifications
      .map(n => {
        const u = userMap.get(n.userId);
        if (!u) return null;
        return {
          tenantId: n.tenantId || u.tenantId,
          userId: n.userId,
          title: n.title,
          message: n.message || n.content || "",
          type: n.type || "INFO",
          link: n.link,
          user: u,
        };
      })
      .filter((n): n is NonNullable<typeof n> => n !== null);

    // Suppress check in/out notifications for external users
    formattedData = formattedData.filter(n => {
      if (!isCheckInOutNotification(n.title)) return true;
      return !(
        n.user.isExternal ||
        n.user.roleDefinition?.isExternal ||
        n.user.roleDefinition?.code === "EXTERNAL_USER"
      );
    });

    if (formattedData.length === 0) return { success: true };

    await prisma.notification.createMany({
      data: formattedData.map(({ user, ...rest }) => rest),
    });
    
    revalidatePath("/dashboard");

    // Send Web Push Notifications
    const allPushPromises: Promise<any>[] = [];
    
    for (const data of formattedData) {
      try {
        const subscriptions = await prisma.pushSubscription.findMany({
          where: { userId: data.userId }
        });
        
        if (subscriptions.length === 0) continue;

        const payload = JSON.stringify({
          title: data.title,
          content: data.message,
          link: data.link || "/dashboard"
        });

        for (const sub of subscriptions) {
          allPushPromises.push(
            webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth
                }
              },
              payload
            ).catch(async (err: any) => {
              if (err.statusCode === 410 || err.statusCode === 404) {
                await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
              }
            })
          );
        }
      } catch (pushError) {
        console.error("Failed to process web push for user:", data.userId, pushError);
      }
    }
    
    await Promise.allSettled(allPushPromises);

    return { success: true };
  } catch (error) {
    console.error("Failed to create notifications:", error);
    return { success: false, error: "Failed to create notifications" };
  }
}

export async function markAsRead(id: string) {
  try {
    await prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    return { success: false, error: "Failed to mark as read" };
  }
}

export async function markAllAsRead() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    });
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Failed to mark all notifications as read:", error);
    return { success: false, error: "Failed to mark all as read" };
  }
}

export async function deleteNotification(id: string) {
  try {
    await prisma.notification.delete({
      where: { id },
    });
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete notification:", error);
    return { success: false, error: "Failed to delete notification" };
  }
}

export async function clearAllNotifications() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.notification.deleteMany({
      where: { userId: session.user.id },
    });
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Failed to clear notifications:", error);
    return { success: false, error: "Failed to clear notifications" };
  }
}

export async function notifyIncompleteProfiles() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEAM_LEADER")) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const incompleteUsers = await prisma.user.findMany({
      where: {
        ...(session.user.tenantId ? { tenantId: session.user.tenantId } : {}),
        ...getPayrollEligibleUserWhere({
          OR: [
            { phoneNumber: null }, { phoneNumber: "" },
            { dateOfBirth: null },
            { emergencyContactName: null }, { emergencyContactName: "" },
            { emergencyContactPhone: null }, { emergencyContactPhone: "" },
            { emergencyContactRelation: null }, { emergencyContactRelation: "" }
          ]
        })
      },
      select: { id: true, name: true, email: true, tenantId: true }
    });

    if (incompleteUsers.length === 0) {
      return { success: true, message: "No incomplete profiles found." };
    }

    const notificationsToCreate = incompleteUsers.map(user => ({
      tenantId: user.tenantId,
      userId: user.id,
      title: "Update Your Profile",
      message: `Hi ${user.name || user.email.split('@')[0]}, please complete your profile details (Phone, DOB, Emergency Contact) to help us keep your records up to date.`,
      type: "WARNING" as const,
      link: "/dashboard"
    }));

    await createManyNotifications(notificationsToCreate);

    return { success: true, count: incompleteUsers.length };
  } catch (error) {
    console.error("Failed to notify incomplete profiles:", error);
    return { success: false, error: "An error occurred while sending notifications" };
  }
}

export async function triggerManualNotificationCleanup() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "ADMIN")) {
    return { success: false, error: "Unauthorized: Admin access required" };
  }

  try {
    const { cleanupOldNotifications } = await import("@/lib/cleanup-notifications");
    const stats = await cleanupOldNotifications();
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/notifications");
    return { success: true, stats };
  } catch (error: any) {
    console.error("Manual notification cleanup failed:", error);
    return { success: false, error: error.message || "Failed to execute cleanup" };
  }
}
