"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startImpersonation } from "@/actions/super-admin";
import { ShieldAlert, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function ImpersonateQuickButton({
  tenantId,
  tenantSlug,
  targetUserId,
  size = "sm",
}: {
  tenantId: string;
  tenantSlug: string;
  targetUserId?: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleImpersonate = async () => {
    setLoading(true);
    try {
      const res = await startImpersonation(tenantId, targetUserId);
      if (res.success && res.redirectUrl) {
        toast.success(`Support impersonation started for workspace /${tenantSlug}`);
        router.push(res.redirectUrl);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to start impersonation");
      }
    } catch (err: any) {
      toast.error(err.message || "Impersonation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleImpersonate}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition cursor-pointer disabled:opacity-50 ${
        size === "sm"
          ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 text-xs"
          : "bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white px-3.5 py-2 text-sm shadow-md"
      }`}
      title={`Impersonate Admin at /${tenantSlug}`}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
      )}
      <span>Support Impersonate</span>
    </button>
  );
}
