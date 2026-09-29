"use server"

import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function getTodos() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    const todos = await prisma.todo.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" }
    })
    return { success: true, data: todos }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch todos" }
  }
}

export async function addTodo(title: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" }
  }

  if (!title || !title.trim()) {
    return { success: false, error: "Title is required" }
  }

  try {
    const newTodo = await prisma.todo.create({
      data: {
        title: title.trim(),
        userId: session.user.id
      }
    })
    revalidatePath("/dashboard/employee")
    return { success: true, data: newTodo }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create todo" }
  }
}

export async function toggleTodo(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    const todo = await prisma.todo.findUnique({
      where: { id }
    })

    if (!todo || todo.userId !== session.user.id) {
      return { success: false, error: "Todo not found or access denied" }
    }

    const updatedTodo = await prisma.todo.update({
      where: { id },
      data: { completed: !todo.completed }
    })
    revalidatePath("/dashboard/employee")
    return { success: true, data: updatedTodo }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to toggle todo" }
  }
}

export async function deleteTodo(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    const todo = await prisma.todo.findUnique({
      where: { id }
    })

    if (!todo || todo.userId !== session.user.id) {
      return { success: false, error: "Todo not found or access denied" }
    }

    await prisma.todo.delete({
      where: { id }
    })
    revalidatePath("/dashboard/employee")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to delete todo" }
  }
}

export async function clearCompletedTodos() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    const result = await prisma.todo.deleteMany({
      where: {
        userId: session.user.id,
        completed: true
      }
    })
    
    revalidatePath("/dashboard")
    return { success: true, count: result.count }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to clear completed todos" }
  }
}
