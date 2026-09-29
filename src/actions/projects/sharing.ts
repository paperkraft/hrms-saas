"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getSession, authorizeProjectLead } from "./core"
import { logActivity } from "@/lib/activity-logger"
import { isExternalUser } from "@/lib/permissions"

/**
 * Get all current shares for a specific project
 */
export async function getProjectShares(projectId: string) {
  try {
    const session = await getSession()
    
    // External users can only see if they themselves have access to this project
    if (isExternalUser(session.user)) {
      const hasShare = await prisma.projectShare.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: session.user.id
          }
        }
      })
      if (!hasShare) {
        return { success: false, error: "Access Denied" }
      }
    }

    const shares = await prisma.projectShare.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            designation: true,
            isExternal: true,
            role: true,
            roleDefinition: {
              select: {
                id: true,
                name: true,
                isExternal: true
              }
            },
            department: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        sharedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    return { success: true, data: shares }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Get list of active users available to share this project with
 */
export async function getShareableUsers(projectId: string) {
  try {
    await authorizeProjectLead()

    const [allUsers, currentShares] = await Promise.all([
      prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          designation: true,
          isExternal: true,
          role: true,
          roleDefinition: {
            select: {
              id: true,
              name: true,
              isExternal: true
            }
          },
          department: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: [{ isExternal: "desc" }, { name: "asc" }]
      }),
      prisma.projectShare.findMany({
        where: { projectId },
        select: { userId: true }
      })
    ])

    const sharedUserIds = new Set(currentShares.map(s => s.userId))

    const usersWithShareStatus = allUsers.map(u => ({
      ...u,
      isExternalComputed: isExternalUser(u),
      isShared: sharedUserIds.has(u.id)
    }))

    return { success: true, data: usersWithShareStatus }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Share a project with one or more users
 */
export async function shareProjectWithUsers(projectId: string, userIds: string[]) {
  try {
    const session = await authorizeProjectLead()

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true }
    })

    if (!project) {
      return { success: false, error: "Project not found" }
    }

    const createdShares = []
    for (const userId of userIds) {
      const share = await prisma.projectShare.upsert({
        where: {
          projectId_userId: {
            projectId,
            userId
          }
        },
        create: {
          projectId,
          userId,
          sharedById: session.user.id
        },
        update: {
          sharedById: session.user.id
        },
        include: {
          user: { select: { id: true, name: true, email: true } }
        }
      })
      createdShares.push(share)
    }

    await logActivity({
      projectId: project.id,
      userId: session.user.id,
      action: "SHARE_PROJECT",
      details: `Project "${project.name}" was shared with ${userIds.length} user(s).`
    })

    revalidatePath("/dashboard/projects")
    revalidatePath(`/dashboard/projects/${projectId}`)
    revalidatePath("/dashboard/projects/reports")

    return { success: true, data: createdShares }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Revoke project sharing access for a specific user
 */
export async function revokeProjectShare(projectId: string, userId: string) {
  try {
    const session = await authorizeProjectLead()

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true }
    })

    if (!project) {
      return { success: false, error: "Project not found" }
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true }
    })

    await prisma.projectShare.deleteMany({
      where: {
        projectId,
        userId
      }
    })

    await logActivity({
      projectId: project.id,
      userId: session.user.id,
      action: "REVOKE_PROJECT_SHARE",
      details: `Project access for "${targetUser?.name || targetUser?.email || userId}" was revoked on "${project.name}".`
    })

    revalidatePath("/dashboard/projects")
    revalidatePath(`/dashboard/projects/${projectId}`)
    revalidatePath("/dashboard/projects/reports")

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
