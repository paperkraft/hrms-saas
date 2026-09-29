"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { authorizeProjectManager } from "./core"

export async function createMilestone(projectId: string, data: { title: string; description?: string; dueDate?: Date }) {
  try {
    await authorizeProjectManager()
    const maxOrderMilestone = await prisma.milestone.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' },
      select: { order: true }
    })

    const nextOrder = (maxOrderMilestone?.order ?? -1) + 1

    const milestone = await prisma.milestone.create({
      data: {
        ...data,
        projectId,
        order: nextOrder
      }
    })

    revalidatePath(`/dashboard/projects/${projectId}`)
    return { success: true, data: milestone }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function updateMilestone(id: string, data: any) {
  try {
    await authorizeProjectManager()

    // Auto-set actualDate if status is being changed to COMPLETED
    if (data.status === "COMPLETED") {
      data.actualDate = data.actualDate || new Date()
    } else if (data.status === "PENDING") {
      data.actualDate = null
    }

    const milestone = await prisma.milestone.update({
      where: { id },
      data
    })

    revalidatePath(`/dashboard/projects/${milestone.projectId}`)
    return { success: true, data: milestone }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function deleteMilestone(id: string) {
  try {
    await authorizeProjectManager()
    const milestone = await prisma.milestone.delete({
      where: { id }
    })

    revalidatePath(`/dashboard/projects/${milestone.projectId}`)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getProjectMilestones(projectId: string) {
  try {
    await authorizeProjectManager()
    const milestones = await prisma.milestone.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }]
    })
    return { success: true, data: milestones }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function reorderMilestones(projectId: string, orderedIds: string[]) {
  try {
    await authorizeProjectManager()

    // Execute multiple updates sequentially or using a transaction
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.milestone.update({
          where: { id },
          data: { order: index }
        })
      )
    )

    revalidatePath(`/dashboard/projects/${projectId}`)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

