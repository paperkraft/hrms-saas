import { AddUserDialog } from "@/components/features/admin/add-user-dialog";
import { PageContainer } from "@/components/ui";
import { getAdminUsersData } from "@/actions/user";
import { UserManagementTable } from "@/components/features/admin/user-management-table";
import { Users } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function AccountantUsersPage() {
  const result = await getAdminUsersData();
  if (!result.success || !result.data) return <div>Error loading users</div>;
  const { users, validManagers, departments, locations } = result.data;

  return (
    <PageContainer maxWidth="full" className="py-6 animate-fade-in space-y-4">
      {/* Header Banner */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="size-8 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Users className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none mb-0.5 sm:mb-1">
              Employees
            </h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1 sm:line-clamp-none">
              Manage and collaborate within your organization's workforce
            </p>
          </div>
        </div>
        <AddUserDialog
          managers={validManagers}
          departments={departments}
          locations={locations}
        />
      </div>

      <UserManagementTable
        initialUsers={users}
        validManagers={validManagers}
        departments={departments}
        locations={locations}
      />
    </PageContainer>
  );
}
