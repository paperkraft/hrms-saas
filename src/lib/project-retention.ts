import prisma from "./prisma";
import { createNotification } from "@/actions/notification";

export async function processRetentionNotifications() {
  console.log("[CRON] Starting project retention checks...");
  let count = 0;

  try {
    const expiredProjects = await prisma.project.findMany({
      where: {
        endDate: {
          lte: new Date(),
        },
        status: "COMPLETED",
      },
    });

    if (expiredProjects.length === 0) {
      console.log("[CRON] No completed projects with past end dates found.");
      return 0;
    }

    // Find all Admin users
    const managementUsers = await prisma.user.findMany({
      where: {
        role: "ADMIN",
      },
      select: { id: true, tenantId: true },
    });

    for (const project of expiredProjects) {
      const tenantAdmins = managementUsers.filter(u => u.tenantId === project.tenantId);

      for (const admin of tenantAdmins) {
        await createNotification({
          tenantId: project.tenantId,
          userId: admin.id,
          title: "Project Completed & Archived",
          message: `The project "${project.name}" has completed its planned lifecycle.`,
          type: "INFO",
          link: `/dashboard/projects`,
        });
      }

      count++;
    }

    console.log(`[CRON] Processed notifications for ${count} projects.`);
    return count;
  } catch (error) {
    console.error("[CRON] Error processing project checks:", error);
    return 0;
  }
}
