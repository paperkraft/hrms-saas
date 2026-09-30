"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startImpersonation } from "@/actions/super-admin";
import { ShieldAlert, Loader2 } from "lucide-react";
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
        window.location.href = res.redirectUrl;
      } else {
        toast.error(res.error || "Failed to start impersonation");
        setLoading(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Impersonation failed");
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleImpersonate}
      disabled={loading}
      className={`inline-flex items-center gap-1 rounded-md font-semibold transition cursor-pointer disabled:opacity-50 ${
        size === "sm"
          ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/25 px-2 py-1 text-[11px]"
          : "bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-xs shadow-xs"
      }`}
      title={`Impersonate Admin at /${tenantSlug}`}
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <ShieldAlert className="size-3 text-amber-600 dark:text-amber-400" />
      )}
      <span>Support Impersonate</span>
    </button>
  );
}
