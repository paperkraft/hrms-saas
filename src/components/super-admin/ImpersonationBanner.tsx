"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { stopImpersonation } from "@/actions/super-admin";
import { ShieldAlert, LogOut, Loader2, Sparkles, Building2 } from "lucide-react";
import { toast } from "sonner";

export interface ImpersonationData {
  superAdminEmail?: string;
  tenantName?: string;
  tenantSlug?: string;
  targetUserName?: string;
  targetUserEmail?: string;
  startedAt?: string;
}

function safeDecodeBase64Url(str: string): ImpersonationData | null {
  try {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonStr);
  } catch {
    try {
      return JSON.parse(atob(str.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      return null;
    }
  }
}

export function ImpersonationBanner() {
  const router = useRouter();
  const [impersonation, setImpersonation] = useState<ImpersonationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState("0m");

  useEffect(() => {
    // Parse cookie on client
    function checkCookie() {
      const match = document.cookie
        .split("; ")
        .find((row) => row.startsWith("saas_impersonation_session="));

      if (match) {
        try {
          const raw = match.split("=")[1];
          const [payload] = raw.split(".");
          const parsed = safeDecodeBase64Url(payload);
          setImpersonation(parsed);
        } catch {
          setImpersonation(null);
        }
      } else {
        setImpersonation(null);
      }
    }

    checkCookie();
    const interval = setInterval(checkCookie, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!impersonation?.startedAt) return;
    const updateElapsed = () => {
      const diff = Math.floor((Date.now() - new Date(impersonation.startedAt!).getTime()) / 1000);
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setElapsed(`${mins}m ${secs}s`);
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [impersonation]);

  if (!impersonation) return null;

  const handleExit = async () => {
    setLoading(true);
    try {
      const res = await stopImpersonation();
      if (res.success) {
        toast.success("Support impersonation session ended");
        window.location.href = res.redirectUrl || "/super-admin/tenants";
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to exit impersonation");
      setLoading(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-amber-600 via-rose-600 to-amber-700 text-white shadow-xl px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-between border-b border-amber-300/30 backdrop-blur-md animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white/20 text-white shrink-0 ring-2 ring-white/30 animate-pulse">
          <ShieldAlert className="w-4 h-4" />
        </div>
        <div className="flex flex-wrap items-center gap-2 truncate">
          <span className="font-bold tracking-wide uppercase text-[11px] bg-black/30 px-2 py-0.5 rounded text-amber-200 border border-amber-300/20">
            Super Admin Support Mode
          </span>
          <span className="text-white/90 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 opacity-80" />
            Workspace: <strong className="text-white underline decoration-amber-300/60">{impersonation.tenantName || impersonation.tenantSlug}</strong>
          </span>
          <span className="hidden sm:inline text-white/50">•</span>
          <span className="hidden sm:inline text-white/90">
            Impersonating: <strong className="text-white">{impersonation.targetUserName || impersonation.targetUserEmail}</strong>
          </span>
          <span className="hidden md:inline text-white/50">•</span>
          <span className="hidden md:inline text-amber-100/80 font-mono text-[11px] bg-black/20 px-1.5 py-0.5 rounded">
            ⏱ {elapsed}
          </span>
        </div>
      </div>

      <button
        onClick={handleExit}
        disabled={loading}
        className="shrink-0 flex items-center gap-1.5 bg-white text-slate-900 hover:bg-amber-50 active:scale-95 transition-all duration-150 px-3 py-1 rounded-md font-semibold text-xs shadow-md border border-white/40 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <LogOut className="w-3.5 h-3.5 text-rose-600" />
        )}
        <span>Exit Impersonation</span>
      </button>
    </div>
  );
}
