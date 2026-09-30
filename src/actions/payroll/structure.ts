"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasMenuAccess } from "@/lib/permissions";
import { getPayrollEligibleUserWhere } from "@/lib/payroll-helper";

export async function getSalaryStructures() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/accountant", "/dashboard/admin")) {
    throw new Error("Unauthorized");
  }

  const tenantId = session.user.tenantId;

  const structures = await prisma.user.findMany({
    where: getPayrollEligibleUserWhere(tenantId ? { tenantId } : undefined, { includePastPersonnel: true }),
    select: {
      id: true,
      name: true,
      email: true,
      designation: true,
      employeeCode: true,
      gender: true,
      status: true,
      resignationDate: true,
      department: { select: { name: true } },
      salaryStructure: true,
    },
    orderBy: { name: "asc" },
  });

  return { success: true, data: structures };
}

export async function updateSalaryStructure(userId: string, data: any) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/accountant", "/dashboard/admin")) {
    throw new Error("Unauthorized");
  }

  const tenantId = session.user.tenantId;
  const { id, employeeCode, gender, ...updateData } = data;

  // Update user profile fields if provided
  if (employeeCode !== undefined || gender !== undefined) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(employeeCode !== undefined && { employeeCode }),
        ...(gender !== undefined && { gender }),
      }
    });
  }

  const structure = await prisma.salaryStructure.upsert({
    where: { userId },
    update: updateData,
    create: { ...updateData, userId, tenantId: tenantId! },
  });

  return { success: true, data: structure };
}