"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Priority } from "@prisma/client";

export async function getAnnouncements(departmentId?: string) {
  try {
    const session = await getServerSession(authOptions);
    const tenantId = session?.user?.tenantId;

    const announcements = await prisma.announcement.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        OR: [
          { departmentId: null },
          ...(departmentId ? [{ departmentId }] : []),
        ],
      },
      include: {
        creator: {
          select: { name: true, email: true }
        },
        department: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    let readIds = new Set<string>();
    if (session?.user?.id) {
      const reads = await prisma.announcementRead.findMany({
        where: { userId: session.user.id },
        select: { announcementId: true }
      });
      reads.forEach(r => readIds.add(r.announcementId));
    }

    const dataWithReadStatus = announcements.map(a => ({
      ...a,
      isRead: readIds.has(a.id)
    }));

    return { success: true, data: dataWithReadStatus };
  } catch (error) {
    console.error("Failed to fetch announcements:", error);
    return { success: false, error: "Failed to fetch announcements", data: [] };
  }
}

export async function createAnnouncement(data: {
  title: string;
  content: string;
  priority: Priority;
  departmentId?: string | null;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.tenantId) return { success: false, error: "Unauthorized" };

  try {
    const tenantId = session.user.tenantId;
    const announcement = await prisma.announcement.create({
      data: {
        tenantId,
        title: data.title,
        content: data.content,
        priority: data.priority,
        departmentId: data.departmentId || null,
        createdById: session.user.id,
      },
    });

    // Notify targeted users
    const usersToNotify = await prisma.user.findMany({
      where: {
        tenantId,
        ...(data.departmentId ? { departmentId: data.departmentId } : {}),
      },
      select: { id: true }
    });

    if (usersToNotify.length > 0) {
      const priorityLabel = data.priority === "URGENT" ? "Urgent: " : "";
      await prisma.notification.createMany({
        data: usersToNotify.map(u => ({
          tenantId,
          userId: u.id,
          title: `${priorityLabel}New Announcement`,
          message: data.title,
          type: data.priority === "URGENT" ? "WARNING" : "INFO",
          link: "/dashboard/announcements",
        }))
      });
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin/settings");
    revalidatePath("/dashboard/accountant/settings");
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/employee");
    return { success: true, data: announcement };
  } catch (error) {
    console.error("Failed to create announcement:", error);
    return { success: false, error: "Failed to create announcement" };
  }
}

export async function deleteAnnouncement(id: string) {
  try {
    await prisma.announcement.delete({
      where: { id },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin/settings");
    revalidatePath("/dashboard/accountant/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete announcement:", error);
    return { success: false, error: "Failed to delete announcement" };
  }
}

export async function updateAnnouncement(id: string, data: {
  title: string;
  content: string;
  priority: Priority;
  departmentId?: string | null;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.announcement.update({
      where: { id },
      data: {
        title: data.title,
        content: data.content,
        priority: data.priority,
        departmentId: data.departmentId,
      },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/announcements");
    revalidatePath("/dashboard/admin/settings");
    revalidatePath("/dashboard/accountant/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to update announcement:", error);
    return { success: false, error: "Failed to update announcement" };
  }
}

export async function getAllAnnouncementsForAdmin() {
  try {
    const session = await getServerSession(authOptions);
    const tenantId = session?.user?.tenantId;

    const announcements = await prisma.announcement.findMany({
      where: tenantId ? { tenantId } : {},
      include: {
        creator: { select: { name: true, email: true } },
        department: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" },
    });

    let readIds = new Set<string>();
    if (session?.user?.id) {
      const reads = await prisma.announcementRead.findMany({
        where: { userId: session.user.id },
        select: { announcementId: true }
      });
      reads.forEach(r => readIds.add(r.announcementId));
    }

    const dataWithReadStatus = announcements.map(a => ({
      ...a,
      isRead: readIds.has(a.id)
    }));

    return { success: true, data: dataWithReadStatus };
  } catch (error) {
    return { success: false, error: "Failed to fetch all announcements", data: [] };
  }
}

export async function markAnnouncementAsRead(announcementId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.announcementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId,
          userId: session.user.id,
        }
      },
      update: {},
      create: {
        announcementId,
        userId: session.user.id,
      }
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to mark announcement as read:", error);
    return { success: false, error: "Failed to mark as read" };
  }
}

export async function markAllAnnouncementsAsRead(announcementIds: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.$transaction(
      announcementIds.map(id => 
        prisma.announcementRead.upsert({
          where: {
            announcementId_userId: {
              announcementId: id,
              userId: session.user.id,
            }
          },
          update: {},
          create: {
            announcementId: id,
            userId: session.user.id,
          }
        })
      )
    );
    return { success: true };
  } catch (error) {
    console.error("Failed to mark all announcements as read:", error);
    return { success: false, error: "Failed to mark all as read" };
  }
}
