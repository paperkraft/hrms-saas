"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { logActivity } from "@/lib/activity-logger"
import { addMonths } from "date-fns"
import { isExternalUser } from "@/lib/permissions"

export async function getSession() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error("Unauthorized")
  return session
}

export async function authorizeProjectManager() {
  const session = await getSession()
  if (
    session.user.role !== "ADMIN" &&
    session.user.role !== "SYSTEM_ADMIN" &&
    session.user.role !== "ACCOUNTANT"
  ) {
    throw new Error("Management permissions required")
  }
  return session
}

export async function getLedDepartmentIds(userId: string) {
  const depts = await prisma.department.findMany({
    where: { teamLeaderId: userId },
    select: {
      id: true,
      subDepartments: { select: { id: true } }
    }
  })

  return depts.flatMap(dept => [dept.id, ...dept.subDepartments.map(d => d.id)])
}

export async function authorizeProjectLead() {
  const session = await getSession()

  // Admins and Accountants are always allowed
  if (
    session.user.role === "ADMIN" ||
    session.user.role === "SYSTEM_ADMIN" ||
    session.user.role === "ACCOUNTANT"
  ) {
    return session
  }

  // Check if user is a Team Leader
  const deptLed = await prisma.department.findFirst({
    where: { teamLeaderId: session.user.id }
  })

  if (deptLed) return session

  // Check if user has direct subordinates
  const subordinates = await prisma.user.findFirst({
    where: { managerId: session.user.id }
  })

  if (subordinates) return session

  throw new Error("Management or Team Leader permissions required")
}

export async function getProjects() {
  try {
    const session = await getSession()

    const isExternal = isExternalUser(session.user)

    // Visibility Logic:
    // External users: only see projects explicitly shared with them
    // Internal users: see all projects
    let whereClause: any = {}
    if (isExternal) {
      whereClause.shares = {
        some: { userId: session.user.id }
      }
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        _count: { select: { tasks: true, shares: true } },
        tasks: {
          select: { progress: true, status: true }
        },
        shares: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                isExternal: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    // Calculate project health/progress on the fly for the overview
    const projectsWithHealth = projects.map(p => {
      const totalTasks = p.tasks.length
      const completedTasks = p.tasks.filter(t => t.status === "COMPLETED").length
      const avgProgress = totalTasks > 0 ? p.tasks.reduce((acc, t) => acc + t.progress, 0) / totalTasks : 0

      return {
        ...p,
        overallProgress: Math.round(avgProgress),
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
      }
    })

    return { success: true, data: projectsWithHealth }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function createProject(data: {
  name: string;
  description?: string;
  client?: string;
  projectCoordinateName?: string;
  documentManagerName?: string;
  timeLimit?: Date;
  dateOfWorkOrder?: Date;
  retentionStartDate?: Date;
  retentionDurationMonths?: number;
}) {
  try {
    const session = await authorizeProjectManager()

    let retentionEndDate: Date | undefined = undefined;
    if (data.retentionStartDate && data.retentionDurationMonths) {
      retentionEndDate = addMonths(new Date(data.retentionStartDate), data.retentionDurationMonths);
    }

    const project = await prisma.project.create({
      data: {
        ...data,
        retentionEndDate,
        status: "ACTIVE"
      }
    })

    await logActivity({
      projectId: project.id,
      userId: session.user.id,
      action: "CREATE_PROJECT",
      details: `Created project: ${project.name}`
    })

    revalidatePath("/dashboard/projects")
    return { success: true, data: project }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function updateProject(id: string, data: any) {
  try {
    const session = await authorizeProjectManager()

    // If trying to mark as completed, ensure all tasks are completed
    if (data.status === "COMPLETED") {
      const incompleteTasksCount = await prisma.task.count({
        where: {
          projectId: id,
          status: { not: "COMPLETED" }
        }
      })

      if (incompleteTasksCount > 0) {
        throw new Error(`Cannot mark project as completed. There are ${incompleteTasksCount} incomplete task(s) remaining.`)
      }
    }

    let updateData = { ...data };
    
    // Recalculate end date if start date or duration is provided
    if (updateData.retentionStartDate || updateData.retentionDurationMonths) {
      // We need to fetch the existing project to get the current values if only one is updated
      const existingProject = await prisma.project.findUnique({ where: { id } });
      const startDate = updateData.retentionStartDate !== undefined ? updateData.retentionStartDate : existingProject?.retentionStartDate;
      const duration = updateData.retentionDurationMonths !== undefined ? updateData.retentionDurationMonths : existingProject?.retentionDurationMonths;
      
      if (startDate && duration) {
        updateData.retentionEndDate = addMonths(new Date(startDate), duration);
        updateData.retentionNotified = false; // Reset notification flag if retention is updated
      } else {
        updateData.retentionEndDate = null;
      }
    }

    const project = await prisma.project.update({
      where: { id },
      data: updateData
    })

    await logActivity({
      projectId: id,
      userId: session.user.id,
      action: "UPDATE_PROJECT",
      details: `Updated project details: ${project.name}`
    })

    revalidatePath("/dashboard/projects")
    revalidatePath(`/dashboard/projects/${id}`)
    return { success: true, data: project }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function deleteProject(id: string, force: boolean = false) {
  try {
    const session = await authorizeProjectManager()

    // Check for associated tasks if not forced
    if (!force) {
      const taskCount = await prisma.task.count({ where: { projectId: id } })
      if (taskCount > 0) {
        return {
          success: false,
          error: `Project has ${taskCount} associated tasks. Use force delete to remove everything.`,
          requiresForce: true
        }
      }
    }

    const project = await prisma.project.delete({
      where: { id }
    })

    await logActivity({
      userId: session.user.id,
      action: "DELETE_PROJECT",
      details: `Deleted project: ${project.name}`
    })

    revalidatePath("/dashboard/projects")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

