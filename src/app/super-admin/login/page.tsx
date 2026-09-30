"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginSuperAdmin } from "@/actions/super-admin";
import { ShieldCheck, Lock, Mail, ArrowRight, Loader2, Server, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/super-admin";

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter your Super Admin email and password");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("password", password);

      const res = await loginSuperAdmin(formData);
      if (res.success) {
        toast.success("Super Administrator authenticated successfully");
        window.location.href = callbackUrl;
      } else {
        toast.error(res.error || "Authentication failed");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] dark:bg-background text-foreground flex flex-col justify-center items-center p-4 relative selection:bg-primary/20">

      <div className="w-full max-w-md z-10 space-y-5">
        {/* Header Branding */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center size-12 rounded-md bg-primary/10 border border-primary/20 text-primary shadow-xs mb-3">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Platform Super Admin
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Multi-Tenant SaaS Infrastructure & Governance Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-card border border-border rounded-md p-6 sm:p-7 shadow-2xs relative">
          <div className="flex items-center gap-2 mb-5 px-2.5 py-1.5 rounded-sm bg-primary/5 border border-primary/20 text-primary text-xs font-medium">
            <Server className="size-3.5 text-primary shrink-0" />
            <span>Multi-Tenant Root Control Plane</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Super Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="superadmin@hrms.com"
                  required
                  autoFocus
                  className="w-full h-9 bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md pl-9 pr-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground transition outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Master Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full h-9 bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md pl-9 pr-9 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground transition outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none p-0.5 rounded cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-4 rounded-md shadow-xs flex items-center justify-center gap-1.5 text-xs sm:text-sm transition active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <span>Access Platform Console</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-border/60 text-center">
            <span className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              Isolated Multi-Tenant Security & Tenant Isolation Active
            </span>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-muted-foreground">
          Looking for your organization portal? Use your workspace URL:{" "}
          <span className="text-primary font-mono font-semibold">/[tenant-slug]/login</span>
        </div>
      </div>
    </div>
  );
}
