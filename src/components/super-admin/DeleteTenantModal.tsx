"use client";

import { useState } from "react";
import { deleteTenantPermanently } from "@/actions/super-admin";
import {
  AlertTriangle,
  Trash2,
  X,
  Loader2,
  Users,
  HardDrive,
  FolderTree,
} from "lucide-react";
import { toast } from "sonner";

interface DeleteTenantModalProps {
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan?: string;
    status?: string;
    primaryColor?: string | null;
    _count?: {
      users?: number;
      departments?: number;
      locations?: number;
      projects?: number;
    };
    usedStorageGb?: number;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (deletedTenantId: string) => void;
}

export function DeleteTenantModal({
  tenant,
  isOpen,
  onClose,
  onSuccess,
}: DeleteTenantModalProps) {
  const [confirmSlug, setConfirmSlug] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen || !tenant) return null;

  const isMatched = confirmSlug.trim().toLowerCase() === tenant.slug.toLowerCase();

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatched || loading) return;

    setLoading(true);
    try {
      const res = await deleteTenantPermanently(tenant.id);
      if (res.success) {
        toast.success(res.message || `Tenant ${tenant.name} deleted successfully.`);
        onSuccess(tenant.id);
        onClose();
        setConfirmSlug("");
      } else {
        toast.error(res.error || "Failed to delete tenant");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setConfirmSlug("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg bg-card border border-border rounded-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-destructive/5">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-md bg-destructive/10 text-destructive flex items-center justify-center shrink-0 border border-destructive/20">
              <Trash2 className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-destructive uppercase tracking-wider bg-destructive/10 px-2 py-0.5 rounded-sm border border-destructive/20">
                  Danger Zone
                </span>
                <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  /{tenant.slug}
                </span>
              </div>
              <h2 className="text-base font-bold text-foreground tracking-tight mt-0.5">
                Permanently Delete Tenant
              </h2>
            </div>
          </div>

          <button
            onClick={handleClose}
            disabled={loading}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleDelete} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
          {/* Target Tenant Overview Card */}
          <div className="p-3 bg-muted/40 border border-border/80 rounded-md flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="size-8 rounded-md flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs ring-1 ring-border/50"
                style={{ backgroundColor: tenant.primaryColor || "#4f46e5" }}
              >
                {tenant.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-xs text-foreground truncate">
                  {tenant.name}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono text-primary">/{tenant.slug}</span>
                  <span>•</span>
                  <span className="capitalize">{tenant.plan || "Starter"} Tier</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-right shrink-0">
              <div className="text-[11px] text-muted-foreground">
                <div className="font-bold text-foreground font-mono">
                  {tenant._count?.users || 0}
                </div>
                <div>Users</div>
              </div>
              <div className="text-[11px] text-muted-foreground">
                <div className="font-bold text-foreground font-mono">
                  {tenant.usedStorageGb || 0} GB
                </div>
                <div>Storage</div>
              </div>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-md space-y-2 text-destructive">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-4.5 shrink-0 mt-0.5" />
              <div className="text-xs font-semibold leading-snug">
                Warning: This action is completely irreversible.
              </div>
            </div>
            <p className="text-[11.5px] text-destructive/90 leading-relaxed pl-6.5">
              Deleting this tenant will permanently wipe its entire database workspace including all 
              <strong> user accounts, attendance logs, leave balances, projects, tasks, departments, payroll records, and uploaded MinIO drive files</strong>.
            </p>
          </div>

          {/* Confirmation Input Field */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-foreground">
              To confirm deletion, please type{" "}
              <span className="font-mono font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded border border-destructive/20 select-all">
                {tenant.slug}
              </span>{" "}
              below:
            </label>
            <input
              type="text"
              autoFocus
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              placeholder={`Type "${tenant.slug}" to confirm`}
              className="w-full h-9 bg-background border border-input rounded-md px-3 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none focus:border-destructive focus:ring-1 focus:ring-destructive/30 transition"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="h-9 px-4 rounded-md border border-border text-foreground hover:bg-muted text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!isMatched || loading}
              className="h-9 px-4 rounded-md bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Deleting Tenant...</span>
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" />
                  <span>Permanently Delete Tenant</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
