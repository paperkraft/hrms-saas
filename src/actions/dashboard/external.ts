"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUpcomingHolidays } from "@/actions/holiday";

export interface ExternalDashboardData {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    designation?: string | null;
    avatarUrl?: string | null;
  };
  permissions: {
    canAccessProjects: boolean;
    canAccessDocuments: boolean;
    canAccessFileShare: boolean;
    canAccessPolicies: boolean;
    canAccessAnnouncements: boolean;
    canAccessCalendar: boolean;
  };
  tasks: {
    total: number;
    pendingCount: number;
    inProgressCount: number;
    completedCount: number;
    assignedTasks: any[];
  };
  projectsCount: number;
  documents: {
    total: number;
    recent: any[];
  };
  fileShareCount: number;
  announcements: any[];
  policies: any[];
  holidays: any[];
  todos: any[];
}

export async function getExternalDashboardStats(): Promise<{ success: boolean; data?: ExternalDashboardData; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // 1. Fetch user & assigned role definitions in parallel
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        designation: true,
        avatarUrl: true,
        roleDefinitionId: true,
        assignedRoleIds: true,
        allowedMenus: true,
        roleDefinition: {
          select: {
            code: true,
            allowedMenus: true
          }
        }
      }
    });

    if (!dbUser) {
      return { success: false, error: "User not found" };
    }

    const roleIds = (dbUser.assignedRoleIds && dbUser.assignedRoleIds.length > 0)
      ? dbUser.assignedRoleIds
      : (dbUser.roleDefinitionId ? [dbUser.roleDefinitionId] : []);

    const assignedRoleDefs = roleIds.length > 0
      ? await prisma.roleDefinition.findMany({
          where: { id: { in: roleIds } },
          select: { allowedMenus: true, code: true, name: true }
        })
      : [];

    const userAllowedMenus = assignedRoleDefs.length > 0
      ? Array.from(new Set(assignedRoleDefs.flatMap(r => r.allowedMenus || [])))
      : (dbUser.allowedMenus || []);

    const hasAllAccess = userAllowedMenus.includes("all");
    const canAccessProjects = hasAllAccess || userAllowedMenus.includes("/dashboard/projects") || userAllowedMenus.includes("/dashboard/projects/reports");
    const canAccessDocuments = hasAllAccess || userAllowedMenus.includes("/dashboard/documents");
    const canAccessFileShare = hasAllAccess || userAllowedMenus.includes("/dashboard/file-share");
    const canAccessPolicies = hasAllAccess || userAllowedMenus.includes("/dashboard/policies");
    const canAccessAnnouncements = hasAllAccess || userAllowedMenus.includes("/dashboard/announcements");
    const canAccessCalendar = hasAllAccess || userAllowedMenus.includes("/dashboard/calendar");

    // 2. Execute all authorized widget queries concurrently in a single batch
    const externalTaskFilter = {
      OR: [
        { assignedToId: userId },
        { createdById: userId },
        { reviewerId: userId },
        { mentionedUserIds: { has: userId } },
        { comments: { some: { mentionedUserIds: { has: userId } } } }
      ]
    };

    const [
      tasks,
      totalTasksCount,
      activeProjectsCount,
      docCount,
      recentDocs,
      fileShareCount,
      announcements,
      policies,
      holidays,
      todos
    ] = await Promise.all([
      // Tasks list (scoped to assigned, self-created, reviewer, or mentioned)
      prisma.task.findMany({
        where: externalTaskFilter,
        select: {
          id: true,
          name: true,
          status: true,
          plannedEnd: true,
          lifecycleStatus: true,
          projectId: true,
          assignedToId: true,
          createdById: true,
          reviewerId: true,
          mentionedUserIds: true,
          project: {
            select: { id: true, name: true }
          }
        },
        orderBy: { updatedAt: "desc" },
        take: 5
      }),
      // Total task count for external user
      prisma.task.count({
        where: externalTaskFilter
      }),
      // Active project count (only projects where user is assigned, creator, or reviewer)
      prisma.project.count({
        where: {
          tasks: {
            some: externalTaskFilter
          }
        }
      }),
      // Documents count (strictly restricted to Organization Library; Project Documents excluded)
      canAccessDocuments
        ? prisma.driveItem.count({
            where: {
              isTrashed: false,
              scope: "ORGANIZATION_LIBRARY"
            }
          }).catch(() => 0)
        : Promise.resolve(0),
      // Recent documents (Organization Library only)
      canAccessDocuments
        ? prisma.driveItem.findMany({
            where: {
              isTrashed: false,
              scope: "ORGANIZATION_LIBRARY"
            },
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              name: true,
              type: true,
              size: true,
              createdAt: true
            }
          }).catch(() => [])
        : Promise.resolve([]),
      // File shares count
      canAccessFileShare
        ? prisma.fileShare.count({
            where: {
              OR: [
                { uploaderId: userId },
                { sharedWith: { some: { id: userId } } }
              ]
            }
          }).catch(() => 0)
        : Promise.resolve(0),
      // Announcements
      canAccessAnnouncements
        ? prisma.announcement.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              title: true,
              content: true,
              priority: true,
              createdAt: true
            }
          }).catch(() => [])
        : Promise.resolve([]),
      // Policies
      canAccessPolicies
        ? prisma.policy.findMany({
            take: 5,
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              category: true,
              description: true,
              lastUpdated: true
            }
          }).catch(() => [])
        : Promise.resolve([]),
      // Holidays
      canAccessCalendar
        ? getUpcomingHolidays(5).then(res => res.data || []).catch(() => [])
        : Promise.resolve([]),
      // Personal Todos
      prisma.todo.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" }
      }).catch(() => [])
    ]);

    const taskStats = {
      total: totalTasksCount,
      pendingCount: tasks.filter(t => t.lifecycleStatus === "PROPOSED" || t.lifecycleStatus === "NEGOTIATING" || t.status === "TODO").length,
      inProgressCount: tasks.filter(t => t.status === "IN_PROGRESS").length,
      completedCount: tasks.filter(t => t.status === "COMPLETED").length,
    };

    return {
      success: true,
      data: {
        user: {
          id: dbUser.id,
          name: dbUser.name || "External Supporter",
          email: dbUser.email,
          role: dbUser.role,
          designation: dbUser.designation,
          avatarUrl: dbUser.avatarUrl
        },
        permissions: {
          canAccessProjects,
          canAccessDocuments,
          canAccessFileShare,
          canAccessPolicies,
          canAccessAnnouncements,
          canAccessCalendar
        },
        tasks: {
          total: taskStats.total,
          pendingCount: taskStats.pendingCount,
          inProgressCount: taskStats.inProgressCount,
          completedCount: taskStats.completedCount,
          assignedTasks: tasks
        },
        projectsCount: activeProjectsCount,
        documents: {
          total: docCount,
          recent: recentDocs
        },
        fileShareCount,
        announcements,
        policies,
        holidays,
        todos
      }
    };
  } catch (error: any) {
    console.error("[External Dashboard Stats Error]:", error);
    return { success: false, error: error.message || "Failed to load external dashboard" };
  }
}
