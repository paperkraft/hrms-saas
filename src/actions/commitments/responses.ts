"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { sseEmitter } from "@/lib/sse"
import { logActivity } from "@/lib/activity-logger"

import { createNotification } from "@/actions/notification"
import { getSession, isTLorManager, takeWorkloadSnapshot, createThreadEntry } from "./core";
/**
 * Employee responds to a proposed task.
 * action: "ACCEPT" | "WORKLOAD_CONCERN" | "REQUEST_REASSIGNMENT"
 */
export async function respondToTask(
  taskId: string,
  action: "ACCEPT" | "WORKLOAD_CONCERN" | "REQUEST_REASSIGNMENT",
  comment: string,
  options?: {
    proposedEnd?: Date          // For WORKLOAD_CONCERN
    reassignmentReason?: string // For REQUEST_REASSIGNMENT (ReassignmentReason enum value)
  }
) {
  try {
    const session = await getSession()

    if (!comment || comment.trim().length < 10) {
      throw new Error("A meaningful comment (minimum 10 characters) is required for all task responses.")
    }

    if (action === "REQUEST_REASSIGNMENT" && !options?.reassignmentReason) {
      throw new Error("A reason category is required when requesting reassignment.")
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: { select: { id: true, name: true } },
        proposedBy: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } }
      }
    })

    if (!task) throw new Error("Task not found")
    if (task.assignedToId !== session.user.id) {
      throw new Error("Only the assigned employee can respond to this task.")
    }
    if (task.lifecycleStatus === "COMMITTED") {
      throw new Error("This task is already committed and active.")
    }

    const managerUserId = task.proposedById || task.createdById
    const now = new Date()

    if (action === "ACCEPT") {
      // Snapshot workload at accept time
      await takeWorkloadSnapshot(session.user.id)

      await prisma.task.update({
        where: { id: taskId },
        data: {
          lifecycleStatus: "COMMITTED",
          employeeResponseAt: now,
          committedAt: now,
          status: "TODO"
        }
      })

      await createThreadEntry({
        taskId,
        userId: session.user.id,
        content: comment.trim(),
        type: "ACCEPTANCE"
      })

      await logActivity({
        projectId: task.projectId,
        taskId: task.id,
        userId: session.user.id,
        action: "TASK_ACCEPTED",
        details: `Task accepted — "${comment.trim()}"`
      })

      // Notify the proposer/creator
      if (managerUserId && managerUserId !== session.user.id) {
        await createNotification({
          userId: managerUserId,
          title: "Task Accepted",
          message: `${session.user.name} accepted "${task.name}"`,
          type: "SUCCESS",
          link: `/dashboard/projects/${task.projectId}?taskId=${task.id}`
        })
        sseEmitter.emit(`notify:${managerUserId}`)
      }

    } else if (action === "WORKLOAD_CONCERN") {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          lifecycleStatus: "NEGOTIATING",
          employeeResponseAt: now,
          negotiationCount: { increment: 1 }
        }
      })

      await createThreadEntry({
        taskId,
        userId: session.user.id,
        content: comment.trim(),
        type: "WORKLOAD_CONCERN",
        proposedEnd: options?.proposedEnd
      })

      await logActivity({
        projectId: task.projectId,
        taskId: task.id,
        userId: session.user.id,
        action: "TASK_WORKLOAD_CONCERN",
        details: `Workload concern raised — "${comment.trim()}"${options?.proposedEnd ? ` · Proposed deadline: ${options.proposedEnd.toLocaleDateString()}` : ""}`
      })

      if (managerUserId && managerUserId !== session.user.id) {
        await createNotification({
          userId: managerUserId,
          title: "Workload Concern Raised",
          message: `${session.user.name} raised a concern on "${task.name}" — "${comment.trim().substring(0, 80)}"`,
          type: "WARNING",
          link: `/dashboard/projects/${task.projectId}?taskId=${task.id}`
        })
        sseEmitter.emit(`notify:${managerUserId}`)
      }

    } else if (action === "REQUEST_REASSIGNMENT") {
      // Task stays PROPOSED — just notify manager
      await prisma.task.update({
        where: { id: taskId },
        data: {
          employeeResponseAt: now
        }
      })

      const reasonLabel: Record<string, string> = {
        OVERLOADED: "Currently Overloaded / Multi-tasked",
        NO_ACCESS: "Dependency or Access Missing",
        SKILL_MISMATCH: "Skill Mismatch / Experience Gap",
        LEAVE_PLANNED: "Planned Leave / Out of Office",
        OTHER: "Other"
      }

      const reason = options?.reassignmentReason || "OTHER"
      const reasonText = reasonLabel[reason] || reason

      await createThreadEntry({
        taskId,
        userId: session.user.id,
        content: `<p><strong>Reason:</strong> ${reasonText}</p><p>${comment.trim()}</p>`,
        type: "REASSIGNMENT_REQUEST"
      })

      await logActivity({
        projectId: task.projectId,
        taskId: task.id,
        userId: session.user.id,
        action: "TASK_REASSIGNMENT_REQUESTED",
        details: `Requested reassignment · Reason: ${reasonText} — "${comment.trim()}"`
      })

      if (managerUserId && managerUserId !== session.user.id) {
        await createNotification({
          userId: managerUserId,
          title: "Reassignment Requested",
          message: `${session.user.name} requested reassignment of "${task.name}" — Reason: ${reasonText}`,
          type: "WARNING",
          link: `/dashboard/projects/${task.projectId}?taskId=${task.id}`
        })
        sseEmitter.emit(`notify:${managerUserId}`)
      }
    }

    revalidatePath("/dashboard/projects")
    revalidatePath(`/dashboard/projects/${task.projectId}`)
    revalidatePath("/dashboard/projects/reports")

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}


/**
 * Employee accepts the current (possibly revised) terms after negotiation.
 */
export async function acceptNegotiation(taskId: string, comment: string) {
  try {
    const session = await getSession()

    if (!comment || comment.trim().length < 10) {
      throw new Error("A meaningful comment is required when accepting negotiated terms.")
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        proposedBy: { select: { id: true } },
        creator: { select: { id: true } }
      }
    })

    if (!task) throw new Error("Task not found")
    if (task.assignedToId !== session.user.id) {
      throw new Error("Only the assignee can accept negotiated terms.")
    }
    if (task.lifecycleStatus !== "NEGOTIATING") {
      throw new Error("Task is not in negotiation.")
    }

    const now = new Date()

    await prisma.task.update({
      where: { id: taskId },
      data: {
        lifecycleStatus: "COMMITTED",
        committedAt: now,
        employeeResponseAt: task.employeeResponseAt ?? now,
        status: "TODO"
      }
    })

    await createThreadEntry({
      taskId,
      userId: session.user.id,
      content: `✅ Accepted negotiated terms: ${comment.trim()}`,
      type: "ACCEPTANCE"
    })

    await logActivity({
      projectId: task.projectId,
      taskId: task.id,
      userId: session.user.id,
      action: "NEGOTIATION_ACCEPTED",
      details: `Accepted terms after ${task.negotiationCount} negotiation round(s) — "${comment.trim()}"`
    })

    const managerUserId = task.proposedById || task.createdById
    if (managerUserId && managerUserId !== session.user.id) {
      await createNotification({
        userId: managerUserId,
        title: "Task Committed",
        message: `${session.user.name} accepted and committed to "${task.name}" after discussion.`,
        type: "SUCCESS",
        link: `/dashboard/projects/${task.projectId}?taskId=${task.id}`
      })
      sseEmitter.emit(`notify:${managerUserId}`)
    }

    revalidatePath("/dashboard/projects")
    revalidatePath(`/dashboard/projects/${task.projectId}`)

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Manager/Admin accepts a deadline proposed by the employee during negotiation/concern.
 */
export async function acceptProposedDeadline(taskId: string, commentId: string) {
  try {
    const session = await getSession()

    const canAccept = await isTLorManager(session.user.id, session.user.role)
    if (!canAccept) {
      throw new Error("Authority Required: Only Team Leaders and Admins can accept a proposed deadline on behalf of the project.")
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignedTo: { select: { id: true, name: true } }
      }
    })

    if (!task) throw new Error("Task not found")

    const comment = await prisma.taskComment.findUnique({
      where: { id: commentId }
    })

    if (!comment || !comment.proposedEnd) {
      throw new Error("Valid proposed deadline not found.")
    }

    const newDeadline = comment.proposedEnd
    const now = new Date()

    await prisma.task.update({
      where: { id: taskId },
      data: {
        plannedEnd: newDeadline,
        lifecycleStatus: "COMMITTED",
        committedAt: now,
        status: "TODO"
      }
    })

    await createThreadEntry({
      taskId,
      userId: session.user.id,
      content: `<p>Accepted proposed deadline: <strong>${newDeadline.toLocaleDateString()}</strong></p>`,
      type: "ACCEPTANCE"
    })

    await logActivity({
      projectId: task.projectId,
      taskId: task.id,
      userId: session.user.id,
      action: "NEGOTIATION_ACCEPTED",
      details: `Accepted proposed deadline: ${newDeadline.toLocaleDateString()}`
    })

    if (task.assignedToId && task.assignedToId !== session.user.id) {
      await createNotification({
        userId: task.assignedToId,
        title: "Proposed Deadline Accepted",
        message: `Your proposed deadline for "${task.name}" has been accepted by ${session.user.name}. The task is now officially allocated to you.`,
        type: "SUCCESS",
        link: `/dashboard/projects/${task.projectId}?taskId=${task.id}`
      })
      sseEmitter.emit(`notify:${task.assignedToId}`)
    }

    revalidatePath("/dashboard/projects")
    revalidatePath(`/dashboard/projects/${task.projectId}`)

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Manager/Admin rejects a deadline proposed by the employee during negotiation/concern.
 */
export async function rejectProposedDeadline(taskId: string, commentId: string) {
  try {
    const session = await getSession()

    const canReject = await isTLorManager(session.user.id, session.user.role)
    if (!canReject) {
      throw new Error("Authority Required: Only Team Leaders and Admins can reject a proposed deadline.")
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId }
    })

    if (!task) throw new Error("Task not found")

    const comment = await prisma.taskComment.findUnique({
      where: { id: commentId }
    })

    if (!comment || !comment.proposedEnd) {
      throw new Error("Valid proposed deadline not found.")
    }

    // Mark the comment's type as rejected to strike it through in UI
    const rejectedType = comment.type === "WORKLOAD_CONCERN" ? "WORKLOAD_CONCERN_REJECTED" : "NEGOTIATION_REJECTED"

    await prisma.taskComment.update({
      where: { id: commentId },
      data: { type: rejectedType }
    })

    await logActivity({
      projectId: task.projectId,
      taskId: task.id,
      userId: session.user.id,
      action: "NEGOTIATION_REJECTED",
      details: `Rejected proposed deadline of ${comment.proposedEnd.toLocaleDateString()}`
    })

    revalidatePath("/dashboard/projects")
    revalidatePath(`/dashboard/projects/${task.projectId}`)

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Manager/Admin force-commits a task over any employee concern.
 * Requires a mandatory business reason.
 */
export async function forceCommitTask(taskId: string, reason: string) {
  try {
    const session = await getSession()

    if (!reason || reason.trim().length < 10) {
      throw new Error("A business reason (minimum 10 characters) is required for force-commit.")
    }

    const canForce = await isTLorManager(session.user.id, session.user.role)
    if (!canForce) {
      throw new Error("Authority Required: Only Team Leaders and Admins can force-commit a task.")
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignedTo: { select: { id: true, name: true } }
      }
    })

    if (!task) throw new Error("Task not found")
    if (task.lifecycleStatus === "COMMITTED") {
      throw new Error("Task is already committed.")
    }

    const now = new Date()

    await prisma.task.update({
      where: { id: taskId },
      data: {
        lifecycleStatus: "COMMITTED",
        committedAt: now,
        committedByOverride: true,
        status: "TODO"
      }
    })

    await createThreadEntry({
      taskId,
      userId: session.user.id,
      content: reason.trim(),
      type: "FORCE_COMMIT"
    })

    await logActivity({
      projectId: task.projectId,
      taskId: task.id,
      userId: session.user.id,
      action: "TASK_FORCE_COMMITTED",
      details: `Force-committed — "${reason.trim()}"`
    })

    // Notify the assignee
    if (task.assignedToId && task.assignedToId !== session.user.id) {
      await createNotification({
        userId: task.assignedToId,
        title: "Task Force-Committed",
        message: `${session.user.name} has committed "${task.name}" on your behalf — "${reason.trim().substring(0, 80)}"`,
        type: "WARNING",
        link: `/dashboard/projects/${task.projectId}?taskId=${task.id}`
      })
      sseEmitter.emit(`notify:${task.assignedToId}`)
    }

    revalidatePath("/dashboard/projects")
    revalidatePath(`/dashboard/projects/${task.projectId}`)

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

