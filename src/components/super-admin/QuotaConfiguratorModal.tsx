"use client";

import { useState } from "react";
import {
  updateTenantQuotasAndFeatures,
  TenantQuotaUpdateInput,
} from "@/actions/super-admin";
import {
  X,
  Sliders,
  HardDrive,
  Users,
  ShieldCheck,
  CheckCircle2,
  Mail,
  Loader2,
  Layers,
  Sparkles,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                Quota & Feature Configurator
              </span>
              <span className="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                /{tenant.slug}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight mt-0.5">
              {tenant.name}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 text-sm">
          {/* Status & Plan Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Subscription Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, status: e.target.value as TenantStatus }))
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-white outline-none focus:border-indigo-500"
              >
                <option value={TenantStatus.ACTIVE}>ACTIVE - Full Platform Access</option>
                <option value={TenantStatus.TRIAL}>TRIAL - Evaluation Period</option>
                <option value={TenantStatus.SUSPENDED}>SUSPENDED - Billing / Compliance Hold</option>
                <option value={TenantStatus.EXPIRED}>EXPIRED - Grace Period Ended</option>
                <option value={TenantStatus.ARCHIVED}>ARCHIVED - Read-Only Stored</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Subscription Tier
              </label>
              <select
                value={formData.plan}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, plan: e.target.value as SubscriptionTier }))
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-white outline-none focus:border-indigo-500"
              >
                <option value={SubscriptionTier.STARTER}>STARTER Tier</option>
                <option value={SubscriptionTier.PROFESSIONAL}>PROFESSIONAL Tier</option>
                <option value={SubscriptionTier.ENTERPRISE}>ENTERPRISE Tier</option>
                <option value={SubscriptionTier.CUSTOM}>CUSTOM Tier</option>
              </select>
            </div>
          </div>

          {/* Quotas Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-400" /> Max User Seats
                </span>
                <span className="text-emerald-400 font-bold font-mono text-sm">
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
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-sm font-mono text-white outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500">
                Currently using {tenant._count?.users || 0} active seats
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-blue-400" /> Drive Storage (GB)
                </span>
                <span className="text-blue-400 font-bold font-mono text-sm">
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
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-sm font-mono text-white outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500">
                Currently using {tenant.usedStorageGb || 0} GB
              </p>
            </div>
          </div>

          {/* Granular Feature Toggles */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Tenant Feature Flags
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { key: "payrollEnabled", label: "Payroll & Compensation" },
                { key: "geofencingEnabled", label: "Geofenced Mobile Punch" },
                { key: "driveEnabled", label: "Drive Storage & Library" },
                { key: "fileShareEnabled", label: "Direct File Transfers" },
                { key: "taskCommitmentEnabled", label: "Task Commitments & Capacity" },
              ].map((f) => (
                <label
                  key={f.key}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-xs font-medium text-slate-200 cursor-pointer hover:bg-slate-800/40 transition"
                >
                  <span>{f.label}</span>
                  <input
                    type="checkbox"
                    checked={(formData as any)[f.key]}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, [f.key]: e.target.checked }))
                    }
                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-500 cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Custom SMTP Configuration */}
          <div className="space-y-3 pt-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-purple-400" /> Custom SMTP Mailer (Optional)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="SMTP Host (e.g. smtp.office365.com)"
                value={formData.smtpHost || ""}
                onChange={(e) => setFormData((p) => ({ ...p, smtpHost: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-indigo-500"
              />
              <input
                type="number"
                placeholder="Port (587 / 465)"
                value={formData.smtpPort || ""}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, smtpPort: parseInt(e.target.value) || null }))
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-indigo-500 font-mono"
              />
              <input
                type="text"
                placeholder="SMTP Username / Email"
                value={formData.smtpUser || ""}
                onChange={(e) => setFormData((p) => ({ ...p, smtpUser: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-indigo-500"
              />
              <input
                type="password"
                placeholder="SMTP Password"
                value={formData.smtpPass || ""}
                onChange={(e) => setFormData((p) => ({ ...p, smtpPass: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Quotas...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
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
