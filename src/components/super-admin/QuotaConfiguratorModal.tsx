"use client";

import { useState } from "react";
import {
  updateTenantQuotasAndFeatures,
  TenantQuotaUpdateInput,
} from "@/actions/super-admin";
import {
  X,
  HardDrive,
  Users,
  CheckCircle2,
  Mail,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { SubscriptionTier, TenantStatus } from "@prisma/client";

export function QuotaConfiguratorModal({
  tenant,
  isOpen,
  onClose,
  onSuccess,
}: {
  tenant: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<TenantQuotaUpdateInput>({
    maxUsers: tenant.maxUsers || 50,
    driveQuotaGb: tenant.quotaGb || Math.round((tenant.driveQuotaBytes || 53687091200) / (1024 * 1024 * 1024)),
    plan: tenant.plan || SubscriptionTier.STARTER,
    status: tenant.status || TenantStatus.ACTIVE,
    payrollEnabled: tenant.payrollEnabled ?? true,
    geofencingEnabled: tenant.geofencingEnabled ?? true,
    driveEnabled: tenant.driveEnabled ?? true,
    fileShareEnabled: tenant.fileShareEnabled ?? true,
    taskCommitmentEnabled: tenant.taskCommitmentEnabled ?? true,
    smtpHost: tenant.smtpHost || "",
    smtpPort: tenant.smtpPort || null,
    smtpUser: tenant.smtpUser || "",
    smtpPass: tenant.smtpPass || "",
    smtpFrom: tenant.smtpFrom || "",
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await updateTenantQuotasAndFeatures(tenant.id, formData);
      if (res.success) {
        toast.success(`Quotas & features updated for ${tenant.name}`);
        onSuccess();
        onClose();
      } else {
        toast.error("Failed to update quotas");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update tenant quotas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-card border border-border rounded-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/30">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-sm">
                Quota & Feature Configurator
              </span>
              <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                /{tenant.slug}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight mt-1">
              {tenant.name}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-5 overflow-y-auto flex-1 text-xs sm:text-sm">
          {/* Status & Plan Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Subscription Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, status: e.target.value as TenantStatus }))
                }
                className="w-full h-9 bg-background border border-input rounded-md px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              >
                <option value={TenantStatus.ACTIVE}>ACTIVE - Full Platform Access</option>
                <option value={TenantStatus.TRIAL}>TRIAL - Evaluation Period</option>
                <option value={TenantStatus.SUSPENDED}>SUSPENDED - Billing / Compliance Hold</option>
                <option value={TenantStatus.EXPIRED}>EXPIRED - Grace Period Ended</option>
                <option value={TenantStatus.ARCHIVED}>ARCHIVED - Read-Only Stored</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Subscription Tier
              </label>
              <select
                value={formData.plan}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, plan: e.target.value as SubscriptionTier }))
                }
                className="w-full h-9 bg-background border border-input rounded-md px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              >
                <option value={SubscriptionTier.STARTER}>STARTER Tier</option>
                <option value={SubscriptionTier.PROFESSIONAL}>PROFESSIONAL Tier</option>
                <option value={SubscriptionTier.ENTERPRISE}>ENTERPRISE Tier</option>
                <option value={SubscriptionTier.CUSTOM}>CUSTOM Tier</option>
              </select>
            </div>
          </div>

          {/* Quotas Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-3.5 rounded-md bg-muted/40 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Users className="size-3.5 text-primary" /> Max User Seats
                </span>
                <span className="text-primary font-bold font-mono text-xs">
                  {formData.maxUsers} Seats
                </span>
              </div>
              <input
                type="number"
                min="1"
                max="5000"
                value={formData.maxUsers}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, maxUsers: parseInt(e.target.value) || 1 }))
                }
                className="w-full h-8 bg-background border border-input rounded-md px-2.5 text-xs font-mono text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
              <p className="text-[11px] text-muted-foreground">
                Currently using {tenant._count?.users || 0} active seats
              </p>
            </div>

            <div className="p-3.5 rounded-md bg-muted/40 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <HardDrive className="size-3.5 text-blue-600 dark:text-blue-400" /> Drive Storage (GB)
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-bold font-mono text-xs">
                  {formData.driveQuotaGb} GB
                </span>
              </div>
              <input
                type="number"
                min="1"
                max="10000"
                value={formData.driveQuotaGb}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, driveQuotaGb: parseInt(e.target.value) || 1 }))
                }
                className="w-full h-8 bg-background border border-input rounded-md px-2.5 text-xs font-mono text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
              <p className="text-[11px] text-muted-foreground">
                Currently using {tenant.usedStorageGb || 0} GB
              </p>
            </div>
          </div>

          {/* Granular Feature Toggles */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tenant Feature Flags
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { key: "payrollEnabled", label: "Payroll & Compensation" },
                { key: "geofencingEnabled", label: "Geofenced Mobile Punch" },
                { key: "driveEnabled", label: "Drive Storage & Library" },
                { key: "fileShareEnabled", label: "Direct File Transfers" },
                { key: "taskCommitmentEnabled", label: "Task Commitments & Capacity" },
              ].map((f) => (
                <label
                  key={f.key}
                  className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border text-xs font-medium text-foreground cursor-pointer hover:bg-muted/60 transition-colors"
                >
                  <span>{f.label}</span>
                  <input
                    type="checkbox"
                    checked={(formData as any)[f.key]}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, [f.key]: e.target.checked }))
                    }
                    className="size-4 rounded-xs accent-primary cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Custom SMTP Configuration */}
          <div className="space-y-2.5 pt-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="size-3.5 text-primary" /> Custom SMTP Mailer (Optional)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                placeholder="SMTP Host (e.g. smtp.office365.com)"
                value={formData.smtpHost || ""}
                onChange={(e) => setFormData((p) => ({ ...p, smtpHost: e.target.value }))}
                className="w-full h-8 bg-background border border-input rounded-md px-2.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
              <input
                type="number"
                placeholder="Port (587 / 465)"
                value={formData.smtpPort || ""}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, smtpPort: parseInt(e.target.value) || null }))
                }
                className="w-full h-8 bg-background border border-input rounded-md px-2.5 text-xs text-foreground outline-none focus:border-primary font-mono"
              />
              <input
                type="text"
                placeholder="SMTP Username / Email"
                value={formData.smtpUser || ""}
                onChange={(e) => setFormData((p) => ({ ...p, smtpUser: e.target.value }))}
                className="w-full h-8 bg-background border border-input rounded-md px-2.5 text-xs text-foreground outline-none focus:border-primary"
              />
              <input
                type="password"
                placeholder="SMTP Password"
                value={formData.smtpPass || ""}
                onChange={(e) => setFormData((p) => ({ ...p, smtpPass: e.target.value }))}
                className="w-full h-8 bg-background border border-input rounded-md px-2.5 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-input text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  <span>Update Quotas</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
