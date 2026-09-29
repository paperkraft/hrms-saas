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
    if (!session) throw new Error("Unauthorized")

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SYSTEM_ADMIN"
    
    // Check if user is a Department Leader (TL)
    const deptLed = await prisma.department.findFirst({
      where: { teamLeaderId: session.user.id },
      include: { members: { select: { id: true } } }
    })
    const isTL = !!deptLed
    const deptMemberIds = deptLed?.members.map(m => m.id) || []

    let whereClause: any = {}
    
    // Privacy Logic:
    // 1. Admin sees everything
    // 2. TL sees their own and their team's activity
    // 3. Employees see only their own activity
    if (!isAdmin) {
      if (isTL) {
        whereClause = {
          userId: { in: [session.user.id, ...deptMemberIds] }
        }
      } else {
        whereClause = { userId: session.user.id }
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
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new Error("Unauthorized")

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SYSTEM_ADMIN"
    
    const deptLed = await prisma.department.findFirst({
      where: { teamLeaderId: session.user.id },
      include: { members: { select: { id: true } } }
    })
    const isTL = !!deptLed
    const deptMemberIds = deptLed?.members.map(m => m.id) || []

    let whereClause: any = {}
    
    if (!isAdmin) {
      if (isTL) {
        whereClause = {
          userId: { in: [session.user.id, ...deptMemberIds] }
        }
      } else {
        whereClause = { userId: session.user.id }
      }
    }

    const validSortFields = ["createdAt", "action"]
    const validSortOrder = ["asc", "desc"]
    
    const actualSortBy = validSortFields.includes(sortBy) ? sortBy : "createdAt"
    const actualSortOrder = validSortOrder.includes(sortOrder.toLowerCase()) ? sortOrder.toLowerCase() : "desc"

    const orderByClause: any = { [actualSortBy]: actualSortOrder }

    const [logs, total] = await Promise.all([
      prisma.activityLogArchive.findMany({
        where: whereClause,
        orderBy: orderByClause,
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.activityLogArchive.count({ where: whereClause })
    ])

    // Manually fetch related entities
    const userIds = [...new Set(logs.map((l: any) => l.userId))]
    const projectIds = [...new Set(logs.map((l: any) => l.projectId).filter(Boolean) as string[])]
    const taskIds = [...new Set(logs.map((l: any) => l.taskId).filter(Boolean) as string[])]

    const [users, projects, tasks] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, avatarUrl: true } }),
      prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true } }),
      prisma.task.findMany({ where: { id: { in: taskIds } }, select: { id: true, name: true } })
    ])

    const userMap = Object.fromEntries(users.map((u: any) => [u.id, u]))
    const projectMap = Object.fromEntries(projects.map((p: any) => [p.id, p]))
    const taskMap = Object.fromEntries(tasks.map((t: any) => [t.id, t]))

    const enrichedLogs = logs.map((log: any) => ({
      ...log,
      user: userMap[log.userId] || null,
      project: log.projectId ? projectMap[log.projectId] || null : null,
      task: log.taskId ? taskMap[log.taskId] || null : null
    }))

    if (sortBy === "user") {
      enrichedLogs.sort((a, b) => {
        const valA = a.user?.name || ""
        const valB = b.user?.name || ""
        return actualSortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA)
      })
    } else if (sortBy === "project") {
      enrichedLogs.sort((a, b) => {
        const valA = a.project?.name || ""
        const valB = b.project?.name || ""
        return actualSortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA)
      })
    } else if (sortBy === "task") {
      enrichedLogs.sort((a, b) => {
        const valA = a.task?.name || ""
        const valB = b.task?.name || ""
        return actualSortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA)
      })
    }

    return { success: true, data: enrichedLogs, total }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function deleteActivityLog(id: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new Error('Unauthorized')

    await prisma.activityLog.delete({
      where: { id }
    })
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function bulkDeleteActivityLogs(ids: string[]) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new Error('Unauthorized')

    await prisma.activityLog.deleteMany({
      where: { id: { in: ids } }
    })
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function triggerManualArchive() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "SYSTEM_ADMIN")) {
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
    if (!session) throw new Error("Unauthorized")

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SYSTEM_ADMIN"

    const deptLed = await prisma.department.findFirst({
      where: { teamLeaderId: session.user.id },
      include: { members: { select: { id: true } } }
    })
    const isTL = !!deptLed
    const deptMemberIds = deptLed?.members.map(m => m.id) || []

    let whereClause: any = {}
    if (!isAdmin) {
      if (isTL) {
        whereClause = { userId: { in: [session.user.id, ...deptMemberIds] } }
      } else {
        whereClause = { userId: session.user.id }
      }
    }

    const [activeTotal, archivedTotal, createsCount, updatesCount, deletesCount] = await Promise.all([
      prisma.activityLog.count({ where: whereClause }),
      prisma.activityLogArchive.count({ where: whereClause }),
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
        archivedTotal,
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