import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { CommandPalette } from "@/components/layout/command-palette";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";

import { isPathPermittedForUser, isExternalUser } from "@/lib/permissions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch live roleDefinition & allowedMenus directly from DB on every server layout render
  // so role permission & assignment updates from Admin take effect INSTANTLY without logging out.
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      status: true,
      name: true,
      email: true,
      avatarUrl: true,
      designation: true,
      role: true,
      roleDefinitionId: true,
      assignedRoleIds: true,
      allowedMenus: true,
      roleDefinition: {
        select: {
          code: true,
          name: true,
          allowedMenus: true,
          permissions: true
        }
      }
    }
  });

  if (!dbUser || (dbUser.status && dbUser.status !== "ACTIVE")) {
    redirect("/login");
  }

  // Collect all assigned role definitions dynamically
  const roleIds = (dbUser?.assignedRoleIds && dbUser.assignedRoleIds.length > 0)
    ? dbUser.assignedRoleIds
    : (dbUser?.roleDefinitionId ? [dbUser.roleDefinitionId] : []);

  let assignedRoleDefs: any[] = [];
  if (roleIds.length > 0) {
    assignedRoleDefs = await prisma.roleDefinition.findMany({
      where: { id: { in: roleIds } },
      select: { allowedMenus: true, code: true, name: true }
    });
  }

  // Live allowed menus are strictly governed by the assigned roles
  const liveAllowedMenus = assignedRoleDefs.length > 0
    ? Array.from(new Set(assignedRoleDefs.flatMap(r => r.allowedMenus || [])))
    : Array.from(new Set([
        ...(dbUser?.roleDefinition?.allowedMenus || []),
        ...(dbUser?.allowedMenus || []),
      ]));

  const userAllowedMenus = liveAllowedMenus.length > 0 ? liveAllowedMenus : session.user.allowedMenus;

  const effectiveRole = dbUser?.roleDefinition?.code || dbUser?.role || session.user.role;

  // Read the live requested path from middleware header
  const headersList = await headers();
  const currentPath = headersList.get("x-pathname") || "";

  // Live URL route guard: if user tries to access a path not in their live allowed menus, deny and redirect
  const isExternal = isExternalUser({
    role: effectiveRole,
    roleName: dbUser?.roleDefinition?.name,
    isExternal: (dbUser as any)?.isExternal || (dbUser?.roleDefinition as any)?.isExternal || assignedRoleDefs.some(r => (r as any).isExternal)
  });

  if (currentPath) {
    const isPermitted = isPathPermittedForUser(
      currentPath,
      userAllowedMenus,
      effectiveRole,
      !!session.user.isTeamLeader
    );

    if (!isPermitted) {
      if (isExternal && currentPath.startsWith("/dashboard/projects")) {
        redirect("/dashboard/projects/reports");
      }
      const targetHome = isExternal ? "/dashboard/external" : "/dashboard/employee";
      if (currentPath !== targetHome && currentPath !== "/dashboard") {
        redirect(targetHome);
      }
    }
  }

  return (
    <SidebarProvider>
      <Sidebar 
        userRole={effectiveRole} 
        isTeamLeader={session.user.isTeamLeader ?? false} 
        userAllowedMenus={userAllowedMenus}
        isExternal={isExternal}
      />
      <SidebarInset>
        <div className="flex min-h-screen bg-[#fcfcfc] dark:bg-background text-foreground selection:bg-primary/20">
          <div className="flex-1 flex flex-col min-w-0">
            <Header
              userName={dbUser?.name || session.user.name || session.user.email || "User"}
              userEmail={dbUser?.email || session.user.email || ""}
              userAvatar={dbUser?.avatarUrl || null}
              userDesignation={dbUser?.designation || null}
              userRole={effectiveRole}
              isTeamLeader={session.user.isTeamLeader ?? false}
            />

            <main className="flex-1 pb-14 md:pb-0">
              {children}
            </main>

            <MobileBottomNav userRole={effectiveRole} userAllowedMenus={userAllowedMenus} />
            <CommandPalette userRole={effectiveRole} userAllowedMenus={userAllowedMenus} />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}