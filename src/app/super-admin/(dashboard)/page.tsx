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
  CheckCircle2,
} from "lucide-react";
import { ImpersonateQuickButton } from "@/components/super-admin/ImpersonateQuickButton";

export const dynamic = "force-dynamic";

export default async function SuperAdminDashboardPage() {
  const stats = await getPlatformStats();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Executive Header Banner */}
      <div className="rounded-md bg-card border border-border/80 p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="size-9 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                Enterprise Fleet Overview
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-sm">
                Multi-Tenant
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real-time monitoring across tenant boundaries, storage distribution, quotas, and support impersonation.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
          <Link
            href="/super-admin/tenants/onboarding"
            className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-3.5 py-2 rounded-md shadow-xs transition"
          >
            <UserPlus className="size-3.5" />
            <span>Launch Wizard</span>
          </Link>
          <Link
            href="/super-admin/tenants"
            className="inline-flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-input text-xs font-medium px-3.5 py-2 rounded-md transition"
          >
            <span>Manage Tenants</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tenants */}
        <div className="p-4 rounded-md bg-card border border-border/80 shadow-2xs relative group hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Total Tenants
            </span>
            <div className="size-7 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
              <Building2 className="size-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            {stats.totalTenants}
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{stats.activeTenants} Active</span>
            <span>•</span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">{stats.trialTenants} Trial</span>
          </div>
        </div>

        {/* Cross-Tenant Users */}
        <div className="p-4 rounded-md bg-card border border-border/80 shadow-2xs relative group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Platform Users
            </span>
            <div className="size-7 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Users className="size-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            {stats.totalUsers.toLocaleString()}
          </div>
          <div className="flex items-center gap-1 mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="size-3" />
            <span>Across all tenant partitions</span>
          </div>
        </div>

        {/* Platform MinIO Storage */}
        <div className="p-4 rounded-md bg-card border border-border/80 shadow-2xs relative group hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Storage Consumed
            </span>
            <div className="size-7 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <HardDrive className="size-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            {stats.totalDriveGb} <span className="text-sm font-normal text-muted-foreground">GB</span>
          </div>
          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
            <span>Drive files & attachments</span>
          </div>
        </div>

        {/* Isolation Mode */}
        <div className="p-4 rounded-md bg-card border border-border/80 shadow-2xs relative group hover:border-purple-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Tenant Isolation
            </span>
            <div className="size-7 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
              <ShieldCheck className="size-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tracking-tight flex items-center gap-1.5">
            Prisma $extends
          </div>
          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
            <span>Row & Query-Level Guarded</span>
          </div>
        </div>
      </div>

      {/* Subscription Breakdown & Quick Onboard Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tier Distribution Card */}
        <div className="p-4 sm:p-5 rounded-md bg-card border border-border/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              Subscription Tiers
            </h3>
            <span className="text-[11px] text-muted-foreground font-mono">
              {stats.totalTenants} Total
            </span>
          </div>

          <div className="space-y-2 pt-1">
            {stats.planDistribution.map((item) => (
              <div
                key={item.plan}
                className="flex items-center justify-between p-2.5 rounded-md bg-muted/40 border border-border/60 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary" />
                  <span className="font-medium text-foreground">{item.plan}</span>
                </div>
                <span className="font-bold text-foreground font-mono bg-muted px-2 py-0.5 rounded text-[11px]">
                  {item.count} {item.count === 1 ? "tenant" : "tenants"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Tenant Workspaces */}
        <div className="lg:col-span-2 p-4 sm:p-5 rounded-md bg-card border border-border/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Activity className="size-4 text-emerald-600 dark:text-emerald-400" />
              Recent Tenant Onboardings
            </h3>
            <Link
              href="/super-admin/tenants"
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="divide-y divide-border/60 overflow-hidden">
            {stats.recentTenants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                No tenants onboarded yet. Run the 5-step onboarding wizard to get started.
              </div>
            ) : (
              stats.recentTenants.map((t) => (
                <div
                  key={t.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 px-2 rounded-md transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="size-8 rounded-md flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs"
                      style={{ backgroundColor: t.primaryColor || "#4f46e5" }}
                    >
                      {t.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-foreground flex items-center gap-1.5 truncate">
                        <span className="truncate">{t.name}</span>
                        <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded border border-primary/20 shrink-0">
                          /{t.slug}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <span>{t._count.users} Users</span>
                        <span>•</span>
                        <span className="capitalize">{t.plan.toLowerCase()} Tier</span>
                        <span>•</span>
                        <span
                          className={`font-semibold ${
                            t.status === "ACTIVE"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : t.status === "TRIAL"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-destructive"
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
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
