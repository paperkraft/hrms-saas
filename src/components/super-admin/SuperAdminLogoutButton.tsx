"use client";

import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { logoutSuperAdmin } from "@/actions/super-admin";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

interface SuperAdminLogoutButtonProps {
  showLabel?: boolean;
  className?: string;
}

export function SuperAdminLogoutButton({
  showLabel = false,
  className = "",
}: SuperAdminLogoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      // 1. Clear NextAuth client session if active
      try {
        await signOut({ redirect: false });
      } catch (e) {
        // Ignore if not logged in via next-auth
      }

      // 2. Call server action to clear cookies
      await logoutSuperAdmin();
    } catch (err: any) {
      // Next.js redirect throws NEXT_REDIRECT which is normal
      if (err?.message?.includes("NEXT_REDIRECT") || err?.digest?.includes("NEXT_REDIRECT")) {
        window.location.href = "/super-admin/login";
        return;
      }
      toast.error("Failed to sign out. Redirecting...");
      window.location.href = "/super-admin/login";
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      title="Sign out of Platform Console"
      className={`p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50 ${className}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
      ) : (
        <LogOut className="w-4 h-4" />
      )}
      {showLabel && (
        <span className="text-xs font-medium">
          {loading ? "Signing out..." : "Sign Out"}
        </span>
      )}
    </button>
  );
}
