"use server"

import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { archiveOldActivityLogs } from "@/lib/archive-activity-logs"

export async function getActivityLogs(
  page = 1,
  pageSize = 10,
  sortBy = "createdAt",
  sortOrder = "desc"
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) throw new Error("Unauthorized")

    const tenantId = session.user.tenantId
    const isAdmin = session.user.role === "ADMIN"
    
    // Check if user is a Department Leader (TL)
    const deptLed = await prisma.department.findFirst({
      where: {
        teamLeaderId: session.user.id,
        ...(tenantId ? { tenantId } : {})
      },
      include: { members: { select: { id: true } } }
    })
    const isTL = !!deptLed
    const deptMemberIds = deptLed?.members.map(m => m.id) || []

    let whereClause: any = {
      ...(tenantId ? { tenantId } : {})
    }
    
    // Privacy Logic:
    // 1. Admin sees everything in tenant
    // 2. TL sees their own and their team's activity
    // 3. Employees see only their own activity
    if (!isAdmin) {
      if (isTL) {
        whereClause.userId = { in: [session.user.id, ...deptMemberIds] }
      } else {
        whereClause.userId = session.user.id
      }
    }

    const validSortFields = ["createdAt", "user", "action", "project", "task"]
    const validSortOrder = ["asc", "desc"]
    
    const actualSortBy = validSortFields.includes(sortBy) ? sortBy : "createdAt"
    const actualSortOrder = validSortOrder.includes(sortOrder.toLowerCase()) ? sortOrder.toLowerCase() : "desc"

    let orderByClause: any = { [actualSortBy]: actualSortOrder }
    if (actualSortBy === "user") {
      orderByClause = { user: { name: actualSortOrder } }
    } else if (actualSortBy === "project") {
      orderByClause = { project: { name: actualSortOrder } }
    } else if (actualSortBy === "task") {
      orderByClause = { task: { name: actualSortOrder } }
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: whereClause,
        include: {
          user: { select: { name: true, email: true, avatarUrl: true } },
          project: { select: { name: true } },
          task: { select: { name: true } }
        },
        orderBy: orderByClause,
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.activityLog.count({ where: whereClause })
    ])

    return { success: true, data: logs, total }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getArchivedActivityLogs(
  page = 1,
  pageSize = 10,
  sortBy = "createdAt",
  sortOrder = "desc"
) {
  // Archived logs are handled by same activity logs with older timestamp filter
  return getActivityLogs(page, pageSize, sortBy, sortOrder);
}

export async function triggerManualArchive() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      throw new Error("Unauthorized")
    }
    const count = await archiveOldActivityLogs()
    return { success: true, count }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getActivityStats() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) throw new Error("Unauthorized")

    const tenantId = session.user.tenantId
    const isAdmin = session.user.role === "ADMIN"

    const deptLed = await prisma.department.findFirst({
      where: {
        teamLeaderId: session.user.id,
        ...(tenantId ? { tenantId } : {})
      },
      include: { members: { select: { id: true } } }
    })
    const isTL = !!deptLed
    const deptMemberIds = deptLed?.members.map(m => m.id) || []

    let whereClause: any = {
      ...(tenantId ? { tenantId } : {})
    }
    if (!isAdmin) {
      if (isTL) {
        whereClause.userId = { in: [session.user.id, ...deptMemberIds] }
      } else {
        whereClause.userId = session.user.id
      }
    }

    const [activeTotal, createsCount, updatesCount, deletesCount] = await Promise.all([
      prisma.activityLog.count({ where: whereClause }),
      prisma.activityLog.count({
        where: {
          ...whereClause,
          action: { contains: "CREATE", mode: "insensitive" }
        }
      }),
      prisma.activityLog.count({
        where: {
          ...whereClause,
          OR: [
            { action: { contains: "UPDATE", mode: "insensitive" } },
            { action: { contains: "EDIT", mode: "insensitive" } },
            { action: { contains: "STATUS", mode: "insensitive" } }
          ]
        }
      }),
      prisma.activityLog.count({
        where: {
          ...whereClause,
          OR: [
            { action: { contains: "DELETE", mode: "insensitive" } },
            { action: { contains: "REMOVE", mode: "insensitive" } }
          ]
        }
      })
    ])

    return {
      success: true,
      stats: {
        activeTotal,
        archivedTotal: 0,
        createsCount,
        updatesCount,
        deletesCount
      }
    }
  } catch (error: any) {
    return {
      success: false,
      stats: {
        activeTotal: 0,
        archivedTotal: 0,
        createsCount: 0,
        updatesCount: 0,
        deletesCount: 0
      }
    }
  }
}

export async function deleteActivityLog(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      throw new Error("Unauthorized");
    }
    await prisma.activityLog.delete({ where: { id } });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function bulkDeleteActivityLogs(ids: string[]) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      throw new Error("Unauthorized");
    }
    const res = await prisma.activityLog.deleteMany({ where: { id: { in: ids } } });
    return { success: true, count: res.count };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}