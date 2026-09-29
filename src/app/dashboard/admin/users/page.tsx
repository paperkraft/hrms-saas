import { EmployeesPageClient } from "@/components/features/admin/employees-page-client";
import { PageContainer } from "@/components/ui";
import { getAdminUsersData } from "@/actions/user";
import { getOrgData } from "@/actions/org-chart";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasMenuAccess } from "@/lib/permissions";

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/admin/users", "/dashboard/accountant/users")) {
    redirect("/dashboard/employee");
  }

  const [result, orgData] = await Promise.all([
    getAdminUsersData(),
    getOrgData()
  ]);

  if (!result.success || !result.data) return <div>Error loading users</div>;
  const { users, validManagers, departments, locations, roles } = result.data;

  return (
    <PageContainer maxWidth="full" className="py-3 sm:py-6 animate-fade-in space-y-3 sm:space-y-4">
      <EmployeesPageClient
        users={users}
        validManagers={validManagers}
        departments={departments}
        locations={locations}
        roles={roles}
        orgData={orgData}
      />
    </PageContainer>
  );
}

