import { SpecialCaseAdjustmentClient } from "./SpecialCaseAdjustmentClient";
import { PageContainer } from "@/components/ui";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Special Case & Time Adjustments | Developer Tools",
  description: "Developer tool to manage special time accommodation and waive late marks for employees.",
};

export default async function SpecialCaseAdjustmentPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "SYSTEM_ADMIN") {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    where: {
      role: { not: "SYSTEM_ADMIN" },
      status: "ACTIVE",
      NOT: {
        roleDefinition: {
          code: "SYSTEM_ADMIN",
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      employeeCode: true,
      designation: true,
      avatarUrl: true,
      gender: true,
      department: { select: { id: true, name: true } },
      location: { select: { id: true, name: true, startTime: true, endTime: true, graceTimeMinutes: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <PageContainer maxWidth="full" className="py-6 animate-fade-in">
      <SpecialCaseAdjustmentClient initialUsers={users} />
    </PageContainer>
  );
}

