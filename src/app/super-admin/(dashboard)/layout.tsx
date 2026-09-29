import { redirect } from "next/navigation";
import { getSuperAdminSession, getImpersonationSession } from "@/lib/super-admin-auth";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  UserPlus,
  Server,
  ShieldCheck,
  HardDrive,
  Users,
  Activity,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { SuperAdminLogoutButton } from "@/components/super-admin/SuperAdminLogoutButton";

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row antialiased selection:bg-indigo-500/30">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-900/90 border-r border-slate-800/80 shrink-0 flex flex-col justify-between backdrop-blur-xl z-20">
        <div>
          {/* Logo Branding */}
          <div className="p-6 border-b border-slate-800/80">
            <Link href="/super-admin" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                  Platform Admin
                </span>
                <span className="text-[11px] font-mono text-indigo-400 block tracking-wider uppercase">
                  Multi-Tenant Core
                </span>
              </div>
            </Link>
          </div>

          {/* Nav Items */}
          <nav className="p-4 space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-1">
              Platform Governance
            </div>
            
            <Link
              href="/super-admin"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/70 transition"
            >
              <LayoutDashboard className="w-4 h-4 text-indigo-400" />
              <span>Overview</span>
            </Link>

            <Link
              href="/super-admin/tenants"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/70 transition"
            >
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span>Tenants & Quotas</span>
            </Link>

            <Link
              href="/super-admin/tenants/onboarding"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/70 transition group"
            >
              <UserPlus className="w-4 h-4 text-purple-400 group-hover:scale-110 transition" />
              <span>Onboarding Wizard</span>
              <span className="ml-auto text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold border border-purple-500/30">
                5-Step
              </span>
            </Link>

            <div className="pt-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-1">
              Infrastructure
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-emerald-400" /> PostgreSQL Pool
                </span>
                <span className="text-emerald-400 font-mono text-[10px]">HEALTHY</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-blue-400" /> MinIO Storage
                </span>
                <span className="text-blue-400 font-mono text-[10px]">CONNECTED</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-purple-400" /> Edge Router
                </span>
                <span className="text-purple-400 font-mono text-[10px]">ACTIVE</span>
              </div>
            </div>
          </nav>
        </div>

        {/* User profile & Logout */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="truncate">
              <div className="text-xs font-semibold text-white truncate">
                {session?.name || "Platform Admin"}
              </div>
              <div className="text-[11px] text-slate-400 font-mono truncate">
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
        <header className="h-16 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Platform Live
            </span>
            <span>/</span>
            <span className="text-slate-200">Global SaaS Control Plane</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/super-admin/tenants/onboarding"
              className="hidden sm:inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-md transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Onboard Tenant</span>
            </Link>

            <SuperAdminLogoutButton showLabel className="bg-slate-800/60 hover:bg-rose-500/10" />
          </div>
        </header>

        {/* Body Container */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-8">
          {children}
        </main>
      </div>
    </div>
  );
}
