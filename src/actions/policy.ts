"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { hasMenuAccess } from "@/lib/permissions";

async function authorizePolicyManagement() {
  const session = await getServerSession(authOptions);
  if (!session || !hasMenuAccess(session.user, "/dashboard/admin/policy", "/dashboard/policy", "/dashboard/accountant")) {
    throw new Error("Unauthorized. Management permissions required.");
  }
}

export async function getPolicies() {
  try {
    const policies = await prisma.policy.findMany({
      orderBy: { order: "asc" }
    });
    return { success: true, data: policies };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createPolicy(data: {
  category: string;
  title: string;
  description: string;
  content: string;
  requirements: string[];
  lastUpdated: string;
  order?: number;
}) {
  try {
    await authorizePolicyManagement();
    const policy = await prisma.policy.create({
      data: {
        ...data,
        order: data.order || 0
      }
    });
    revalidatePath("/dashboard/policies");
    return { success: true, data: policy };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updatePolicy(id: string, data: Partial<{
  category: string;
  title: string;
  description: string;
  content: string;
  requirements: string[];
  lastUpdated: string;
  order: number;
}>) {
  try {
    await authorizePolicyManagement();
    const policy = await prisma.policy.update({
      where: { id },
      data
    });
    revalidatePath("/dashboard/policies");
    return { success: true, data: policy };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deletePolicy(id: string) {
  try {
    await authorizePolicyManagement();
    await prisma.policy.delete({
      where: { id }
    });
    revalidatePath("/dashboard/policies");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}