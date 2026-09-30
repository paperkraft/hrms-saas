"use server"

import prisma from "@/lib/prisma"

import { isManagerOrAdmin } from "./utils";
import { getSession, isTLorManager, calculateWorkload } from "./core";
/**
 * Returns all pending tasks for the current user (PROPOSED / NEGOTIATING).
 * Used by the employee's "Pending Your Response" inbox widget.
 */
export async function getMyPendingTasks() {
  try {
    const session = await getSession()
    const tenantId = session.user.tenantId

    const tasks = await prisma.task.findMany({
      where: {
        assignedToId: session.user.id,
        lifecycleStatus: { in: ["PROPOSED", "NEGOTIATING"] },
        ...(tenantId ? { tenantId } : {})
      },
      include: {
        project: { select: { id: true, name: true } },
        proposedBy: { select: { id: true, name: true, avatarUrl: true } },
        creator: { select: { id: true, name: true, avatarUrl: true } },
        comments: {
          where: { type: { in: ["NEGOTIATION", "WORKLOAD_CONCERN", "REASSIGNMENT_REQUEST", "FORCE_COMMIT", "ACCEPTANCE"] } },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { user: { select: { name: true } } }
        }
      },
      orderBy: { proposedAt: "asc" }
    })

    // Attach current workload for context
    const workload = await calculateWorkload(session.user.id)

    return { success: true, data: tasks, workload }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Returns all proposed tasks awaiting employee response — for manager/TL view.
 */
export async function getProposedTasksForManager() {
  try {
    const session = await getSession()
    const tenantId = session.user.tenantId
    const canView = await isTLorManager(session.user.id, session.user.role)
    if (!canView) throw new Error("Access Denied")

    const isAdmin = isManagerOrAdmin(session.user.role)

    let whereClause: any = {
      lifecycleStatus: { in: ["PROPOSED", "NEGOTIATING"] },
      ...(tenantId ? { tenantId } : {})
    }

    if (!isAdmin) {
      // TL only sees their dept / subordinates
      const deptLed = await prisma.department.findFirst({
        where: {
          teamLeaderId: session.user.id,
          ...(tenantId ? { tenantId } : {})
        }
      })
      const ledDeptId = deptLed?.id

      whereClause = {
        lifecycleStatus: { in: ["PROPOSED", "NEGOTIATING"] },
        ...(tenantId ? { tenantId } : {}),
        OR: [
          { proposedById: session.user.id },
          { createdById: session.user.id },
          ledDeptId ? { departmentId: ledDeptId } : undefined,
          ledDeptId ? { assignedTo: { departmentId: ledDeptId } } : undefined,
          { assignedTo: { managerId: session.user.id } }
        ].filter(Boolean)
      }
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        project: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, avatarUrl: true, designation: true } },
        proposedBy: { select: { id: true, name: true } },
        comments: {
          where: { type: { in: ["NEGOTIATION", "WORKLOAD_CONCERN", "REASSIGNMENT_REQUEST"] } },
          orderBy: { createdAt: "desc" },
          take: 3,
          include: { user: { select: { name: true } } }
        }
      },
      orderBy: { proposedAt: "asc" }
    })

    return { success: true, data: tasks }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}


