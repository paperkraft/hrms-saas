"use server"
import { isManagerOrAdmin } from "./utils";

import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// ── Auth helpers ──────────────────────────────────────────────────────────────

export async function getSession() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error("Unauthorized")
  return session
}

export async function isTLorManager(userId: string, role: string) {
  if (isManagerOrAdmin(role)) return true
  const dept = await prisma.department.findFirst({ where: { teamLeaderId: userId } })
  if (dept) return true
  const sub = await prisma.user.findFirst({ where: { managerId: userId } })
  return !!sub
}

// ── Workload Calculation Engine ───────────────────────────────────────────────

const STANDARD_WEEKLY_HOURS = 48

export async function calculateWorkload(userId: string) {
  const now = new Date()

  const activeTasks = await prisma.task.findMany({
    where: {
      assignedToId: userId,
      status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] },
      lifecycleStatus: "COMMITTED"
    },
    select: {
      id: true,
      status: true,
      lifecycleStatus: true,
      plannedDuration: true,
      progress: true,
      plannedEnd: true
    }
  })

  const overdueTasks = activeTasks.filter(t =>
    t.plannedEnd && t.plannedEnd < now && t.status !== "COMPLETED"
  ).length

  const committedTasks = activeTasks.filter(t => t.lifecycleStatus === "COMMITTED").length

  // Estimate remaining hours based on task duration.
  // Long-running tasks are usually low-intensity (e.g. 1h/day), short tasks are high-intensity (8h/day)
  let totalEstimatedHours = 0;
  let weeklyBurdenHours = 0;

  activeTasks.forEach((t) => {
    const days = t.plannedDuration ?? 1;
    let dailyHours = 8;
    
    if (days >= 20) {
      dailyHours = 1;
    } else if (days >= 10) {
      dailyHours = 2;
    } else if (days >= 5) {
      dailyHours = 4;
    }
    
    const remainingDays = days * (1 - (t.progress / 100));
    
    // Total backlog hours
    totalEstimatedHours += remainingDays * dailyHours;
    
    // How much of this task hits *this current week* (max 6 working days)
    const daysThisWeek = Math.min(6, remainingDays);
    weeklyBurdenHours += daysThisWeek * dailyHours;
  });

  // Capacity is based on how full their *current week* is, not their total backlog
  const rawCapacity = Math.round((weeklyBurdenHours / STANDARD_WEEKLY_HOURS) * 100);
  const capacityPct = Math.min(100, rawCapacity);

  return {
    activeTasks: activeTasks.length,
    committedTasks,
    estimatedHours: Math.round(totalEstimatedHours * 10) / 10,
    capacityPct,
    overdueTasks
  }
}

/**
 * Returns live workload data for a list of users.
 * Used by the assignment dialog to show the capacity panel.
 */
export async function getTeamWorkload(userIds: string[]) {
  try {
    await getSession()

    const snapshots = await Promise.all(
      userIds.map(async (userId) => {
        const workload = await calculateWorkload(userId)
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, designation: true }
        })
        return { user, workload }
      })
    )

    return { success: true, data: snapshots }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ── Internal snapshot helper ──────────────────────────────────────────────────

export async function takeWorkloadSnapshot(userId: string, tenantId?: string) {
  let resolvedTenantId = tenantId;
  if (!resolvedTenantId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
    resolvedTenantId = user?.tenantId;
  }
  if (!resolvedTenantId) return null;
  const workload = await calculateWorkload(userId)
  await prisma.workloadSnapshot.create({
    data: { tenantId: resolvedTenantId, userId, ...workload }
  })
  return workload
}

// ── Thread helper — structured comment creation ───────────────────────────────

export async function createThreadEntry({
  taskId,
  userId,
  content,
  type,
  proposedEnd,
  isPinned = false,
  attachments,
  mentionedUserIds = []
}: {
  taskId: string
  userId: string
  content: string
  type: string
  proposedEnd?: Date
  isPinned?: boolean
  attachments?: any
  mentionedUserIds?: string[]
}) {
  return prisma.taskComment.create({
    data: {
      taskId,
      userId,
      content,
      type,
      proposedEnd: proposedEnd ?? null,
      isPinned,
      attachments,
      mentionedUserIds
    }
  })
}

// ── Core commitment actions ───────────────────────────────────────────────────

