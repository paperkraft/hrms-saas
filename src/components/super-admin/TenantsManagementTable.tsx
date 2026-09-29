"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Search,
  Filter,
  Sliders,
  ShieldAlert,
  ExternalLink,
  Users,
  HardDrive,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  Plus,
  Copy,
  Check,
} from "lucide-react";
import Link from "next/link";
import { ImpersonateQuickButton } from "./ImpersonateQuickButton";
import { QuotaConfiguratorModal } from "./QuotaConfiguratorModal";
import { updateTenantStatus } from "@/actions/super-admin";
import { toast } from "sonner";
import { TenantStatus, SubscriptionTier } from "@prisma/client";

export function TenantsManagementTable({ initialTenants }: { initialTenants: any[] }) {
  const router = useRouter();
  const [tenants, setTenants] = useState(initialTenants);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [selectedTenantForQuota, setSelectedTenantForQuota] = useState<any | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Filtered tenants
  const filtered = tenants.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      (t.legalName && t.legalName.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
    const matchesPlan = planFilter === "ALL" || t.plan === planFilter;

    return matchesSearch && matchesStatus && matchesPlan;
  });

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/${slug}/dashboard`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    toast.success(`Copied workspace URL: /${slug}`);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleQuickStatus = async (tenantId: string, newStatus: TenantStatus) => {
    try {
      const res = await updateTenantStatus(tenantId, newStatus);
      if (res.success) {
        toast.success(`Tenant status changed to ${newStatus}`);
        setTenants((prev) =>
          prev.map((t) => (t.id === tenantId ? { ...t, status: newStatus } : t))
        );
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, workspace slug, or legal name..."
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900/80 border border-slate-800 rounded-xl py-2 px-3 text-xs font-medium text-slate-300 outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value={TenantStatus.ACTIVE}>Active</option>
            <option value={TenantStatus.TRIAL}>Trial</option>
            <option value={TenantStatus.SUSPENDED}>Suspended</option>
            <option value={TenantStatus.EXPIRED}>Expired</option>
            <option value={TenantStatus.ARCHIVED}>Archived</option>
          </select>

          {/* Plan Filter */}
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="bg-slate-900/80 border border-slate-800 rounded-xl py-2 px-3 text-xs font-medium text-slate-300 outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Plans</option>
            <option value={SubscriptionTier.STARTER}>Starter</option>
            <option value={SubscriptionTier.PROFESSIONAL}>Professional</option>
            <option value={SubscriptionTier.ENTERPRISE}>Enterprise</option>
            <option value={SubscriptionTier.CUSTOM}>Custom</option>
          </select>
        </div>

        <Link
          href="/super-admin/tenants/onboarding"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition self-start md:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Tenant</span>
        </Link>
      </div>

      {/* Tenants Table */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Organization & Slug</th>
                <th className="py-3.5 px-4">Plan & Status</th>
                <th className="py-3.5 px-4">User Capacity</th>
                <th className="py-3.5 px-4">MinIO Storage</th>
                <th className="py-3.5 px-4">Modules Active</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No matching tenants found.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition group">
                    {/* Name & Slug */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md ring-1 ring-white/10"
                          style={{ backgroundColor: t.primaryColor || "#4f46e5" }}
                        >
                          {t.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white flex items-center gap-1.5">
                            {t.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-indigo-400 bg-indigo-950/50 px-1.5 py-0.5 rounded text-[11px] border border-indigo-900/40">
                              /{t.slug}
                            </span>
                            <button
                              onClick={() => handleCopyLink(t.slug)}
                              className="text-slate-500 hover:text-slate-300 transition"
                              title="Copy URL"
                            >
                              {copiedSlug === t.slug ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Plan & Status */}
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {t.plan}
                        </span>
                        <div>
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                              t.status === "ACTIVE"
                                ? "text-emerald-400"
                                : t.status === "TRIAL"
                                ? "text-amber-400"
                                : "text-rose-400"
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {t.status}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* User Quota */}
                    <td className="py-4 px-4 min-w-[140px]">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-slate-300 font-semibold">{t._count.users} Users</span>
                          <span className="text-slate-500">/ {t.maxUsers}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              t.userPercent > 90
                                ? "bg-rose-500"
                                : t.userPercent > 70
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(100, t.userPercent)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Storage Quota */}
                    <td className="py-4 px-4 min-w-[140px]">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-blue-300 font-semibold">{t.usedStorageGb} GB</span>
                          <span className="text-slate-500">/ {t.quotaGb} GB</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              t.storagePercent > 90
                                ? "bg-rose-500"
                                : t.storagePercent > 70
                                ? "bg-amber-500"
                                : "bg-blue-500"
                            }`}
                            style={{ width: `${Math.min(100, t.storagePercent)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Modules Active */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5">
                        {t.payrollEnabled && (
                          <span className="p-1 rounded bg-slate-800 text-emerald-400 font-mono text-[10px]" title="Payroll">
                            $
                          </span>
                        )}
                        {t.geofencingEnabled && (
                          <span className="p-1 rounded bg-slate-800 text-blue-400 font-mono text-[10px]" title="Geofence">
                            GPS
                          </span>
                        )}
                        {t.driveEnabled && (
                          <span className="p-1 rounded bg-slate-800 text-indigo-400 font-mono text-[10px]" title="Drive">
                            DRV
                          </span>
                        )}
                        {t.fileShareEnabled && (
                          <span className="p-1 rounded bg-slate-800 text-purple-400 font-mono text-[10px]" title="FileShare">
                            SHR
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Support Impersonate */}
                        <ImpersonateQuickButton tenantId={t.id} tenantSlug={t.slug} size="sm" />

                        {/* Configure Quotas */}
                        <button
                          onClick={() => setSelectedTenantForQuota(t)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                          title="Configure Quotas & Features"
                        >
                          <Sliders className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quota Configurator Modal */}
      {selectedTenantForQuota && (
        <QuotaConfiguratorModal
          tenant={selectedTenantForQuota}
          isOpen={!!selectedTenantForQuota}
          onClose={() => setSelectedTenantForQuota(null)}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
