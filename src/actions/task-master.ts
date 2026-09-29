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
}

export async function getTaskMasters() {
  try {
    const taskMasters = await prisma.taskMaster.findMany({
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

export async function createTaskMaster(data: { name: string; activity?: string; defaultDurationDays?: number; departmentId: string }) {
  try {
    await authorizeAdmin()
    const taskMaster = await prisma.taskMaster.create({
      data: {
        name: data.name,
        activity: data.activity,
        defaultDurationDays: data.defaultDurationDays,
        departmentId: data.departmentId
      }
    })
    revalidatePath("/dashboard/projects/task-master")
    return { success: true, data: taskMaster }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function updateTaskMaster(id: string, data: { name: string; activity?: string; defaultDurationDays?: number; departmentId: string }) {
  try {
    await authorizeAdmin()
    const taskMaster = await prisma.taskMaster.update({
      where: { id },
      data: {
        name: data.name,
        activity: data.activity,
        defaultDurationDays: data.defaultDurationDays,
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

export async function bulkInsertTaskMasters(data: Array<{ name: string; activity?: string; defaultDurationDays?: number | null; departmentId: string }>) {
  try {
    await authorizeAdmin()
    
    // CreateMany is supported by PostgreSQL and is very fast
    const result = await prisma.taskMaster.createMany({
      data: data.map(item => ({
        name: item.name,
        activity: item.activity || null,
        defaultDurationDays: item.defaultDurationDays || null,
        departmentId: item.departmentId
      }))
    })

    revalidatePath("/dashboard/projects/task-master")
    return { success: true, count: result.count }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

