import prisma from "./prisma";
import { createNotification } from "@/actions/notification";

export async function processRetentionNotifications() {
  console.log("[CRON] Starting project retention checks...");
  let count = 0;

  try {
    // Find all projects where retentionEndDate is in the past and they haven't been notified
    const expiredProjects = await prisma.project.findMany({
      where: {
        retentionEndDate: {
          lte: new Date(), // End date is now or in the past
        },
        retentionNotified: false,
      },
    });

    if (expiredProjects.length === 0) {
      console.log("[CRON] No projects found with expired retention periods.");
      return 0;
    }

    console.log(`[CRON] Found ${expiredProjects.length} projects with expired retention periods.`);

    // Find all Admin and Accountant users
    const managementUsers = await prisma.user.findMany({
      where: {
        role: {
          in: ["ADMIN", "ACCOUNTANT", "SYSTEM_ADMIN"],
        },
      },
      select: { id: true },
    });

    for (const project of expiredProjects) {
      const usersToNotify = new Set(managementUsers.map((u) => u.id));

      // Try to find the Project Coordinator and Document Manager by name
      const namesToFind = [];
      if (project.projectCoordinateName) namesToFind.push(project.projectCoordinateName);
      if (project.documentManagerName) namesToFind.push(project.documentManagerName);

      if (namesToFind.length > 0) {
        const matchingUsers = await prisma.user.findMany({
          where: {
            OR: [
              { name: { in: namesToFind } },
              { email: { in: namesToFind } },
            ],
          },
          select: { id: true },
        });

        matchingUsers.forEach((u) => usersToNotify.add(u.id));
      }

      // Create notifications for all relevant users
      for (const userId of Array.from(usersToNotify)) {
        await createNotification({
          userId,
          title: "Project Retention Expired",
          content: `The retention period for project "${project.name}" has expired.`,
          type: "WARNING",
          link: `/dashboard/projects/${project.id}`,
        });
      }

      // Mark the project as notified
      await prisma.project.update({
        where: { id: project.id },
        data: { retentionNotified: true },
      });

      count++;
    }

    console.log(`[CRON] Processed retention notifications for ${count} projects.`);
    return count;
  } catch (error) {
    console.error("[CRON] Error processing retention notifications:", error);
    throw error;
  }
}
