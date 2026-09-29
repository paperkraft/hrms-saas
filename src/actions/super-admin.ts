"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getSuperAdminSession,
  setSuperAdminSessionCookie,
  clearSuperAdminSessionCookie,
  authenticateSuperAdmin,
  setImpersonationSessionCookie,
  clearImpersonationSessionCookie,
  getImpersonationSession,
} from "@/lib/super-admin-auth";
import { TenantStatus, SubscriptionTier, Role, WorkMode } from "@prisma/client";

/**
 * Super Admin Login Action
 */
export async function loginSuperAdmin(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { success: false, error: "Please provide both email and password." };
  }

  const session = await authenticateSuperAdmin(email, password);
  if (!session) {
    return { success: false, error: "Invalid super administrator credentials." };
  }

  await setSuperAdminSessionCookie(session);
  return { success: true, redirectUrl: "/super-admin" };
}

/**
 * Super Admin Sign Out Action
 */
export async function logoutSuperAdmin() {
  await clearSuperAdminSessionCookie();
  await clearImpersonationSessionCookie();
  redirect("/super-admin/login");
}

export interface TenantOnboardingInput {
  name: string;
  slug: string;
  legalName?: string;
  address?: string;
  tagline?: string;
  primaryColor?: string;
  logoUrl?: string;

  // Plan & Quotas
  plan: SubscriptionTier;
  maxUsers: number;
  driveQuotaGb: number;

  // Feature Toggles
  payrollEnabled: boolean;
  geofencingEnabled: boolean;
  driveEnabled: boolean;
  fileShareEnabled: boolean;
  taskCommitmentEnabled: boolean;

  // Admin Account
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminDesignation?: string;
  adminPhone?: string;

  // Workplace Defaults
  officeStartTime?: string;
  officeEndTime?: string;
  graceTimeMinutes?: number;
  locationName?: string;
  locationLat?: number;
  locationLng?: number;
  locationRadius?: number;
  departmentName?: string;
}

export interface TenantQuotaUpdateInput {
  maxUsers: number;
  driveQuotaGb: number;
  plan: SubscriptionTier;
  status: TenantStatus;
  payrollEnabled: boolean;
  geofencingEnabled: boolean;
  driveEnabled: boolean;
  fileShareEnabled: boolean;
  taskCommitmentEnabled: boolean;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
  smtpFrom?: string | null;
}

/**
 * Super Admin Auth Guard
 */
async function requireSuperAdmin() {
  const session = await getSuperAdminSession();
  if (!session) {
    throw new Error("Unauthorized: Super Admin credentials required.");
  }
  return session;
}

/**
 * Checks if a tenant slug is available.
 */
export async function checkSlugAvailability(slug: string): Promise<{ available: boolean; message?: string }> {
  const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, "");
  if (!cleanSlug || cleanSlug.length < 3) {
    return { available: false, message: "Slug must be at least 3 characters alphanumeric." };
  }

  const reserved = ["api", "super-admin", "dashboard", "login", "share", "admin", "app", "system", "auth"];
  if (reserved.includes(cleanSlug)) {
    return { available: false, message: `'${cleanSlug}' is a reserved system keyword.` };
  }

  const existing = await prisma.tenant.findUnique({
    where: { slug: cleanSlug },
    select: { id: true },
  });

  return {
    available: !existing,
    message: existing ? "This workspace slug is already registered." : "Workspace slug is available!",
  };
}

/**
 * Super Admin: Get High-Level Platform KPIs and Storage Stats
 */
export async function getPlatformStats() {
  await requireSuperAdmin();

  const [
    totalTenants,
    activeTenants,
    trialTenants,
    suspendedTenants,
    totalUsers,
    driveUsageAgg,
    fileShareUsageAgg,
    tenantsByPlan,
    recentTenants,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: "ACTIVE" } }),
    prisma.tenant.count({ where: { status: "TRIAL" } }),
    prisma.tenant.count({ where: { status: "SUSPENDED" } }),
    prisma.user.count(),
    prisma.driveItem.aggregate({
      where: { isTrashed: false },
      _sum: { size: true },
    }),
    prisma.fileShare.aggregate({
      _sum: { size: true },
    }),
    prisma.tenant.groupBy({
      by: ["plan"],
      _count: { id: true },
    }),
    prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        _count: {
          select: { users: true, driveItems: true },
        },
      },
    }),
  ]);

  const totalDriveBytes = (driveUsageAgg._sum.size || 0) + (fileShareUsageAgg._sum.size || 0);

  return {
    totalTenants,
    activeTenants,
    trialTenants,
    suspendedTenants,
    totalUsers,
    totalDriveBytes,
    totalDriveGb: parseFloat((totalDriveBytes / (1024 * 1024 * 1024)).toFixed(2)),
    planDistribution: tenantsByPlan.map((p) => ({
      plan: p.plan,
      count: p._count.id,
    })),
    recentTenants,
  };
}

/**
 * Super Admin: Get Filtered Tenant List with usage gauges
 */
export async function getTenants(filter?: {
  search?: string;
  status?: string;
  plan?: string;
}) {
  await requireSuperAdmin();

  const where: any = {};

  if (filter?.search) {
    const q = filter.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { legalName: { contains: q, mode: "insensitive" } },
    ];
  }

  if (filter?.status && filter.status !== "ALL") {
    where.status = filter.status as TenantStatus;
  }

  if (filter?.plan && filter.plan !== "ALL") {
    where.plan = filter.plan as SubscriptionTier;
  }

  const tenants = await prisma.tenant.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          users: true,
          departments: true,
          locations: true,
          projects: true,
        },
      },
      users: {
        where: { role: "ADMIN" },
        take: 1,
        select: { id: true, name: true, email: true },
      },
    },
  });

  // Calculate storage usage per tenant
  const enriched = await Promise.all(
    tenants.map(async (t) => {
      const [driveAgg, shareAgg] = await Promise.all([
        prisma.driveItem.aggregate({
          where: { tenantId: t.id, isTrashed: false },
          _sum: { size: true },
        }),
        prisma.fileShare.aggregate({
          where: { tenantId: t.id },
          _sum: { size: true },
        }),
      ]);

      const usedBytes = (driveAgg._sum.size || 0) + (shareAgg._sum.size || 0);
      const usedGb = parseFloat((usedBytes / (1024 * 1024 * 1024)).toFixed(2));
      const quotaGb = parseFloat((t.driveQuotaBytes / (1024 * 1024 * 1024)).toFixed(2));
      const storagePercent = quotaGb > 0 ? Math.min(100, Math.round((usedGb / quotaGb) * 100)) : 0;
      const userPercent = t.maxUsers > 0 ? Math.min(100, Math.round((t._count.users / t.maxUsers) * 100)) : 0;

      return {
        ...t,
        adminUser: t.users[0] || null,
        usedStorageBytes: usedBytes,
        usedStorageGb: usedGb,
        quotaGb,
        storagePercent,
        userPercent,
      };
    })
  );

  return enriched;
}

/**
 * Super Admin: Get Single Tenant Full Profile and Quota Details
 */
export async function getTenantDetails(tenantId: string) {
  await requireSuperAdmin();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      systemConfig: true,
      locations: true,
      departments: {
        include: {
          _count: { select: { members: true } },
        },
      },
      users: {
        take: 15,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          designation: true,
          status: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          users: true,
          departments: true,
          locations: true,
          projects: true,
          tasks: true,
          driveItems: true,
          attendances: true,
        },
      },
    },
  });

  if (!tenant) throw new Error("Tenant not found");

  const [driveAgg, shareAgg] = await Promise.all([
    prisma.driveItem.aggregate({
      where: { tenantId: tenant.id, isTrashed: false },
      _sum: { size: true },
    }),
    prisma.fileShare.aggregate({
      where: { tenantId: tenant.id },
      _sum: { size: true },
    }),
  ]);

  const usedBytes = (driveAgg._sum.size || 0) + (shareAgg._sum.size || 0);

  return {
    ...tenant,
    usedStorageBytes: usedBytes,
    usedStorageGb: parseFloat((usedBytes / (1024 * 1024 * 1024)).toFixed(2)),
    quotaGb: parseFloat((tenant.driveQuotaBytes / (1024 * 1024 * 1024)).toFixed(2)),
  };
}

/**
 * Super Admin: Complete 5-Step Multi-Tenant Onboarding Wizard Execution
 */
export async function createTenantOnboarding(input: TenantOnboardingInput) {
  const superAdmin = await requireSuperAdmin();

  const cleanSlug = input.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, "");
  if (!cleanSlug || cleanSlug.length < 3) {
    return { success: false, error: "Tenant slug must be at least 3 valid characters." };
  }

  // Check unique slug
  const existing = await prisma.tenant.findUnique({
    where: { slug: cleanSlug },
  });

  if (existing) {
    return { success: false, error: `Tenant slug '${cleanSlug}' is already in use.` };
  }

  const driveQuotaBytes = (input.driveQuotaGb || 50) * 1024 * 1024 * 1024;
  const hashedAdminPassword = await bcrypt.hash(input.adminPassword, 10);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Tenant Record
      const tenant = await tx.tenant.create({
        data: {
          slug: cleanSlug,
          name: input.name.trim(),
          legalName: input.legalName?.trim() || input.name.trim(),
          address: input.address?.trim(),
          tagline: input.tagline?.trim(),
          primaryColor: input.primaryColor || "#2563eb",
          logoUrl: input.logoUrl,
          plan: input.plan || SubscriptionTier.STARTER,
          maxUsers: input.maxUsers || 50,
          driveQuotaBytes,
          payrollEnabled: input.payrollEnabled ?? true,
          geofencingEnabled: input.geofencingEnabled ?? true,
          driveEnabled: input.driveEnabled ?? true,
          fileShareEnabled: input.fileShareEnabled ?? true,
          taskCommitmentEnabled: input.taskCommitmentEnabled ?? true,
        },
      });

      // 2. Create System Configuration
      await tx.systemConfig.create({
        data: {
          tenantId: tenant.id,
          defaultOfficeStartTime: input.officeStartTime || "09:30",
          defaultOfficeEndTime: input.officeEndTime || "18:00",
          defaultGraceTimeMinutes: input.graceTimeMinutes || 15,
          autoPunchOutEnabled: true,
          lateMarkEnabled: true,
          enableOvertimeModule: true,
          enableGrievanceModule: true,
        },
      });

      // 3. Create Primary HQ Location
      const location = await tx.location.create({
        data: {
          tenantId: tenant.id,
          name: input.locationName || "Headquarters",
          startTime: input.officeStartTime || "09:30",
          endTime: input.officeEndTime || "18:00",
          graceTimeMinutes: input.graceTimeMinutes || 15,
          lat: input.locationLat ?? 16.703244,
          lng: input.locationLng ?? 74.253469,
          radiusMeters: input.locationRadius ?? 50,
        },
      });

      // 4. Create Initial Department
      const department = await tx.department.create({
        data: {
          tenantId: tenant.id,
          name: input.departmentName || "Executive Management",
          description: "Primary organization and administration leadership department.",
        },
      });

      // 5. Seed Core System Role Definitions
      const adminRole = await tx.roleDefinition.create({
        data: {
          tenantId: tenant.id,
          name: "Tenant Administrator",
          code: "ADMIN",
          isSystem: true,
          description: "Full administrative access to tenant organization settings, staff, and modules.",
          allowedMenus: ["all"],
          permissions: ["all"],
        },
      });

      await tx.roleDefinition.createMany({
        data: [
          {
            tenantId: tenant.id,
            name: "Team Leader",
            code: "TEAM_LEADER",
            isSystem: true,
            description: "Team leader access for project, attendance, and leave management.",
            allowedMenus: ["dashboard", "projects", "tasks", "attendance", "leaves", "documents", "calendar"],
            permissions: ["projects.manage", "tasks.approve", "attendance.view", "leaves.approve"],
          },
          {
            tenantId: tenant.id,
            name: "Staff Member",
            code: "EMPLOYEE",
            isSystem: true,
            description: "Standard employee access for daily task logging, attendance, and leaves.",
            allowedMenus: ["dashboard", "projects", "tasks", "attendance", "leaves", "documents", "calendar", "profile"],
            permissions: ["tasks.create", "attendance.punch", "leaves.request"],
          },
          {
            tenantId: tenant.id,
            name: "Accountant",
            code: "ACCOUNTANT",
            isSystem: true,
            description: "Financial, allowances, and payroll processing capabilities.",
            allowedMenus: ["dashboard", "payroll", "allowances", "documents", "reports"],
            permissions: ["payroll.manage", "financials.view"],
          },
        ],
      });

      // 6. Create Initial Admin User
      const adminUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: input.adminName.trim(),
          email: input.adminEmail.toLowerCase().trim(),
          password: hashedAdminPassword,
          role: Role.ADMIN,
          roleDefinitionId: adminRole.id,
          designation: input.adminDesignation || "Chief Executive Officer / Administrator",
          phoneNumber: input.adminPhone,
          locationId: location.id,
          departmentId: department.id,
          workMode: WorkMode.OFFICE,
          allowedMenus: ["all"],
        },
      });

      // Link Department Leader & Membership
      await tx.department.update({
        where: { id: department.id },
        data: { teamLeaderId: adminUser.id },
      });

      await tx.userDepartment.create({
        data: {
          userId: adminUser.id,
          departmentId: department.id,
          isPrimary: true,
          isLeader: true,
          roleInDept: "Department Head",
        },
      });

      // 7. Audit Log
      await tx.activityLog.create({
        data: {
          tenantId: tenant.id,
          userId: adminUser.id,
          action: "TENANT_PROVISIONED",
          details: `Tenant workspace '${tenant.name}' (${tenant.slug}) successfully provisioned by platform super admin ${superAdmin.email}.`,
        },
      });

      return { tenant, adminUser };
    });

    revalidatePath("/super-admin");
    revalidatePath("/super-admin/tenants");

    return {
      success: true,
      tenantId: result.tenant.id,
      slug: result.tenant.slug,
      name: result.tenant.name,
      adminEmail: result.adminUser.email,
    };
  } catch (error: any) {
    console.error("Failed to provision tenant:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred during tenant onboarding.",
    };
  }
}

/**
 * Super Admin: Update Quotas, Subscription Tier, Feature Toggles, & SMTP
 */
export async function updateTenantQuotasAndFeatures(
  tenantId: string,
  input: TenantQuotaUpdateInput
) {
  const superAdmin = await requireSuperAdmin();

  const driveQuotaBytes = (input.driveQuotaGb || 50) * 1024 * 1024 * 1024;

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      maxUsers: input.maxUsers,
      driveQuotaBytes,
      plan: input.plan,
      status: input.status,
      payrollEnabled: input.payrollEnabled,
      geofencingEnabled: input.geofencingEnabled,
      driveEnabled: input.driveEnabled,
      fileShareEnabled: input.fileShareEnabled,
      taskCommitmentEnabled: input.taskCommitmentEnabled,
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort,
      smtpUser: input.smtpUser,
      smtpPass: input.smtpPass,
      smtpFrom: input.smtpFrom,
    },
  });

  revalidatePath("/super-admin");
  revalidatePath("/super-admin/tenants");
  revalidatePath(`/super-admin/tenants/${tenantId}`);

  return { success: true, tenant: updated };
}

/**
 * Super Admin: Quick Status Toggle (ACTIVE, SUSPENDED, TRIAL)
 */
export async function updateTenantStatus(tenantId: string, status: TenantStatus) {
  await requireSuperAdmin();

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: { status },
  });

  revalidatePath("/super-admin");
  revalidatePath("/super-admin/tenants");
  return { success: true, status: updated.status };
}

/**
 * Super Admin: Support Impersonation Engine
 * Securely impersonates a tenant admin or user for support debugging.
 */
export async function startImpersonation(tenantId: string, targetUserId?: string) {
  const superAdmin = await requireSuperAdmin();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      users: {
        where: targetUserId ? { id: targetUserId } : { role: "ADMIN" },
        take: 1,
      },
    },
  });

  if (!tenant) {
    return { success: false, error: "Tenant not found" };
  }

  const targetUser = tenant.users[0];
  if (!targetUser) {
    return { success: false, error: "No target user found for impersonation in this tenant." };
  }

  // Set Impersonation Cookie
  await setImpersonationSessionCookie({
    superAdminId: superAdmin.id,
    superAdminEmail: superAdmin.email,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    targetUserId: targetUser.id,
    targetUserName: targetUser.name || "Tenant Admin",
    targetUserEmail: targetUser.email,
    startedAt: new Date().toISOString(),
  });

  // Audit Log Impersonation Event
  await prisma.activityLog.create({
    data: {
      tenantId: tenant.id,
      userId: targetUser.id,
      action: "SUPPORT_IMPERSONATION_STARTED",
      details: `Super Admin ${superAdmin.email} initiated support impersonation session for user ${targetUser.email} (${tenant.name}).`,
    },
  });

  return {
    success: true,
    redirectUrl: `/${tenant.slug}/dashboard/admin`,
    tenantSlug: tenant.slug,
  };
}

/**
 * Super Admin: Terminate Impersonation Session
 */
export async function stopImpersonation() {
  const session = await getImpersonationSession();
  if (session) {
    await prisma.activityLog.create({
      data: {
        tenantId: session.tenantId,
        userId: session.targetUserId || session.superAdminId,
        action: "SUPPORT_IMPERSONATION_ENDED",
        details: `Super Admin ${session.superAdminEmail} ended support impersonation session for ${session.tenantName}.`,
      },
    });
  }

  await clearImpersonationSessionCookie();
  return { success: true, redirectUrl: "/super-admin/tenants" };
}
