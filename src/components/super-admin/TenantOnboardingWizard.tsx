"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  checkSlugAvailability,
  createTenantOnboarding,
  TenantOnboardingInput,
} from "@/actions/super-admin";
import {
  Building2,
  Sliders,
  UserCheck,
  MapPin,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  ShieldCheck,
  HardDrive,
  Users,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Briefcase,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { SubscriptionTier } from "@prisma/client";

const COLOR_PRESETS = [
  { name: "Indigo", hex: "#4f46e5" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Emerald", hex: "#059669" },
  { name: "Violet", hex: "#7c3aed" },
  { name: "Rose", hex: "#e11d48" },
  { name: "Amber", hex: "#d97706" },
  { name: "Cyan", hex: "#0891b2" },
];

export function TenantOnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [provisioningStatus, setProvisioningStatus] = useState<string>("");
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugMessage, setSlugMessage] = useState<string>("");
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [createdResult, setCreatedResult] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState<TenantOnboardingInput>({
    name: "",
    slug: "",
    legalName: "",
    address: "",
    tagline: "Empowering workforce excellence & collaboration.",
    primaryColor: "#4f46e5",
    logoUrl: "",

    plan: SubscriptionTier.STARTER,
    maxUsers: 50,
    driveQuotaGb: 50,

    payrollEnabled: true,
    geofencingEnabled: true,
    driveEnabled: true,
    fileShareEnabled: true,
    taskCommitmentEnabled: true,

    adminName: "",
    adminEmail: "",
    adminPassword: "AdminPassword@" + Math.floor(1000 + Math.random() * 9000),
    adminDesignation: "Chief Administrator",
    adminPhone: "",

    officeStartTime: "09:30",
    officeEndTime: "18:00",
    graceTimeMinutes: 15,
    locationName: "Headquarters",
    locationLat: 16.703244,
    locationLng: 74.253469,
    locationRadius: 50,
    departmentName: "Executive Management",
  });

  // Handle Slug Change with Real-Time Validation
  const handleSlugChange = async (value: string) => {
    const clean = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setFormData((prev) => ({ ...prev, slug: clean }));

    if (clean.length < 3) {
      setSlugAvailable(null);
      setSlugMessage("Slug must be at least 3 characters");
      return;
    }

    setSlugChecking(true);
    try {
      const res = await checkSlugAvailability(clean);
      setSlugAvailable(res.available);
      setSlugMessage(res.message || "");
    } catch {
      setSlugAvailable(false);
      setSlugMessage("Error verifying slug");
    } finally {
      setSlugChecking(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
    let pass = "";
    for (let i = 0; i < 14; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, adminPassword: pass }));
    toast.success("Generated strong admin password");
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(formData.adminPassword);
    setCopiedPassword(true);
    toast.success("Password copied to clipboard");
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const handlePlanSelect = (plan: SubscriptionTier) => {
    let maxUsers = 50;
    let driveQuotaGb = 50;

    switch (plan) {
      case SubscriptionTier.STARTER:
        maxUsers = 50;
        driveQuotaGb = 50;
        break;
      case SubscriptionTier.PROFESSIONAL:
        maxUsers = 250;
        driveQuotaGb = 250;
        break;
      case SubscriptionTier.ENTERPRISE:
        maxUsers = 1000;
        driveQuotaGb = 1024;
        break;
      case SubscriptionTier.CUSTOM:
        maxUsers = formData.maxUsers;
        driveQuotaGb = formData.driveQuotaGb;
        break;
    }

    setFormData((prev) => ({
      ...prev,
      plan,
      maxUsers,
      driveQuotaGb,
    }));
  };

  const validateStep = (currentStep: number): boolean => {
    switch (currentStep) {
      case 1:
        if (!formData.name.trim()) {
          toast.error("Please enter the organization name.");
          return false;
        }
        if (!formData.slug.trim() || formData.slug.length < 3) {
          toast.error("Please enter a valid workspace slug (at least 3 characters).");
          return false;
        }
        if (slugAvailable === false) {
          toast.error("This workspace slug is unavailable. Please choose another.");
          return false;
        }
        return true;

      case 2:
        if (formData.maxUsers < 1) {
          toast.error("User capacity must be at least 1.");
          return false;
        }
        if (formData.driveQuotaGb < 1) {
          toast.error("Storage quota must be at least 1 GB.");
          return false;
        }
        return true;

      case 3:
        if (!formData.adminName.trim()) {
          toast.error("Please enter the initial administrator's name.");
          return false;
        }
        if (!formData.adminEmail.trim() || !formData.adminEmail.includes("@")) {
          toast.error("Please provide a valid administrator email address.");
          return false;
        }
        if (!formData.adminPassword || formData.adminPassword.length < 6) {
          toast.error("Admin password must be at least 6 characters.");
          return false;
        }
        return true;

      case 4:
        if (!formData.locationName?.trim()) {
          toast.error("Please specify primary headquarters location name.");
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(5, prev + 1));
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleExecuteOnboarding = async () => {
    setLoading(true);
    setProvisioningStatus("Creating isolated tenant database record...");

    try {
      setTimeout(() => setProvisioningStatus("Seeding Role-Based Access Control (RBAC) definitions..."), 400);
      setTimeout(() => setProvisioningStatus("Configuring MinIO drive partitions & storage quota..."), 800);
      setTimeout(() => setProvisioningStatus("Creating initial Administrator account and Headquarters..."), 1200);

      const res = await createTenantOnboarding(formData);

      if (res.success) {
        setCreatedResult(res);
        toast.success(`Organization ${formData.name} successfully onboarded!`);
      } else {
        toast.error(res.error || "Tenant provisioning failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  };

  const STEPS = [
    { num: 1, title: "Organization", desc: "Identity & Branding", icon: Building2 },
    { num: 2, title: "Plan & Quota", desc: "Capacity & Features", icon: Sliders },
    { num: 3, title: "Administrator", desc: "Root Credentials", icon: UserCheck },
    { num: 4, title: "Workplace", desc: "Timings & Geofence", icon: MapPin },
    { num: 5, title: "Launch", desc: "Review & Provision", icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Zero-Downtime Provisioning
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Tenant Onboarding Wizard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Configure, initialize, and deploy a fully-isolated organizational workspace in 5 easy steps.
          </p>
        </div>
      </div>

      {/* Stepper Progress Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const isActive = step === s.num;
          const isDone = step > s.num;

          return (
            <div
              key={s.num}
              onClick={() => {
                if (isDone) setStep(s.num);
              }}
              className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-indigo-950/70 border-indigo-500/60 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/30"
                  : isDone
                  ? "bg-slate-900/60 border-slate-800/80 text-emerald-400"
                  : "bg-slate-950/40 border-slate-900 text-slate-500 opacity-60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : isDone
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <div className="truncate">
                  <div className={`text-xs font-bold ${isActive ? "text-white" : isDone ? "text-slate-200" : "text-slate-400"}`}>
                    {s.title}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate hidden sm:block">
                    {s.desc}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Success Result View */}
      {createdResult ? (
        <div className="p-8 rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-emerald-500/30 shadow-2xl backdrop-blur-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10 animate-bounce">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-white">
              Workspace Provisioned Successfully!
            </h2>
            <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
              <strong>{createdResult.name}</strong> is now live with isolated database routing, RBAC roles, storage limits, and admin credentials.
            </p>
          </div>

          {/* Credentials Card */}
          <div className="max-w-lg mx-auto p-5 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800 font-sans">
              <span className="font-semibold text-slate-300">Access Coordinates</span>
              <span className="text-emerald-400 text-[11px] font-mono">STATUS: ACTIVE</span>
            </div>
            <div>
              <span className="text-slate-500">Tenant URL: </span>
              <span className="text-indigo-400 font-bold">/{createdResult.slug}/dashboard</span>
            </div>
            <div>
              <span className="text-slate-500">Admin Email: </span>
              <span className="text-slate-200">{createdResult.adminEmail}</span>
            </div>
            <div>
              <span className="text-slate-500">Initial Password: </span>
              <span className="text-amber-400 font-semibold">{formData.adminPassword}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={() => router.push(`/super-admin/tenants`)}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition"
            >
              Return to Tenants Fleet
            </button>

            <button
              onClick={() => router.push(`/${createdResult.slug}/dashboard/admin`)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition"
            >
              <span>Launch Workspace Portal</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Wizard Form Body */
        <div className="p-6 md:p-8 rounded-3xl bg-slate-900/70 border border-slate-800/80 shadow-2xl backdrop-blur-xl space-y-6">
          {/* STEP 1: ORGANIZATION PROFILE & SLUG */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-800/60 pb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-400" />
                  Step 1: Organization Identity & Workspace URL
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Define the primary business entity details and unique URL path slug.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Organization Display Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        name: val,
                        slug: prev.slug || val.toLowerCase().replace(/[^a-z0-9]/g, "-"),
                      }));
                      if (!formData.slug) {
                        handleSlugChange(val.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                      }
                    }}
                    placeholder="e.g. Sigma Infraplan Pvt Ltd"
                    className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-sm text-white placeholder:text-slate-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Workspace URL Slug *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">
                      /
                    </span>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="sigma"
                      className={`w-full bg-slate-950/70 border rounded-xl py-2.5 pl-7 pr-10 text-sm font-mono text-indigo-300 outline-none ${
                        slugAvailable === true
                          ? "border-emerald-500/80"
                          : slugAvailable === false
                          ? "border-rose-500/80"
                          : "border-slate-700/80 focus:border-indigo-500"
                      }`}
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {slugChecking ? (
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                      ) : slugAvailable === true ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : null}
                    </div>
                  </div>
                  {slugMessage && (
                    <p
                      className={`text-[11px] mt-1.5 font-medium ${
                        slugAvailable ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {slugMessage}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Legal Entity Name
                  </label>
                  <input
                    type="text"
                    value={formData.legalName}
                    onChange={(e) => setFormData((p) => ({ ...p, legalName: e.target.value }))}
                    placeholder="e.g. SIGMA INFRAPLAN ENGINEERING PVT. LTD."
                    className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-sm text-white placeholder:text-slate-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Brand Color Palette
                  </label>
                  <div className="flex items-center gap-2">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        type="button"
                        key={c.hex}
                        onClick={() => setFormData((p) => ({ ...p, primaryColor: c.hex }))}
                        className={`w-7 h-7 rounded-full transition-transform cursor-pointer ring-2 ${
                          formData.primaryColor === c.hex
                            ? "ring-white scale-110 shadow-lg"
                            : "ring-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      />
                    ))}
                    <input
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData((p) => ({ ...p, primaryColor: e.target.value }))}
                      className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer ml-2"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Headquarters Street Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                    placeholder="e.g. Plot No. 13, Laxmi Nagar, Kolhapur 416005, Maharashtra"
                    className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-sm text-white placeholder:text-slate-600 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SUBSCRIPTION TIER & QUOTA LIMITS */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-800/60 pb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-400" />
                  Step 2: Subscription Tier, Seat Quotas & Feature Toggles
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Configure user seat capacity, MinIO storage limits, and module availability.
                </p>
              </div>

              {/* Plan Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    tier: SubscriptionTier.STARTER,
                    name: "Starter",
                    seats: "Up to 50 Seats",
                    storage: "50 GB MinIO",
                    desc: "Ideal for boutique consultancies & emerging startups.",
                  },
                  {
                    tier: SubscriptionTier.PROFESSIONAL,
                    name: "Professional",
                    seats: "Up to 250 Seats",
                    storage: "250 GB MinIO",
                    desc: "Optimal for mid-sized growing engineering teams.",
                  },
                  {
                    tier: SubscriptionTier.ENTERPRISE,
                    name: "Enterprise",
                    seats: "Up to 1,000 Seats",
                    storage: "1 TB MinIO",
                    desc: "Full-scale corporate governance and unlimited archival.",
                  },
                  {
                    tier: SubscriptionTier.CUSTOM,
                    name: "Custom / Flex",
                    seats: "Manual Quota",
                    storage: "Custom Storage",
                    desc: "Tailored seat and storage allocation.",
                  },
                ].map((p) => {
                  const isSelected = formData.plan === p.tier;
                  return (
                    <div
                      key={p.tier}
                      onClick={() => handlePlanSelect(p.tier)}
                      className={`p-5 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-indigo-950/80 border-indigo-500 shadow-xl shadow-indigo-500/10 ring-2 ring-indigo-500/30"
                          : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm text-white">{p.name}</span>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px]">
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mb-3">{p.desc}</p>
                      </div>

                      <div className="space-y-1 pt-3 border-t border-slate-800/60 font-mono text-xs">
                        <div className="text-indigo-300 font-semibold">{p.seats}</div>
                        <div className="text-blue-400">{p.storage}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sliders / Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
                <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400" />
                      Max User Seat Limit
                    </label>
                    <span className="font-bold font-mono text-emerald-400 text-base">
                      {formData.maxUsers} Users
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="2000"
                    step="5"
                    value={formData.maxUsers}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, maxUsers: parseInt(e.target.value) || 1 }))
                    }
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-blue-400" />
                      Drive & File Storage Quota
                    </label>
                    <span className="font-bold font-mono text-blue-400 text-base">
                      {formData.driveQuotaGb} GB
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="2000"
                    step="10"
                    value={formData.driveQuotaGb}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, driveQuotaGb: parseInt(e.target.value) || 1 }))
                    }
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Granular Module Switches */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Module Feature Switches
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { key: "payrollEnabled", label: "Payroll & Salary Structures" },
                    { key: "geofencingEnabled", label: "Geofencing & GPS Radius" },
                    { key: "driveEnabled", label: "Drive Storage & Library" },
                    { key: "fileShareEnabled", label: "Direct File Share Links" },
                    { key: "taskCommitmentEnabled", label: "Task Commitments & Sprints" },
                  ].map((f) => (
                    <label
                      key={f.key}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs font-medium text-slate-200 cursor-pointer hover:bg-slate-900 transition"
                    >
                      <span>{f.label}</span>
                      <input
                        type="checkbox"
                        checked={(formData as any)[f.key]}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, [f.key]: e.target.checked }))
                        }
                        className="w-4 h-4 rounded text-indigo-600 accent-indigo-500 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: INITIAL ADMINISTRATOR */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-800/60 pb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-indigo-400" />
                  Step 3: Root Tenant Administrator Account
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Provision the primary administrator user with root organization authority.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Administrator Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.adminName}
                    onChange={(e) => setFormData((p) => ({ ...p, adminName: e.target.value }))}
                    placeholder="e.g. Ashish Doshi"
                    className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-sm text-white placeholder:text-slate-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Administrator Official Email *
                  </label>
                  <input
                    type="email"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData((p) => ({ ...p, adminEmail: e.target.value }))}
                    placeholder="e.g. admin@sigma.com"
                    className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-sm text-white placeholder:text-slate-600 outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Initial Password *
                    </label>
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> Generate Random
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.adminPassword}
                      onChange={(e) => setFormData((p) => ({ ...p, adminPassword: e.target.value }))}
                      className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 rounded-xl py-2.5 pl-4 pr-10 text-sm font-mono text-amber-300 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      title="Copy Password"
                    >
                      {copiedPassword ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Designation / Title
                  </label>
                  <input
                    type="text"
                    value={formData.adminDesignation}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, adminDesignation: e.target.value }))
                    }
                    placeholder="Managing Director / CEO"
                    className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-sm text-white placeholder:text-slate-600 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: WORKPLACE TIMINGS & LOCATION */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-800/60 pb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-indigo-400" />
                  Step 4: Workplace Policies & Headquarters Geofence
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Establish working hours, punch grace allowance, and primary branch geofence.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" /> Office Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.officeStartTime}
                    onChange={(e) => setFormData((p) => ({ ...p, officeStartTime: e.target.value }))}
                    className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-sm text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" /> Office End Time
                  </label>
                  <input
                    type="time"
                    value={formData.officeEndTime}
                    onChange={(e) => setFormData((p) => ({ ...p, officeEndTime: e.target.value }))}
                    className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-sm text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Late Mark Grace Time (Mins)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={formData.graceTimeMinutes}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, graceTimeMinutes: parseInt(e.target.value) || 0 }))
                    }
                    className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-sm text-white outline-none font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Primary Office / HQ Location Name
                  </label>
                  <input
                    type="text"
                    value={formData.locationName}
                    onChange={(e) => setFormData((p) => ({ ...p, locationName: e.target.value }))}
                    placeholder="Head Office - Kolhapur"
                    className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-sm text-white placeholder:text-slate-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Geofence Radius (Meters)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={formData.locationRadius}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, locationRadius: parseInt(e.target.value) || 50 }))
                    }
                    className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-sm text-white outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & INSTANT PROVISIONING */}
          {step === 5 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-800/60 pb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                  Step 5: Review & Instant Fleet Provisioning
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Confirm the parameters before launching the isolated tenant database partition.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Organization Summary */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs">
                  <div className="font-bold text-indigo-300 uppercase text-[11px] pb-1 border-b border-slate-800">
                    Organization Profile
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Name:</span>
                    <strong className="text-white">{formData.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">URL Slug:</span>
                    <strong className="text-indigo-400 font-mono">/{formData.slug}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Legal Name:</span>
                    <span className="text-slate-300">{formData.legalName || formData.name}</span>
                  </div>
                </div>

                {/* Plan Summary */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs">
                  <div className="font-bold text-indigo-300 uppercase text-[11px] pb-1 border-b border-slate-800">
                    Tier & Storage
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Plan Tier:</span>
                    <strong className="text-white">{formData.plan}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">User Limit:</span>
                    <strong className="text-emerald-400 font-mono">{formData.maxUsers} Users</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Drive Quota:</span>
                    <strong className="text-blue-400 font-mono">{formData.driveQuotaGb} GB</strong>
                  </div>
                </div>

                {/* Administrator Summary */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs">
                  <div className="font-bold text-indigo-300 uppercase text-[11px] pb-1 border-b border-slate-800">
                    Root Administrator
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Admin Name:</span>
                    <strong className="text-white">{formData.adminName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Admin Email:</span>
                    <strong className="text-slate-200">{formData.adminEmail}</strong>
                  </div>
                </div>

                {/* Workplace Summary */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs">
                  <div className="font-bold text-indigo-300 uppercase text-[11px] pb-1 border-b border-slate-800">
                    Workplace Timings
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hours:</span>
                    <strong className="text-white">
                      {formData.officeStartTime} - {formData.officeEndTime}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Grace Allowance:</span>
                    <span className="text-slate-300">{formData.graceTimeMinutes} mins</span>
                  </div>
                </div>
              </div>

              {loading && (
                <div className="p-4 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 text-center space-y-2 animate-pulse">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto" />
                  <p className="text-xs font-mono text-indigo-200">{provisioningStatus}</p>
                </div>
              )}
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800/60">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1 || loading}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-30 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            {step < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExecuteOnboarding}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-xl shadow-emerald-600/25 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Provisioning Fleet Partition...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Deploy & Launch Tenant</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
