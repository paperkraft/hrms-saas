"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { logActivity } from "@/lib/activity-logger"
import { authorizeProjectManager } from "./core";

export async function createRecurringTaskSchedule(data: {
  projectId: string;
  assignedToId?: string;
  departmentId?: string;
  taskMasterId?: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | string;
  nextRunAt: Date;
  dayOfMonth?: number;
  dayOfWeek?: number;
}) {
  try {
    const session = await authorizeProjectManager();
    const tenantId = session.user.tenantId;
    if (!tenantId) throw new Error("No tenant configured");

    const schedule = await prisma.recurringTaskSchedule.create({
      data: {
        tenantId,
        projectId: data.projectId,
        assignedToId: data.assignedToId || null,
        departmentId: data.departmentId || null,
        taskMasterId: data.taskMasterId || null,
        frequency: data.frequency,
        nextRunAt: data.nextRunAt,
        dayOfMonth: data.dayOfMonth || null,
        dayOfWeek: data.dayOfWeek || null,
      },
    });

    await logActivity({
      projectId: data.projectId,
      userId: session.user.id,
      action: "CREATE_TASK",
      details: `Created recurring task schedule (${data.frequency})`,
    });

    revalidatePath(`/dashboard/projects/${data.projectId}`);
    return { success: true, data: schedule };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function triggerRecurringTasksManually() {
  try {
    const session = await authorizeProjectManager();
    if (session.user.role !== "ADMIN") {
      throw new Error("Unauthorized");
    }

    // Dynamically import to avoid circular dependencies if any
    const { processRecurringTasks } = await import("@/lib/recurring-tasks");
    const count = await processRecurringTasks();

    revalidatePath("/dashboard/projects");
    return { success: true, data: count };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteRecurringTaskSchedule(id: string) {
  try {
    const session = await authorizeProjectManager();
    if (session.user.role !== "ADMIN") {
      throw new Error("Unauthorized");
    }

    const schedule = await prisma.recurringTaskSchedule.findUnique({ where: { id } });
    if (!schedule) throw new Error("Schedule not found");

    await prisma.recurringTaskSchedule.delete({ where: { id } });

    await logActivity({
      projectId: schedule.projectId,
      userId: session.user.id,
      action: "DELETE_TASK",
      details: `Deleted recurring task schedule: ${schedule.id}`,
    });

    revalidatePath(`/dashboard/projects/${schedule.projectId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateRecurringTaskSchedule(id: string, data: any) {
  try {
    const session = await authorizeProjectManager();
    if (session.user.role !== "ADMIN") {
      throw new Error("Unauthorized");
    }

    const schedule = await prisma.recurringTaskSchedule.update({
      where: { id },
      data
    });

    await logActivity({
      projectId: schedule.projectId,
      userId: session.user.id,
      action: "UPDATE_TASK",
      details: `Updated recurring task schedule: ${schedule.id}`,
    });

    revalidatePath(`/dashboard/projects/${schedule.projectId}`);
    return { success: true, data: schedule };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
