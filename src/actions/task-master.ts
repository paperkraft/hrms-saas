"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasMenuAccess } from "@/lib/permissions"

async function authorizeAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/projects/task-master", "/dashboard/projects")) {
    throw new Error("Unauthorized. Task Master management permissions required.")
  }
  return session;
}

export async function getTaskMasters() {
  try {
    const session = await getServerSession(authOptions);
    const tenantId = session?.user?.tenantId;

    const taskMasters = await prisma.taskMaster.findMany({
      where: tenantId ? { tenantId } : {},
      include: {
        department: {
          select: { id: true, name: true }
        }
      },
      orderBy: { name: 'asc' }
    })
    return { success: true, data: taskMasters }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function createTaskMaster(data: { name: string; activity?: string; defaultDurationDays?: number; defaultDuration?: number; departmentId: string }) {
  try {
    const session = await authorizeAdmin()
    const tenantId = session.user.tenantId;
    if (!tenantId) throw new Error("No tenant configured");

    const taskMaster = await prisma.taskMaster.create({
      data: {
        tenantId,
        name: data.name,
        activity: data.activity,
        defaultDuration: data.defaultDurationDays || data.defaultDuration,
        departmentId: data.departmentId
      }
    })
    revalidatePath("/dashboard/projects/task-master")
    return { success: true, data: taskMaster }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function updateTaskMaster(id: string, data: { name: string; activity?: string; defaultDurationDays?: number; defaultDuration?: number; departmentId: string }) {
  try {
    await authorizeAdmin()
    const taskMaster = await prisma.taskMaster.update({
      where: { id },
      data: {
        name: data.name,
        activity: data.activity,
        defaultDuration: data.defaultDurationDays || data.defaultDuration,
        departmentId: data.departmentId
      }
    })
    revalidatePath("/dashboard/projects/task-master")
    return { success: true, data: taskMaster }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function deleteTaskMaster(id: string) {
  try {
    await authorizeAdmin()
    await prisma.taskMaster.delete({
      where: { id }
    })
    revalidatePath("/dashboard/projects/task-master")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function bulkInsertTaskMasters(data: Array<{ name: string; activity?: string; defaultDurationDays?: number | null; defaultDuration?: number | null; departmentId: string }>) {
  try {
    const session = await authorizeAdmin()
    const tenantId = session.user.tenantId;
    if (!tenantId) throw new Error("No tenant configured");
    
    const result = await prisma.taskMaster.createMany({
      data: data.map(item => ({
        tenantId,
        name: item.name,
        activity: item.activity || null,
        defaultDuration: item.defaultDurationDays || item.defaultDuration || null,
        departmentId: item.departmentId
      }))
    })

    revalidatePath("/dashboard/projects/task-master")
    return { success: true, count: result.count }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
