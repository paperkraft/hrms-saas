"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { sseEmitter } from "@/lib/sse"
import { getLedDepartmentIds } from "@/actions/projects/core"

import { getSession, isTLorManager, createThreadEntry } from "./core";
import { logActivity } from "@/lib/activity-logger"
/**
 * Manager or employee adds a reply to a negotiation thread.
 */
export async function replyToThread(
  taskId: string,
  message: string,
  options?: {
    revisedEnd?: Date  // Manager may attach revised deadline
    attachments?: any
    mentionedUserIds?: string[]
  }
) {
  try {
    const session = await getSession()

    if (!message || message.trim().length < 5) {
      throw new Error("Reply must be at least 5 characters.")
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignedTo: { select: { id: true, name: true } },
        proposedBy: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        comments: { select: { userId: true, mentionedUserIds: true } }
      }
    })

    if (!task) throw new Error("Task not found")

    // Authorization: assignee, proposer, creator, or admin/TL
    const isAssignee = task.assignedToId === session.user.id
    const isProposerOrCreator = task.proposedById === session.user.id || task.createdById === session.user.id
    const adminOrTL = await isTLorManager(session.user.id, session.user.role)
    const isMentioned = task.comments?.some((c: any) => c.mentionedUserIds?.includes(session.user.id)) || (task.mentionedUserIds || []).includes(session.user.id)

    if (!isAssignee && !isProposerOrCreator && !adminOrTL && !isMentioned) {
      throw new Error("Access Denied: Only task participants can reply.")
    }

    const isMgr = isProposerOrCreator || adminOrTL

    // If manager is attaching a revised end date, update task
    if (isMgr && options?.revisedEnd) {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          plannedEnd: options.revisedEnd,
          negotiationCount: { increment: 1 }
        }
      })
    } else {
      await prisma.task.update({
        where: { id: taskId },
        data: { negotiationCount: { increment: 1 } }
      })
    }

    await createThreadEntry({
      taskId,
      userId: session.user.id,
      content: message.trim(),
      type: options?.revisedEnd ? "NEGOTIATION" : "DISCUSSION",
      proposedEnd: isMgr ? options?.revisedEnd : undefined,
      attachments: options?.attachments,
      mentionedUserIds: options?.mentionedUserIds
    })

    // Index mentioned user IDs directly on the task for high-performance indexed queries
    if (options?.mentionedUserIds && options.mentionedUserIds.length > 0) {
      const existing = (task as any).mentionedUserIds || []
      const toAdd = options.mentionedUserIds.filter(id => !existing.includes(id))
      if (toAdd.length > 0) {
        await prisma.task.update({
          where: { id: taskId },
          data: {
            mentionedUserIds: {
              push: toAdd
            }
          }
        })
      }
    }

    const isNegotiation = !!options?.revisedEnd

    await logActivity({
      projectId: task.projectId,
      taskId: task.id,
      userId: session.user.id,
      action: isNegotiation ? "NEGOTIATION_REPLY" : "TASK_COMMENT",
      details: isNegotiation
        ? `Added negotiation reply${isMgr ? ` · Proposed revised deadline: ${options?.revisedEnd?.toLocaleDateString()}` : ""}`
        : message.replace(/<[^>]*>?/gm, '').trim()
    })

    // Notify all participants
    const participantIds = new Set<string>()
    if (task.assignedToId) participantIds.add(task.assignedToId)
    if (task.proposedById) participantIds.add(task.proposedById)
    if (task.createdById) participantIds.add(task.createdById)
    if ((task as any).reviewerId) participantIds.add((task as any).reviewerId)
    task.comments?.forEach((c: any) => {
      if (c.userId) participantIds.add(c.userId)
    })

    // Remove the commenter themselves and anyone who is explicitly mentioned
    participantIds.delete(session.user.id)
    if (options?.mentionedUserIds) {
      options.mentionedUserIds.forEach((id: string) => participantIds.delete(id))
    }

    if (participantIds.size > 0) {
      await prisma.notification.createMany({
        data: Array.from(participantIds).map(userId => ({
          userId,
          title: "New Comment",
          content: `${session.user.name} commented on "${task.name}"`,
          type: "INFO",
          link: `/dashboard/projects/${task.projectId}?taskId=${task.id}`
        }))
      })
      Array.from(participantIds).forEach((uId: string) => sseEmitter.emit(`notify:${uId}`))
    }

    // Notify mentioned users
    if (options?.mentionedUserIds && options.mentionedUserIds.length > 0) {
      const mentions = options.mentionedUserIds.filter(id => id !== session.user.id);

      if (mentions.length > 0) {
        await prisma.notification.createMany({
          data: mentions.map(userId => ({
            userId,
            title: "You were mentioned in a Task",
            content: `${session.user.name} mentioned you in "${task.name}"`,
            type: "INFO",
            link: `/dashboard/projects/${task.projectId}?taskId=${task.id}`
          }))
        });
        mentions.forEach((uId: string) => sseEmitter.emit(`notify:${uId}`))
      }
    }

    revalidatePath("/dashboard/projects")
    revalidatePath(`/dashboard/projects/${task.projectId}`)

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
/**
 * Pin or unpin a thread entry. TL/Admin only.
 */
export async function pinThreadEntry(commentId: string) {
  try {
    const session = await getSession()
    const canPin = await isTLorManager(session.user.id, session.user.role)
    if (!canPin) throw new Error("Only Team Leaders and Admins can pin messages.")

    const comment = await prisma.taskComment.findUnique({ where: { id: commentId } })
    if (!comment) throw new Error("Comment not found")

    await prisma.taskComment.update({
      where: { id: commentId },
      data: { isPinned: !comment.isPinned }
    })

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Merges comments + activity logs into a unified chronological view.
 */
export async function getTaskThread(taskId: string) {
  try {
    await getSession()

    const [comments, activityLogs] = await Promise.all([
      prisma.taskComment.findMany({
        where: { taskId },
        include: { user: { select: { id: true, name: true, avatarUrl: true, role: true } } },
        orderBy: { createdAt: "asc" }
      }),
      prisma.activityLog.findMany({
        where: { taskId },
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" }
      })
    ])

    // Merge into a unified thread sorted by timestamp
    type ThreadEntry = {
      id: string
      entryType: "comment" | "event"
      type: string
      content: string
      user: any
      createdAt: Date
      isPinned?: boolean
      proposedEnd?: Date | null
      mentionedUserIds?: string[]
      attachments?: any
    }

    const commentEntries: ThreadEntry[] = comments.map(c => ({
      id: c.id,
      entryType: "comment" as const,
      type: c.type,
      content: c.content,
      user: c.user,
      createdAt: c.createdAt,
      isPinned: c.isPinned,
      proposedEnd: c.proposedEnd,
      mentionedUserIds: c.mentionedUserIds,
      attachments: c.attachments
    }))

    const eventEntries: ThreadEntry[] = activityLogs.map(l => ({
      id: l.id,
      entryType: "event" as const,
      type: "SYSTEM_EVENT",
      content: l.details || l.action,
      user: l.user,
      createdAt: l.createdAt
    }))

    const thread = [...commentEntries, ...eventEntries].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    )

    // Pinned entries float to top
    const pinned = thread.filter(e => e.isPinned)
    const rest = thread.filter(e => !e.isPinned)

    return { success: true, data: { pinned, thread: rest } }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function deleteThreadEntry(commentId: string) {
  try {
    const session = await getSession()
    const comment = await prisma.taskComment.findUnique({
      where: { id: commentId },
      include: { task: true }
    })
    if (!comment) throw new Error("Comment not found")

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SYSTEM_ADMIN"
    const isCreator = comment.userId === session.user.id

    if (!isAdmin && !isCreator) {
      const ledDepartmentIds = await getLedDepartmentIds(session.user.id)
      const isTL = comment.task.departmentId && ledDepartmentIds.includes(comment.task.departmentId)
      if (!isTL) {
        throw new Error("Access Denied: You can only delete your own comments.")
      }
    }

    if (comment.attachments) {
      try {
        const { removeOrphanedAttachment } = await import("@/actions/attachments")
        for (const att of (comment.attachments as any[])) {
          await removeOrphanedAttachment(att.url)
        }
      } catch (e) {
        console.error("Minio delete error", e)
      }
    }

        // Clean up associated notifications via timestamp bounding
    const timeThresholdStart = new Date(comment.createdAt.getTime() - 5000);
    const timeThresholdEnd = new Date(comment.createdAt.getTime() + 5000);
    
    await prisma.notification.deleteMany({
      where: {
        link: `/dashboard/projects/${comment.task.projectId}?taskId=${comment.task.id}`,
        title: {
          in: ["New Comment", "You were mentioned in a Task"]
        },
        createdAt: {
          gte: timeThresholdStart,
          lte: timeThresholdEnd
        }
      }
    });

    await prisma.taskComment.delete({ where: { id: commentId } })

    revalidatePath("/dashboard/projects")
    if (comment.task?.projectId) {
      revalidatePath(`/dashboard/projects/${comment.task.projectId}`)
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
