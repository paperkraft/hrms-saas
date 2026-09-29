"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasMenuAccess, isAdminRole } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-logger";

async function authorizeAccountantAccess() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/accountant", "/dashboard/admin")) {
    throw new Error("Unauthorized access. Admin or Accountant credentials required.");
  }
  return session;
}

async function authorizeAdminAccess() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdminRole(session.user)) {
    throw new Error("Unauthorized access. Administrator credentials required to reset Security PIN.");
  }
  return session;
}

export async function verifyPayrollPin(pin: string) {
  try {
    const session = await authorizeAccountantAccess();

    if (!pin || typeof pin !== "string") {
      return { success: false, error: "PIN is required." };
    }

    const tenantId = session.user.tenantId;
    const config = tenantId ? await prisma.systemConfig.findUnique({ where: { tenantId } }) : null;
    const expectedPin = (config as any)?.payrollPin || "1234";

    if (pin.trim() !== expectedPin.trim()) {
      return { success: false, error: "Incorrect Security PIN. Please try again." };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to verify PIN." };
  }
}

export async function updatePayrollPin(currentPin: string, newPin: string) {
  try {
    const session = await authorizeAccountantAccess();

    if (!currentPin || !newPin) {
      return { success: false, error: "Both current and new PIN are required." };
    }

    const trimmedNew = newPin.trim();
    if (!/^\d{4}$/.test(trimmedNew)) {
      return { success: false, error: "New PIN must be exactly 4 numeric digits." };
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) return { success: false, error: "Tenant not found" };

    const config = await prisma.systemConfig.findUnique({ where: { tenantId } });
    const expectedPin = (config as any)?.payrollPin || "1234";

    if (currentPin.trim() !== expectedPin.trim()) {
      return { success: false, error: "Current PIN is incorrect." };
    }

    if (config) {
      await prisma.systemConfig.update({
        where: { id: config.id },
        data: { payrollPin: trimmedNew } as any,
      });
    } else {
      await prisma.systemConfig.create({
        data: { tenantId, payrollPin: trimmedNew } as any,
      });
    }

    revalidatePath("/dashboard/accountant");
    revalidatePath("/dashboard/admin/settings");
    revalidatePath("/dashboard/accountant/settings");
    return { success: true, message: "Payroll Security PIN updated successfully." };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update Security PIN." };
  }
}

export async function adminResetPayrollPin(options?: { newPin?: string; resetToDefault?: boolean }) {
  try {
    const session = await authorizeAdminAccess();
    const userId = session.user.id;
    const tenantId = session.user.tenantId;
    if (!tenantId) return { success: false, error: "Tenant not found" };

    let targetPin = "1234";
    let isResetDefault = true;

    if (options?.newPin && !options.resetToDefault) {
      const trimmed = options.newPin.trim();
      if (!/^\d{4}$/.test(trimmed)) {
        return { success: false, error: "New PIN must be exactly 4 numeric digits." };
      }
      targetPin = trimmed;
      isResetDefault = false;
    }

    const config = await prisma.systemConfig.findUnique({ where: { tenantId } });

    if (config) {
      await prisma.systemConfig.update({
        where: { id: config.id },
        data: { payrollPin: targetPin } as any,
      });
    } else {
      await prisma.systemConfig.create({
        data: { tenantId, payrollPin: targetPin } as any,
      });
    }

    if (userId) {
      await logActivity({
        tenantId,
        userId,
        action: isResetDefault ? "PAYROLL_PIN_RESET_DEFAULT" : "PAYROLL_PIN_ADMIN_OVERRIDE",
        details: isResetDefault
          ? "Admin reset Payroll Security PIN to system default"
          : "Admin forcefully updated Payroll Security PIN without current PIN",
      });
    }

    revalidatePath("/dashboard/accountant");
    revalidatePath("/dashboard/admin/settings");
    revalidatePath("/dashboard/accountant/settings");

    return {
      success: true,
      message: isResetDefault
        ? "Payroll Security PIN has been reset to system default."
        : "Payroll Security PIN has been updated successfully.",
      isDefault: isResetDefault,
      newPin: targetPin,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to reset Security PIN." };
  }
}

export async function getPayrollPinStatus() {
  try {
    const session = await authorizeAccountantAccess();
    const isAdmin = isAdminRole(session.user);
    const tenantId = session.user.tenantId;
    const config = tenantId ? await prisma.systemConfig.findUnique({ where: { tenantId } }) : null;
    const pin = (config as any)?.payrollPin || "1234";
    return {
      success: true,
      data: {
        isDefault: pin === "1234",
        pinLength: pin.length,
        isAdmin,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
