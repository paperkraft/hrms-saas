"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { minioClient } from "@/lib/minio"
import { revalidatePath } from "next/cache"
import { getMainStorageBucket } from "@/lib/drive-storage"

async function deleteFromMinio(attachmentUrl: string) {
  if (!attachmentUrl) return;
  try {
    const bucket = getMainStorageBucket();

    // Extract objectName from URL. 
    // Examples: 
    // /api/task/tasks/123/file.pdf -> tasks/123/file.pdf
    // /api/task/123/file.pdf -> tasks/123/file.pdf (if stripped)

    let objectName = "";
    if (attachmentUrl.includes("/api/task/")) {
      objectName = attachmentUrl.split("/api/task/")[1];
      if (!objectName.startsWith("tasks/")) {
        objectName = "tasks/" + objectName;
      }
    } else if (attachmentUrl.includes(`storage.infraplan.co.in/${bucket}/`)) {
      objectName = attachmentUrl.split(`storage.infraplan.co.in/${bucket}/`)[1];
    } else if (attachmentUrl.includes("storage.infraplan.co.in/hrms/")) {
      objectName = attachmentUrl.split("storage.infraplan.co.in/hrms/")[1];
    }

    // Strip query parameters just in case
    objectName = objectName.split("?")[0];

    if (objectName) {
      await minioClient.removeObject(bucket, objectName);
    }
  } catch (error) {
    console.error("Failed to delete attachment from MinIO:", error);
  }
}

export async function removeOrphanedAttachment(attachmentUrl: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  await deleteFromMinio(attachmentUrl);
  return { success: true };
}

export async function removeTaskAttachment(taskId: string, urlToRemove?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");

  const isAssignee = task.assignedToId === session.user.id;
  const isCreator = task.createdById === session.user.id;
  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SYSTEM_ADMIN";

  if (!isAssignee && !isCreator && !isAdmin) {
    throw new Error("Unauthorized to remove attachment");
  }

  let dataToUpdate: any = {};

  if (urlToRemove) {
    await deleteFromMinio(urlToRemove);
    if (task.attachments) {
      const arr = task.attachments as any[];
      dataToUpdate.attachments = arr.filter((a: any) => a.url !== urlToRemove);
    }
  } else {
    if (task.attachments) {
      const arr = task.attachments as any[];
      for (const att of arr) {
        if (att.url) await deleteFromMinio(att.url);
      }
      dataToUpdate.attachments = [];
    }
  }

  if (Object.keys(dataToUpdate).length > 0) {
    await prisma.task.update({
      where: { id: taskId },
      data: dataToUpdate,
    });
  }

  revalidatePath("/dashboard/tasks");
  return { success: true };
}

export async function removeTaskCommentAttachment(commentId: string, urlToRemove?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const comment = await prisma.taskComment.findUnique({
    where: { id: commentId },
    include: { task: true }
  });

  if (!comment) throw new Error("Comment not found");

  if (comment.userId !== session.user.id && session.user.role !== "ADMIN" && session.user.role !== "SYSTEM_ADMIN") {
    throw new Error("Unauthorized to remove attachment");
  }

  let dataToUpdate: any = {};

  if (urlToRemove) {
    await deleteFromMinio(urlToRemove);
    if (comment.attachments) {
      const arr = comment.attachments as any[];
      dataToUpdate.attachments = arr.filter((a: any) => a.url !== urlToRemove);
    }
  } else {
    if (comment.attachments) {
      const arr = comment.attachments as any[];
      for (const att of arr) {
        if (att.url) await deleteFromMinio(att.url);
      }
      dataToUpdate.attachments = [];
    }
  }

  if (Object.keys(dataToUpdate).length > 0) {
    await prisma.taskComment.update({
      where: { id: commentId },
      data: dataToUpdate,
    });
  }

  revalidatePath("/dashboard/tasks");
  return { success: true };
}
