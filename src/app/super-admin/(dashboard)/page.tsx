import { getPlatformStats } from "@/actions/super-admin";
import Link from "next/link";
import {
  Building2,
  Users,
  HardDrive,
  ShieldCheck,
  UserPlus,
  ArrowRight,
  Activity,
  Layers,
  Sparkles,
  ExternalLink,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { ImpersonateQuickButton } from "@/components/super-admin/ImpersonateQuickButton";

export const dynamic = "force-dynamic";

export default async function SuperAdminDashboardPage() {
  const stats = await getPlatformStats();

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900/90 to-purple-950/80 border border-indigo-900/40 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              SaaS Multi-Tenant Control Engine
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Enterprise Fleet Overview
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Real-time monitoring across tenant boundaries, storage distribution, subscription quotas, and live support impersonation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/super-admin/tenants/onboarding"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Launch Onboarding Wizard</span>
            </Link>
            <Link
              href="/super-admin/tenants"
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-700 transition"
            >
              <span>Manage All Tenants</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Decorative background circle */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Tenants */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-indigo-500/40 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Tenants
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {stats.totalTenants}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
            <span className="text-emerald-400 font-semibold">{stats.activeTenants} Active</span>
            <span>•</span>
            <span className="text-amber-400">{stats.trialTenants} Trial</span>
          </div>
        </div>

        {/* Cross-Tenant Users */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Platform Users
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {stats.totalUsers.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Across all tenant partitions</span>
          </div>
        </div>

        {/* Platform MinIO Storage */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-blue-500/40 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Storage Consumed
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {stats.totalDriveGb} <span className="text-lg font-normal text-slate-400">GB</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
            <span>Drive files & shared attachments</span>
          </div>
        </div>

        {/* Isolation Mode */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-purple-500/40 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Tenant Isolation
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-400 tracking-tight flex items-center gap-2">
            Prisma $extends
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
            <span>Row-Level & Query-Level Guarded</span>
          </div>
        </div>
      </div>

      {/* Subscription Breakdown & Quick Onboard Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tier Distribution Card */}
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Subscription Tiers
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              {stats.totalTenants} Total
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {stats.planDistribution.map((item) => (
              <div
                key={item.plan}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span className="font-medium text-slate-200">{item.plan}</span>
                </div>
                <span className="font-bold text-white font-mono bg-slate-800/80 px-2 py-0.5 rounded text-xs">
                  {item.count} {item.count === 1 ? "tenant" : "tenants"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Tenant Workspaces */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Recent Tenant Onboardings
            </h3>
            <Link
              href="/super-admin/tenants"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-800/60 overflow-hidden">
            {stats.recentTenants.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                No tenants onboarded yet. Run the 5-step onboarding wizard to get started.
              </div>
            ) : (
              stats.recentTenants.map((t) => (
                <div
                  key={t.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 px-3 rounded-xl transition"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-md"
                      style={{ backgroundColor: t.primaryColor || "#4f46e5" }}
                    >
                      {t.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-white flex items-center gap-2">
                        {t.name}
                        <span className="font-mono text-xs text-indigo-400 bg-indigo-950/60 px-2 py-0.2 rounded border border-indigo-800/40">
                          /{t.slug}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{t._count.users} Users</span>
                        <span>•</span>
                        <span className="capitalize">{t.plan.toLowerCase()} Tier</span>
                        <span>•</span>
                        <span
                          className={`font-semibold ${
                            t.status === "ACTIVE"
                              ? "text-emerald-400"
                              : t.status === "TRIAL"
                              ? "text-amber-400"
                              : "text-rose-400"
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <ImpersonateQuickButton tenantId={t.id} tenantSlug={t.slug} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
