import prisma from "@/lib/prisma"

export async function logActivity({
  tenantId,
  projectId,
  taskId,
  userId,
  action,
  details
}: {
  tenantId?: string;
  projectId?: string;
  taskId?: string;
  userId: string;
  action: string;
  details?: string;
}) {
  try {
    let resolvedTenantId = tenantId;
    if (!resolvedTenantId && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { tenantId: true },
      });
      resolvedTenantId = user?.tenantId;
    }

    if (!resolvedTenantId) {
      console.warn("Could not log activity without tenantId for user:", userId);
      return;
    }

    await prisma.activityLog.create({
      data: {
        tenantId: resolvedTenantId,
        projectId,
        taskId,
        userId,
        action,
        details
      }
    })
  } catch (error) {
    console.error("Failed to log activity:", error)
  }
}
