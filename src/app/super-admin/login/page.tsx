"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginSuperAdmin } from "@/actions/super-admin";
import { ShieldCheck, Lock, Mail, ArrowRight, Loader2, Sparkles, Building2, Server } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/super-admin";

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
        router.push(callbackUrl);
        router.refresh();
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden selection:bg-indigo-500/30">
      {/* Dynamic Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="w-full max-w-md z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 shadow-2xl mb-4 shadow-indigo-500/10 backdrop-blur-xl">
            <ShieldCheck className="w-9 h-9 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Platform Super Admin
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Multi-Tenant SaaS Infrastructure & Governance Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 shadow-2xl shadow-black/60 relative">
          <div className="flex items-center gap-2 mb-6 px-3 py-1.5 rounded-lg bg-indigo-950/60 border border-indigo-800/40 text-indigo-300 text-xs font-medium">
            <Server className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Multi-Tenant Root Control Plane</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Super Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="superadmin@hrms.com"
                  required
                  autoFocus
                  className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-600 transition outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Master Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-600 transition outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium py-2.5 px-4 rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <span>Access Platform Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800/60 text-center">
            <span className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Isolated Multi-Tenant Security & Tenant Isolation Active
            </span>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-slate-500">
          Looking for your organization portal? Use your workspace URL:{" "}
          <span className="text-indigo-400 font-mono">/[tenant-slug]/login</span>
        </div>
      </div>
    </div>
  );
}
