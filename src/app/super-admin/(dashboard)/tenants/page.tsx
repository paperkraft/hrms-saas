import { getTenants } from "@/actions/super-admin";
import { TenantsManagementTable } from "@/components/super-admin/TenantsManagementTable";
import { Building2, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SuperAdminTenantsPage() {
  const tenants = await getTenants();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b border-slate-800/80 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <Building2 className="w-3.5 h-3.5" />
          Multi-Tenant Workspaces Fleet
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          Tenants, Quotas & Support Impersonation
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Monitor user seat utilization, MinIO document quotas, module toggles, and execute secure support impersonation.
        </p>
      </div>

      <TenantsManagementTable initialTenants={tenants} />
    </div>
  );
}
