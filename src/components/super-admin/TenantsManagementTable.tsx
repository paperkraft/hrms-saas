"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Search,
  Sliders,
  Users,
  HardDrive,
  Plus,
  Copy,
  Check,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { ImpersonateQuickButton } from "./ImpersonateQuickButton";
import { QuotaConfiguratorModal } from "./QuotaConfiguratorModal";
import { DeleteTenantModal } from "./DeleteTenantModal";
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
  const [selectedTenantForDelete, setSelectedTenantForDelete] = useState<any | null>(null);
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

  return (
    <div className="space-y-4">
      {/* Search & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, workspace slug, or legal name..."
              className="w-full h-9 bg-background border border-input rounded-md py-1.5 pl-9 pr-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 bg-background border border-input rounded-md px-2.5 text-xs font-medium text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 cursor-pointer"
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
            className="h-9 bg-background border border-input rounded-md px-2.5 text-xs font-medium text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 cursor-pointer"
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
          className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-3.5 h-9 rounded-md shadow-xs transition self-start md:self-auto cursor-pointer"
        >
          <Plus className="size-3.5" />
          <span>New Tenant</span>
        </Link>
      </div>

      {/* Mobile Cards View (Visible on < md screens) */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-md p-8 text-center text-muted-foreground text-xs">
            No matching tenants found.
          </div>
        ) : (
          filtered.map((t) => (
            <div
              key={t.id}
              className="bg-card border border-border rounded-md p-3.5 shadow-2xs space-y-3"
            >
              {/* Header: Avatar, Name, Slug, Plan & Status */}
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className="size-8 rounded-md flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs ring-1 ring-border/50"
                    style={{ backgroundColor: t.primaryColor || "#4f46e5" }}
                  >
                    {t.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs text-foreground truncate">
                      {t.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-primary bg-primary/10 px-1.5 py-0.2 rounded-xs text-[10px] border border-primary/20">
                        /{t.slug}
                      </span>
                      <button
                        onClick={() => handleCopyLink(t.slug)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy URL"
                      >
                        {copiedSlug === t.slug ? (
                          <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Plan & Status Badges */}
                <div className="text-right shrink-0 space-y-1">
                  <span className="inline-block px-1.5 py-0.2 rounded-xs text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
                    {t.plan}
                  </span>
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                        t.status === "ACTIVE"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : t.status === "TRIAL"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-destructive"
                      }`}
                    >
                      <span className="size-1.5 rounded-full bg-current" />
                      {t.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Usage Gauges (2 Columns on Mobile) */}
              <div className="grid grid-cols-2 gap-2.5 pt-1 bg-muted/20 p-2.5 rounded-md border border-border/60">
                {/* Users */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-foreground font-semibold text-[10px]">Users</span>
                    <span className="text-muted-foreground text-[10px]">{t._count.users}/{t.maxUsers}</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        t.userPercent > 90
                          ? "bg-destructive"
                          : t.userPercent > 70
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, t.userPercent)}%` }}
                    />
                  </div>
                </div>

                {/* Storage */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-blue-600 dark:text-blue-400 font-semibold text-[10px]">Storage</span>
                    <span className="text-muted-foreground text-[10px]">{t.usedStorageGb}/{t.quotaGb}G</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        t.storagePercent > 90
                          ? "bg-destructive"
                          : t.storagePercent > 70
                          ? "bg-amber-500"
                          : "bg-blue-500"
                      }`}
                      style={{ width: `${Math.min(100, t.storagePercent)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Modules & Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
                {/* Modules */}
                <div className="flex items-center gap-1">
                  {t.payrollEnabled && (
                    <span className="px-1.5 py-0.5 rounded-xs bg-muted text-emerald-600 dark:text-emerald-400 font-mono text-[9px] font-semibold" title="Payroll">
                      $
                    </span>
                  )}
                  {t.geofencingEnabled && (
                    <span className="px-1.5 py-0.5 rounded-xs bg-muted text-blue-600 dark:text-blue-400 font-mono text-[9px] font-semibold" title="Geofence">
                      GPS
                    </span>
                  )}
                  {t.driveEnabled && (
                    <span className="px-1.5 py-0.5 rounded-xs bg-muted text-primary font-mono text-[9px] font-semibold" title="Drive">
                      DRV
                    </span>
                  )}
                  {t.fileShareEnabled && (
                    <span className="px-1.5 py-0.5 rounded-xs bg-muted text-purple-600 dark:text-purple-400 font-mono text-[9px] font-semibold" title="FileShare">
                      SHR
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  <ImpersonateQuickButton tenantId={t.id} tenantSlug={t.slug} size="sm" />

                  <button
                    onClick={() => setSelectedTenantForQuota(t)}
                    className="p-1.5 rounded-md bg-secondary hover:bg-muted text-secondary-foreground border border-border/80 transition-colors cursor-pointer"
                    title="Configure Quotas & Features"
                  >
                    <Sliders className="size-3.5" />
                  </button>

                  <button
                    onClick={() => setSelectedTenantForDelete(t)}
                    className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 border border-destructive/20 hover:border-destructive/40 transition-colors cursor-pointer"
                    title="Permanently Delete Tenant"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Tenants Table (Visible on md+ screens) */}
      <div className="hidden md:block bg-card border border-border rounded-md overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase text-[11px] font-semibold tracking-wider">
                <th className="py-3 px-4">Organization & Slug</th>
                <th className="py-3 px-4">Plan & Status</th>
                <th className="py-3 px-4">User Capacity</th>
                <th className="py-3 px-4">MinIO Storage</th>
                <th className="py-3 px-4">Modules Active</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">
                    No matching tenants found.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors group">
                    {/* Name & Slug */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="size-8 rounded-md flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs ring-1 ring-border/50"
                          style={{ backgroundColor: t.primaryColor || "#4f46e5" }}
                        >
                          {t.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-foreground flex items-center gap-1.5 truncate">
                            {t.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-primary bg-primary/10 px-1.5 py-0.2 rounded-xs text-[10px] border border-primary/20">
                              /{t.slug}
                            </span>
                            <button
                              onClick={() => handleCopyLink(t.slug)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy URL"
                            >
                              {copiedSlug === t.slug ? (
                                <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Plan & Status */}
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <span className="inline-block px-1.5 py-0.2 rounded-xs text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
                          {t.plan}
                        </span>
                        <div>
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                              t.status === "ACTIVE"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : t.status === "TRIAL"
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-destructive"
                            }`}
                          >
                            <span className="size-1.5 rounded-full bg-current" />
                            {t.status}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* User Quota */}
                    <td className="py-3 px-4 min-w-[130px]">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-foreground font-semibold">{t._count.users} Users</span>
                          <span className="text-muted-foreground">/ {t.maxUsers}</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              t.userPercent > 90
                                ? "bg-destructive"
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
                    <td className="py-3 px-4 min-w-[130px]">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-blue-600 dark:text-blue-400 font-semibold">{t.usedStorageGb} GB</span>
                          <span className="text-muted-foreground">/ {t.quotaGb} GB</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              t.storagePercent > 90
                                ? "bg-destructive"
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
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {t.payrollEnabled && (
                          <span className="px-1.5 py-0.5 rounded-xs bg-muted text-emerald-600 dark:text-emerald-400 font-mono text-[9px] font-semibold" title="Payroll">
                            $
                          </span>
                        )}
                        {t.geofencingEnabled && (
                          <span className="px-1.5 py-0.5 rounded-xs bg-muted text-blue-600 dark:text-blue-400 font-mono text-[9px] font-semibold" title="Geofence">
                            GPS
                          </span>
                        )}
                        {t.driveEnabled && (
                          <span className="px-1.5 py-0.5 rounded-xs bg-muted text-primary font-mono text-[9px] font-semibold" title="Drive">
                            DRV
                          </span>
                        )}
                        {t.fileShareEnabled && (
                          <span className="px-1.5 py-0.5 rounded-xs bg-muted text-purple-600 dark:text-purple-400 font-mono text-[9px] font-semibold" title="FileShare">
                            SHR
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <ImpersonateQuickButton tenantId={t.id} tenantSlug={t.slug} size="sm" />

                        <button
                          onClick={() => setSelectedTenantForQuota(t)}
                          className="p-1.5 rounded-md bg-secondary hover:bg-muted text-secondary-foreground border border-border/80 transition-colors cursor-pointer"
                          title="Configure Quotas & Features"
                        >
                          <Sliders className="size-3.5" />
                        </button>

                        <button
                          onClick={() => setSelectedTenantForDelete(t)}
                          className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 border border-destructive/20 hover:border-destructive/40 transition-colors cursor-pointer"
                          title="Permanently Delete Tenant"
                        >
                          <Trash2 className="size-3.5" />
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

      {/* Permanent Delete Tenant Modal */}
      {selectedTenantForDelete && (
        <DeleteTenantModal
          tenant={selectedTenantForDelete}
          isOpen={!!selectedTenantForDelete}
          onClose={() => setSelectedTenantForDelete(null)}
          onSuccess={(deletedId) => {
            setTenants((prev) => prev.filter((item) => item.id !== deletedId));
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
