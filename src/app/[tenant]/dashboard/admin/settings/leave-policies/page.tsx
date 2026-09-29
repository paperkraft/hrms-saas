import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTenantLeavePolicies } from "@/actions/leave/policy-manager";
import { LeavePoliciesClient } from "@/components/features/admin/leave-policies-client";
import prisma from "@/lib/prisma";

export const metadata = {
  title: "Leave Policy Settings | HRMS SaaS",
  description: "Configure dynamic tenant leave policies, quotas, carry-forward, and auto-approvals.",
};

export default async function LeavePoliciesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      tenantId: true,
      roleDefinition: { select: { code: true } },
    },
  });

  const roleCode = user?.roleDefinition?.code || user?.role;
  const isAuthorized = ["ADMIN", "SYSTEM_ADMIN", "HR"].includes(roleCode || "");

  if (!isAuthorized) {
    redirect("/dashboard");
  }

  const policies = await getTenantLeavePolicies(user?.tenantId || undefined);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Leave Policy Engine
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Customized leave governance, accruals, and validation rules for your organization.
        </p>
      </div>

      <LeavePoliciesClient initialPolicies={policies} />
    </div>
  );
}
