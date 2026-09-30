import { getTenants } from "@/actions/super-admin";
import { TenantsManagementTable } from "@/components/super-admin/TenantsManagementTable";
import { Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SuperAdminTenantsPage() {
  const tenants = await getTenants();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-md bg-card border border-border/80 p-4 sm:p-5 shadow-2xs">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider mb-1.5">
          <Building2 className="size-3" />
          Multi-Tenant Workspaces Fleet
        </div>
        <h1 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
          Tenants, Quotas & Support Impersonation
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Monitor user seat utilization, MinIO document quotas, module toggles, and execute secure support impersonation.
        </p>
      </div>

      <TenantsManagementTable initialTenants={tenants} />
    </div>
  );
}
