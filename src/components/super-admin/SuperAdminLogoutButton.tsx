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
      className={`p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs ${className}`}
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin text-destructive" />
      ) : (
        <LogOut className="size-3.5" />
      )}
      {showLabel && (
        <span className="text-xs font-semibold">
          {loading ? "Signing out..." : "Sign Out"}
        </span>
      )}
    </button>
  );
}
