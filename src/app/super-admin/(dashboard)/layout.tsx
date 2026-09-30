import { redirect } from "next/navigation";
import { getSuperAdminSession, getImpersonationSession } from "@/lib/super-admin-auth";
import Link from "next/link";
import { ShieldCheck, UserPlus } from "lucide-react";
import { SuperAdminLogoutButton } from "@/components/super-admin/SuperAdminLogoutButton";
import { SuperAdminSidebarNav } from "@/components/super-admin/SuperAdminSidebarNav";
import { SuperAdminMobileNav } from "@/components/super-admin/SuperAdminMobileNav";

export const dynamic = "force-dynamic";

export default async function SuperAdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSuperAdminSession();
  const impersonation = await getImpersonationSession();

  // If not logged in, enforce redirect to super admin login
  if (!session) {
    redirect("/super-admin/login");
  }

  return (
    <div className="flex min-h-screen bg-[#fcfcfc] dark:bg-background text-foreground selection:bg-primary/20">
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex md:w-60 bg-sidebar border-r border-sidebar-border shrink-0 flex-col justify-between sticky top-0 h-screen z-30 transition-all duration-200">
        <div className="overflow-y-auto flex-1">
          {/* Logo Branding */}
          <div className="h-14 border-b border-sidebar-border px-4 flex items-center">
            <Link href="/super-admin" className="flex items-center gap-2.5 group min-w-0">
              <div className="size-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-xs shrink-0 group-hover:scale-105 transition">
                <ShieldCheck className="size-4" />
              </div>
              <div className="min-w-0 flex-1 truncate">
                <span className="font-bold text-sm tracking-tight text-sidebar-foreground block truncate">
                  Platform Admin
                </span>
                <span className="text-[10px] font-mono text-primary block tracking-wider uppercase truncate">
                  Multi-Tenant Core
                </span>
              </div>
            </Link>
          </div>

          {/* Dynamic Client Nav Items with active indicator */}
          <SuperAdminSidebarNav />
        </div>

        {/* User profile & Logout */}
        <div className="p-3 border-t border-sidebar-border bg-sidebar shrink-0">
          <div className="flex items-center justify-between gap-2.5">
            <div className="truncate min-w-0 flex-1">
              <div className="text-xs font-semibold text-sidebar-foreground truncate">
                {session?.name || "Platform Admin"}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono truncate">
                {session?.email || "superadmin@hrms.com"}
              </div>
            </div>

            <SuperAdminLogoutButton />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Navbar */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-3.5 sm:px-4 sticky top-0 z-40 transition-colors">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            {/* Mobile Navigation Drawer Trigger */}
            <SuperAdminMobileNav session={session} />

            <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-muted-foreground min-w-0">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold shrink-0 text-[11px] sm:text-xs">
                <span className="size-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                Live
              </span>
              <span className="text-border">/</span>
              <span className="text-foreground font-bold text-xs sm:text-sm tracking-tight truncate">
                Platform Control
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/super-admin/tenants/onboarding"
              className="inline-flex items-center gap-1 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-md shadow-xs transition"
              title="Onboard New Tenant"
            >
              <UserPlus className="size-3.5" />
              <span className="hidden sm:inline">Onboard Tenant</span>
              <span className="sm:hidden text-[11px]">New</span>
            </Link>

            <SuperAdminLogoutButton showLabel className="bg-muted/60 hover:bg-destructive/10 text-muted-foreground hover:text-destructive border border-border/60 text-xs px-2.5 sm:px-3" />
          </div>
        </header>

        {/* Body Container */}
        <main className="flex-1 p-3.5 sm:p-5 md:p-6 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}

