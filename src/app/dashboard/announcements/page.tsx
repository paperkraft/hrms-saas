import { AnnouncementList } from "@/components/features/announcements/announcement-list";
import { PageContainer } from "@/components/ui";
import { Megaphone } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CreateAnnouncementDialog } from "@/components/features/announcements/create-announcement-dialog";
import { getDepartments } from "@/actions/department";
import { isAdminRole } from "@/lib/permissions";

export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const canCreate =
    userRole === "ADMIN" ||
    userRole === "SYSTEM_ADMIN" ||
    userRole === "ACCOUNTANT" ||
    isAdminRole(session?.user as any);

  let departments: any[] = [];
  if (canCreate) {
    const depsRes = await getDepartments();
    if (depsRes.success && depsRes.departments) {
      departments = depsRes.departments;
    }
  }

  return (
    <PageContainer maxWidth="full" className="py-3 sm:py-6 animate-fade-in space-y-3 sm:space-y-4">
      {/* Page Header (Hidden on Mobile) */}
      <div className="hidden md:flex rounded-md bg-card border border-border/80 p-5 shadow-2xs flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Megaphone className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground tracking-tight leading-none mb-1">
              Company Notices & Bulletins
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              Official company broadcasts, department updates, policy alerts, and news
            </p>
          </div>
        </div>
        {canCreate && (
          <div className="flex items-center gap-2.5">
            <CreateAnnouncementDialog departments={departments} />
          </div>
        )}
      </div>

      <AnnouncementList
        userRole={session?.user?.role}
        departmentId={session?.user?.departmentId as string | undefined}
        departments={departments}
        canCreate={canCreate}
      />
    </PageContainer>
  );
}
