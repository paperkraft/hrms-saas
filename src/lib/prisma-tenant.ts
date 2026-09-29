import { Prisma, PrismaClient } from "@prisma/client";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";

/**
 * All database models that contain a direct `tenantId` foreign key.
 */
export const TENANT_SCOPED_MODELS = [
  "user",
  "roleDefinition",
  "location",
  "department",
  "attendance",
  "leaveRequest",
  "leaveBalance",
  "systemConfig",
  "attendanceGrievance",
  "allowance",
  "overtimeRequest",
  "taskMaster",
  "recurringTaskSchedule",
  "project",
  "task",
  "milestone",
  "activityLog",
  "todo",
  "workloadSnapshot",
  "salaryStructure",
  "payrollRecord",
  "fileShare",
  "driveItem",
  "announcement",
  "notification",
  "pushSubscription",
] as const;

export type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

export type TenantPrismaClient = ReturnType<typeof createTenantPrismaClient>;

/**
 * Cache for extended Prisma clients per tenant ID to avoid redundant wrapping.
 */
const tenantClientCache = new Map<string, any>();

/**
 * Creates a tenant-isolated Prisma client extension enforcing `tenantId`
 * across all queries, mutations, creates, updates, and deletes.
 */
function createTenantPrismaClient(tenantId: string, basePrisma: PrismaClient = prisma) {
  if (!tenantId) {
    throw new Error("Cannot create tenant-scoped Prisma client without a valid tenantId.");
  }

  return basePrisma.$extends({
    name: `tenant-scope-${tenantId}`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const modelKey = model.charAt(0).toLowerCase() + model.slice(1);

          // Only apply automatic scoping to models that possess a tenantId field
          if (TENANT_SCOPED_MODELS.includes(modelKey as TenantScopedModel)) {
            const currentArgs = (args || {}) as any;

            switch (operation) {
              case "findFirst":
              case "findMany":
              case "count":
              case "aggregate":
              case "groupBy": {
                currentArgs.where = {
                  ...currentArgs.where,
                  tenantId,
                };
                break;
              }

              case "findUnique":
              case "findUniqueOrThrow": {
                // For compound unique indexes, ensure tenantId is scoped
                if (currentArgs.where) {
                  currentArgs.where = {
                    ...currentArgs.where,
                    tenantId,
                  };
                }
                break;
              }

              case "create": {
                currentArgs.data = {
                  ...currentArgs.data,
                  tenantId,
                };
                break;
              }

              case "createMany":
              case "createManyAndReturn": {
                if (Array.isArray(currentArgs.data)) {
                  currentArgs.data = currentArgs.data.map((item: any) => ({
                    ...item,
                    tenantId,
                  }));
                } else if (currentArgs.data) {
                  currentArgs.data = {
                    ...currentArgs.data,
                    tenantId,
                  };
                }
                break;
              }

              case "update":
              case "updateMany":
              case "delete":
              case "deleteMany": {
                currentArgs.where = {
                  ...currentArgs.where,
                  tenantId,
                };
                break;
              }

              case "upsert": {
                currentArgs.where = {
                  ...currentArgs.where,
                  tenantId,
                };
                currentArgs.create = {
                  ...currentArgs.create,
                  tenantId,
                };
                // In update branch, tenantId shouldn't change, but where is strictly guarded
                break;
              }

              default:
                break;
            }

            return query(currentArgs);
          }

          return query(args);
        },
      },
    },
  });
}

/**
 * Returns a cached, tenant-aware Prisma Client for the given tenant ID.
 */
export function getTenantPrisma(tenantId: string): TenantPrismaClient {
  if (!tenantId) {
    throw new Error("getTenantPrisma requires a non-empty tenantId string.");
  }

  if (tenantClientCache.has(tenantId)) {
    return tenantClientCache.get(tenantId)!;
  }

  const client = createTenantPrismaClient(tenantId, prisma);
  tenantClientCache.set(tenantId, client);
  return client;
}

/**
 * Context helper for Server Components and Server Actions to retrieve
 * the current active tenant slug and ID from incoming request headers.
 */
export async function getTenantContext(): Promise<{
  tenantId: string | null;
  tenantSlug: string | null;
  isSuperAdmin: boolean;
  isImpersonating: boolean;
}> {
  try {
    const headersList = await headers();
    const tenantSlug = headersList.get("x-tenant-slug") || null;
    const tenantId = headersList.get("x-tenant-id") || null;
    const isSuperAdmin = headersList.get("x-is-super-admin") === "true";
    const isImpersonating = headersList.get("x-impersonating") === "true";

    return {
      tenantId,
      tenantSlug,
      isSuperAdmin,
      isImpersonating,
    };
  } catch {
    return {
      tenantId: null,
      tenantSlug: null,
      isSuperAdmin: false,
      isImpersonating: false,
    };
  }
}

/**
 * Resolves a Tenant model record by its URL slug.
 */
export async function getTenantBySlug(slug: string) {
  if (!slug) return null;
  return prisma.tenant.findUnique({
    where: { slug: slug.toLowerCase().trim() },
  });
}

/**
 * Helper to execute a database transaction or operation with automatic tenant scoping.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (db: TenantPrismaClient) => Promise<T>
): Promise<T> {
  const tenantDb = getTenantPrisma(tenantId);
  return fn(tenantDb);
}

/**
 * Quota & Storage Validator: checks if tenant has reached user capacity limit.
 */
export async function checkUserQuota(tenantId: string): Promise<{
  allowed: boolean;
  activeUsers: number;
  maxUsers: number;
  remainingSeats: number;
}> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { maxUsers: true },
  });

  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found.`);
  }

  const activeUsers = await prisma.user.count({
    where: {
      tenantId,
      status: "ACTIVE",
    },
  });

  const maxUsers = tenant.maxUsers;
  const remainingSeats = Math.max(0, maxUsers - activeUsers);

  return {
    allowed: activeUsers < maxUsers,
    activeUsers,
    maxUsers,
    remainingSeats,
  };
}

/**
 * Quota & Storage Validator: checks if tenant has reached drive storage capacity limit.
 */
export async function checkDriveQuota(
  tenantId: string,
  additionalBytes = 0
): Promise<{
  allowed: boolean;
  usedBytes: number;
  quotaBytes: number;
  percentUsed: number;
  remainingBytes: number;
}> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { driveQuotaBytes: true },
  });

  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found.`);
  }

  const [driveUsage, fileShareUsage] = await Promise.all([
    prisma.driveItem.aggregate({
      where: { tenantId, isTrashed: false },
      _sum: { size: true },
    }),
    prisma.fileShare.aggregate({
      where: { tenantId },
      _sum: { size: true },
    }),
  ]);

  const usedBytes = (driveUsage._sum.size || 0) + (fileShareUsage._sum.size || 0);
  const quotaBytes = tenant.driveQuotaBytes;
  const requestedTotal = usedBytes + additionalBytes;
  const remainingBytes = Math.max(0, quotaBytes - usedBytes);
  const percentUsed = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;

  return {
    allowed: requestedTotal <= quotaBytes,
    usedBytes,
    quotaBytes,
    percentUsed,
    remainingBytes,
  };
}
