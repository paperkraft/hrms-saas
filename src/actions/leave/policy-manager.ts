"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type PolicyTemplateType = "SIGMA_LEGACY" | "CORPORATE_STANDARD" | "STARTUP_PTO";

export interface LeavePolicyInput {
  id?: string;
  name: string;
  code: string;
  description?: string;
  color?: string;
  icon?: string;
  accrualType: "MONTHLY_ACCRUAL" | "ANNUAL_UPFRONT" | "SEMI_ANNUAL_CYCLE" | "ON_DEMAND";
  accrualRate: number;
  maxAnnualQuota: number;
  maxCarryForward: number;
  allowEncashment: boolean;
  allowHalfDay: boolean;
  allowShortLeave: boolean;
  probationRestricted: boolean;
  probationDays: number;
  minNoticeDaysForAutoApproval: number;
  requiresApproval: boolean;
  minConsecutiveDays: number;
  maxConsecutiveDays?: number | null;
  sandwichRuleEnabled: boolean;
  customNotificationEmails?: string[];
  isActive: boolean;
  sortOrder: number;
}

/**
 * Seeds default leave policies for a tenant based on the chosen template
 */
export async function seedTenantLeavePolicies(tenantId: string, template: PolicyTemplateType = "SIGMA_LEGACY") {
  if (!tenantId) return { success: false, error: "Tenant ID is required." };

  const existingCount = await prisma.leavePolicy.count({ where: { tenantId } });
  if (existingCount > 0) {
    return { success: true, message: "Policies already exist for this tenant." };
  }

  const policiesToCreate: Array<Omit<LeavePolicyInput, "id">> = [];

  if (template === "SIGMA_LEGACY") {
    policiesToCreate.push(
      {
        name: "Monthly Casual / Medical (Policy 1)",
        code: "MONTHLY_POLICY_1",
        description: "Standard monthly accrued leaves. 2 days accrued per month with carry-forward & encashment.",
        color: "#2563eb",
        icon: "calendar",
        accrualType: "MONTHLY_ACCRUAL",
        accrualRate: 2.0,
        maxAnnualQuota: 24.0,
        maxCarryForward: 1.0,
        allowEncashment: true,
        allowHalfDay: true,
        allowShortLeave: true,
        probationRestricted: false,
        probationDays: 0,
        minNoticeDaysForAutoApproval: 1, // 1+ days in advance auto-approved
        requiresApproval: true,
        minConsecutiveDays: 1,
        sandwichRuleEnabled: false,
        isActive: true,
        sortOrder: 1,
      },
      {
        name: "Semi-Annual Medical (Policy 2)",
        code: "SEMI_ANNUAL_POLICY_2",
        description: "Earned/Medical block leave. 3 days per 6-month cycle. Min 3 consecutive working days.",
        color: "#f59e0b",
        icon: "shield-alert",
        accrualType: "SEMI_ANNUAL_CYCLE",
        accrualRate: 3.0,
        maxAnnualQuota: 6.0,
        maxCarryForward: 0.0,
        allowEncashment: false,
        allowHalfDay: false,
        allowShortLeave: false,
        probationRestricted: true,
        probationDays: 90,
        minNoticeDaysForAutoApproval: 7, // 7+ days notice = auto approved
        requiresApproval: true,
        minConsecutiveDays: 3,
        sandwichRuleEnabled: false,
        isActive: true,
        sortOrder: 2,
      },
      {
        name: "Unpaid Leave (LWP)",
        code: "UNPAID",
        description: "Leave Without Pay for exceptional personal circumstances.",
        color: "#ef4444",
        icon: "clock",
        accrualType: "ON_DEMAND",
        accrualRate: 0.0,
        maxAnnualQuota: 365.0,
        maxCarryForward: 0.0,
        allowEncashment: false,
        allowHalfDay: true,
        allowShortLeave: false,
        probationRestricted: false,
        probationDays: 0,
        minNoticeDaysForAutoApproval: 0,
        requiresApproval: true,
        minConsecutiveDays: 1,
        sandwichRuleEnabled: false,
        isActive: true,
        sortOrder: 3,
      }
    );
  } else if (template === "CORPORATE_STANDARD") {
    policiesToCreate.push(
      {
        name: "Casual Leave (CL)",
        code: "CASUAL",
        description: "Monthly accrued casual leave for personal affairs.",
        color: "#3b82f6",
        icon: "sun",
        accrualType: "MONTHLY_ACCRUAL",
        accrualRate: 1.0,
        maxAnnualQuota: 12.0,
        maxCarryForward: 3.0,
        allowEncashment: false,
        allowHalfDay: true,
        allowShortLeave: true,
        probationRestricted: false,
        probationDays: 0,
        minNoticeDaysForAutoApproval: 2,
        requiresApproval: true,
        minConsecutiveDays: 1,
        sandwichRuleEnabled: false,
        isActive: true,
        sortOrder: 1,
      },
      {
        name: "Sick / Medical Leave (SL)",
        code: "SICK",
        description: "Annual credited sick leaves for medical recovery.",
        color: "#10b981",
        icon: "activity",
        accrualType: "ANNUAL_UPFRONT",
        accrualRate: 7.0,
        maxAnnualQuota: 7.0,
        maxCarryForward: 0.0,
        allowEncashment: false,
        allowHalfDay: true,
        allowShortLeave: false,
        probationRestricted: false,
        probationDays: 0,
        minNoticeDaysForAutoApproval: 0,
        requiresApproval: true,
        minConsecutiveDays: 1,
        sandwichRuleEnabled: false,
        isActive: true,
        sortOrder: 2,
      },
      {
        name: "Privilege / Earned Leave (PL/EL)",
        code: "EARNED",
        description: "Annual earned privilege leave for planned vacations.",
        color: "#8b5cf6",
        icon: "plane",
        accrualType: "ANNUAL_UPFRONT",
        accrualRate: 15.0,
        maxAnnualQuota: 15.0,
        maxCarryForward: 15.0,
        allowEncashment: true,
        allowHalfDay: false,
        allowShortLeave: false,
        probationRestricted: true,
        probationDays: 90,
        minNoticeDaysForAutoApproval: 14,
        requiresApproval: true,
        minConsecutiveDays: 3,
        sandwichRuleEnabled: true,
        isActive: true,
        sortOrder: 3,
      },
      {
        name: "Unpaid Leave (LWP)",
        code: "UNPAID",
        description: "Leave Without Pay.",
        color: "#ef4444",
        icon: "clock",
        accrualType: "ON_DEMAND",
        accrualRate: 0.0,
        maxAnnualQuota: 365.0,
        maxCarryForward: 0.0,
        allowEncashment: false,
        allowHalfDay: true,
        allowShortLeave: false,
        probationRestricted: false,
        probationDays: 0,
        minNoticeDaysForAutoApproval: 0,
        requiresApproval: true,
        minConsecutiveDays: 1,
        sandwichRuleEnabled: false,
        isActive: true,
        sortOrder: 4,
      }
    );
  } else if (template === "STARTUP_PTO") {
    policiesToCreate.push(
      {
        name: "Paid Time Off (PTO)",
        code: "PTO",
        description: "Flexible paid time off for vacation, sick, or personal time.",
        color: "#6366f1",
        icon: "umbrella",
        accrualType: "ANNUAL_UPFRONT",
        accrualRate: 18.0,
        maxAnnualQuota: 18.0,
        maxCarryForward: 5.0,
        allowEncashment: false,
        allowHalfDay: true,
        allowShortLeave: true,
        probationRestricted: false,
        probationDays: 0,
        minNoticeDaysForAutoApproval: 3,
        requiresApproval: true,
        minConsecutiveDays: 1,
        sandwichRuleEnabled: false,
        isActive: true,
        sortOrder: 1,
      },
      {
        name: "Wellness / Mental Health Day",
        code: "WELLNESS",
        description: "Unconditional wellness leave days.",
        color: "#14b8a6",
        icon: "smile",
        accrualType: "ANNUAL_UPFRONT",
        accrualRate: 4.0,
        maxAnnualQuota: 4.0,
        maxCarryForward: 0.0,
        allowEncashment: false,
        allowHalfDay: true,
        allowShortLeave: false,
        probationRestricted: false,
        probationDays: 0,
        minNoticeDaysForAutoApproval: 0,
        requiresApproval: false,
        minConsecutiveDays: 1,
        sandwichRuleEnabled: false,
        isActive: true,
        sortOrder: 2,
      },
      {
        name: "Unpaid Leave",
        code: "UNPAID",
        description: "Leave Without Pay.",
        color: "#ef4444",
        icon: "clock",
        accrualType: "ON_DEMAND",
        accrualRate: 0.0,
        maxAnnualQuota: 365.0,
        maxCarryForward: 0.0,
        allowEncashment: false,
        allowHalfDay: true,
        allowShortLeave: false,
        probationRestricted: false,
        probationDays: 0,
        minNoticeDaysForAutoApproval: 0,
        requiresApproval: true,
        minConsecutiveDays: 1,
        sandwichRuleEnabled: false,
        isActive: true,
        sortOrder: 3,
      }
    );
  }

  for (const policy of policiesToCreate) {
    await prisma.leavePolicy.create({
      data: {
        tenantId,
        ...policy,
      },
    });
  }

  return { success: true, message: `Successfully seeded ${policiesToCreate.length} policies.` };
}

/**
 * Get all leave policies for a tenant (auto-seeds defaults if none found)
 */
export async function getTenantLeavePolicies(tenantIdOverride?: string) {
  const session = await getServerSession(authOptions);
  const tenantId = tenantIdOverride || session?.user?.tenantId;

  if (!tenantId) {
    return [];
  }

  let policies = await prisma.leavePolicy.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
  });

  // Auto-seed if tenant currently has 0 policies configured
  if (policies.length === 0) {
    await seedTenantLeavePolicies(tenantId, "SIGMA_LEGACY");
    policies = await prisma.leavePolicy.findMany({
      where: { tenantId },
      orderBy: { sortOrder: "asc" },
    });
  }

  return policies;
}

/**
 * Upsert / Save a Leave Policy (Admin action)
 */
export async function saveLeavePolicy(input: LeavePolicyInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized." };

  const tenantId = session.user.tenantId;
  if (!tenantId) return { success: false, error: "No active tenant." };

  try {
    if (input.id) {
      // Update existing
      const updated = await prisma.leavePolicy.update({
        where: { id: input.id },
        data: {
          name: input.name,
          code: input.code.toUpperCase().trim(),
          description: input.description,
          color: input.color,
          icon: input.icon,
          accrualType: input.accrualType,
          accrualRate: Number(input.accrualRate),
          maxAnnualQuota: Number(input.maxAnnualQuota),
          maxCarryForward: Number(input.maxCarryForward),
          allowEncashment: input.allowEncashment,
          allowHalfDay: input.allowHalfDay,
          allowShortLeave: input.allowShortLeave,
          probationRestricted: input.probationRestricted,
          probationDays: Number(input.probationDays || 90),
          minNoticeDaysForAutoApproval: Number(input.minNoticeDaysForAutoApproval || 0),
          requiresApproval: input.requiresApproval,
          minConsecutiveDays: Number(input.minConsecutiveDays || 1),
          maxConsecutiveDays: input.maxConsecutiveDays ? Number(input.maxConsecutiveDays) : null,
          sandwichRuleEnabled: input.sandwichRuleEnabled,
          customNotificationEmails: input.customNotificationEmails || [],
          isActive: input.isActive,
          sortOrder: Number(input.sortOrder || 0),
        },
      });

      revalidatePath("/dashboard/admin/settings/leave-policies");
      revalidatePath("/dashboard/employee/leaves");
      return { success: true, policy: updated };
    } else {
      // Create new
      const created = await prisma.leavePolicy.create({
        data: {
          tenantId,
          name: input.name,
          code: input.code.toUpperCase().trim(),
          description: input.description,
          color: input.color || "#3b82f6",
          icon: input.icon || "calendar",
          accrualType: input.accrualType,
          accrualRate: Number(input.accrualRate),
          maxAnnualQuota: Number(input.maxAnnualQuota),
          maxCarryForward: Number(input.maxCarryForward),
          allowEncashment: input.allowEncashment,
          allowHalfDay: input.allowHalfDay,
          allowShortLeave: input.allowShortLeave,
          probationRestricted: input.probationRestricted,
          probationDays: Number(input.probationDays || 90),
          minNoticeDaysForAutoApproval: Number(input.minNoticeDaysForAutoApproval || 0),
          requiresApproval: input.requiresApproval,
          minConsecutiveDays: Number(input.minConsecutiveDays || 1),
          maxConsecutiveDays: input.maxConsecutiveDays ? Number(input.maxConsecutiveDays) : null,
          sandwichRuleEnabled: input.sandwichRuleEnabled,
          customNotificationEmails: input.customNotificationEmails || [],
          isActive: input.isActive ?? true,
          sortOrder: Number(input.sortOrder || 0),
        },
      });

      revalidatePath("/dashboard/admin/settings/leave-policies");
      revalidatePath("/dashboard/employee/leaves");
      return { success: true, policy: created };
    }
  } catch (error: any) {
    console.error("Save leave policy error:", error);
    return { success: false, error: error.message || "Failed to save policy." };
  }
}

/**
 * Toggle policy active status
 */
export async function toggleLeavePolicyStatus(policyId: string, isActive: boolean) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized." };

  try {
    await prisma.leavePolicy.update({
      where: { id: policyId },
      data: { isActive },
    });
    revalidatePath("/dashboard/admin/settings/leave-policies");
    revalidatePath("/dashboard/employee/leaves");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Applies a whole policy template to tenant
 */
export async function applyPolicyTemplate(template: PolicyTemplateType) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return { success: false, error: "Unauthorized." };

  const tenantId = session.user.tenantId;

  try {
    // Delete existing policies if not linked to active leave requests, or mark inactive
    await prisma.leavePolicy.deleteMany({
      where: { tenantId, leaveRequests: { none: {} } },
    });

    await seedTenantLeavePolicies(tenantId, template);

    revalidatePath("/dashboard/admin/settings/leave-policies");
    revalidatePath("/dashboard/employee/leaves");
    return { success: true, message: `Successfully applied ${template} template.` };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
