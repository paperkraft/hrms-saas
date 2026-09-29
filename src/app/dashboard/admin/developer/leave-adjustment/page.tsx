import { LeaveAdjustmentClient } from "./LeaveAdjustmentClient";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leave Adjustments | Developer Tools",
  description: "Developer tool to adjust leave requests and balances manually.",
};

export default async function LeaveAdjustmentPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user || session.user.role !== "SYSTEM_ADMIN") {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      role: { not: "SYSTEM_ADMIN" },
      NOT: {
        roleDefinition: {
          code: "SYSTEM_ADMIN"
        }
      }
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      employeeCode: true,
      designation: true,
      avatarUrl: true,
      department: { select: { name: true } },
    }
  });

  return (
    <PageContainer maxWidth="full" className="py-6 animate-fade-in">
      <LeaveAdjustmentClient users={users} />
    </PageContainer>
  );
}
