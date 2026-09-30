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
  ExternalLink,
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
    <div className="space-y-6 animate-fade-in">
      {/* Top Header Banner */}
      <div className="rounded-md bg-card border border-border/80 p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider mb-1.5">
            <Sparkles className="size-3" />
            Zero-Downtime Provisioning
          </div>
          <h1 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
            Tenant Onboarding Wizard
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure, initialize, and deploy a fully-isolated organizational workspace in 5 easy steps.
          </p>
        </div>
      </div>

      {/* Stepper Progress Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
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
              className={`p-3 rounded-md border transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-primary/5 border-primary shadow-2xs"
                  : isDone
                  ? "bg-card border-border text-foreground hover:bg-muted/40"
                  : "bg-muted/20 border-border/50 text-muted-foreground opacity-60"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`size-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0 transition ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : isDone
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                </div>
                <div className="truncate min-w-0">
                  <div className={`text-xs font-bold truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                    {s.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate hidden sm:block">
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
        <div className="p-6 sm:p-8 rounded-md bg-card border border-border shadow-2xs text-center space-y-5">
          <div className="size-12 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="size-6" />
          </div>

          <div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              Workspace Provisioned Successfully!
            </h2>
            <p className="text-muted-foreground text-xs mt-1 max-w-md mx-auto">
              <strong>{createdResult.name}</strong> is now live with isolated database routing, RBAC roles, storage limits, and admin credentials.
            </p>
          </div>

          {/* Credentials Card */}
          <div className="max-w-md mx-auto p-4 rounded-md bg-muted/40 border border-border text-left space-y-2.5 font-mono text-xs">
            <div className="flex justify-between items-center text-muted-foreground pb-2 border-b border-border font-sans">
              <span className="font-semibold text-foreground text-xs">Access Coordinates</span>
              <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-semibold">STATUS: ACTIVE</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">Tenant URL: </span>
              <span className="text-primary font-bold">/{createdResult.slug}/dashboard</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">Admin Email: </span>
              <span className="text-foreground">{createdResult.adminEmail}</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">Initial Password: </span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold">{formData.adminPassword}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => router.push(`/super-admin/tenants`)}
              className="px-4 py-2 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-input text-xs font-semibold transition cursor-pointer"
            >
              Return to Tenants Fleet
            </button>

            <button
              onClick={() => router.push(`/${createdResult.slug}/dashboard/admin`)}
              className="px-4 py-2 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>Launch Workspace Portal</span>
              <ExternalLink className="size-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* Wizard Form Body */
        <div className="p-5 sm:p-6 rounded-md bg-card border border-border/80 shadow-2xs space-y-6">
          {/* STEP 1: ORGANIZATION PROFILE & SLUG */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-border/80 pb-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Building2 className="size-4 text-primary" />
                  Step 1: Organization Identity & Workspace URL
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Define the primary business entity details and unique URL path slug.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
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
                    className="w-full h-9 bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md px-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Workspace URL Slug *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">
                      /
                    </span>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="sigma"
                      className={`w-full h-9 bg-background border rounded-md pl-6 pr-8 text-xs sm:text-sm font-mono text-primary outline-none transition ${
                        slugAvailable === true
                          ? "border-emerald-500"
                          : slugAvailable === false
                          ? "border-destructive"
                          : "border-input focus:border-primary focus:ring-1 focus:ring-primary/20"
                      }`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {slugChecking ? (
                        <Loader2 className="size-3.5 text-primary animate-spin" />
                      ) : slugAvailable === true ? (
                        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : null}
                    </div>
                  </div>
                  {slugMessage && (
                    <p
                      className={`text-[11px] mt-1 font-medium ${
                        slugAvailable ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                      }`}
                    >
                      {slugMessage}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Legal Entity Name
                  </label>
                  <input
                    type="text"
                    value={formData.legalName}
                    onChange={(e) => setFormData((p) => ({ ...p, legalName: e.target.value }))}
                    placeholder="e.g. SIGMA INFRAPLAN ENGINEERING PVT. LTD."
                    className="w-full h-9 bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md px-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Brand Color Palette
                  </label>
                  <div className="flex items-center gap-2">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        type="button"
                        key={c.hex}
                        onClick={() => setFormData((p) => ({ ...p, primaryColor: c.hex }))}
                        className={`size-6 rounded-full transition-transform cursor-pointer ring-2 ${
                          formData.primaryColor === c.hex
                            ? "ring-primary scale-110 shadow-xs"
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
                      className="size-7 rounded-md bg-transparent border-0 cursor-pointer ml-1"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Headquarters Street Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                    placeholder="e.g. Plot No. 13, Laxmi Nagar, Kolhapur 416005, Maharashtra"
                    className="w-full h-9 bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md px-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SUBSCRIPTION TIER & QUOTA LIMITS */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-border/80 pb-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Sliders className="size-4 text-primary" />
                  Step 2: Subscription Tier, Seat Quotas & Feature Toggles
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure user seat capacity, MinIO storage limits, and module availability.
                </p>
              </div>

              {/* Plan Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    tier: SubscriptionTier.STARTER,
                    name: "Starter",
                    seats: "Up to 50 Seats",
                    storage: "50 GB MinIO",
                    desc: "Ideal for boutique consultancies & startups.",
                  },
                  {
                    tier: SubscriptionTier.PROFESSIONAL,
                    name: "Professional",
                    seats: "Up to 250 Seats",
                    storage: "250 GB MinIO",
                    desc: "Optimal for growing engineering teams.",
                  },
                  {
                    tier: SubscriptionTier.ENTERPRISE,
                    name: "Enterprise",
                    seats: "Up to 1,000 Seats",
                    storage: "1 TB MinIO",
                    desc: "Corporate governance & archival.",
                  },
                  {
                    tier: SubscriptionTier.CUSTOM,
                    name: "Custom / Flex",
                    seats: "Manual Quota",
                    storage: "Custom Storage",
                    desc: "Tailored seat & storage allocation.",
                  },
                ].map((p) => {
                  const isSelected = formData.plan === p.tier;
                  return (
                    <div
                      key={p.tier}
                      onClick={() => handlePlanSelect(p.tier)}
                      className={`p-4 rounded-md border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-primary/5 border-primary shadow-2xs ring-1 ring-primary/30"
                          : "bg-card border-border hover:bg-muted/30"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-foreground">{p.name}</span>
                          {isSelected && (
                            <span className="size-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-bold">
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mb-2.5">{p.desc}</p>
                      </div>

                      <div className="space-y-0.5 pt-2 border-t border-border/60 font-mono text-[11px]">
                        <div className="text-primary font-semibold">{p.seats}</div>
                        <div className="text-blue-600 dark:text-blue-400">{p.storage}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sliders / Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-md bg-muted/40 border border-border/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Users className="size-3.5 text-primary" />
                      Max User Seat Limit
                    </label>
                    <span className="font-bold font-mono text-primary text-sm">
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
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-md bg-muted/40 border border-border/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <HardDrive className="size-3.5 text-blue-600 dark:text-blue-400" />
                      Drive & File Storage Quota
                    </label>
                    <span className="font-bold font-mono text-blue-600 dark:text-blue-400 text-sm">
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
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Granular Module Switches */}
              <div className="space-y-2.5 pt-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Module Feature Switches
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {[
                    { key: "payrollEnabled", label: "Payroll & Compensation" },
                    { key: "geofencingEnabled", label: "Geofencing & Mobile Punch" },
                    { key: "driveEnabled", label: "Drive Storage & Library" },
                    { key: "fileShareEnabled", label: "Direct File Share Links" },
                    { key: "taskCommitmentEnabled", label: "Task Commitments & Sprints" },
                  ].map((f) => (
                    <label
                      key={f.key}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border text-xs font-medium text-foreground cursor-pointer hover:bg-muted/60 transition-colors"
                    >
                      <span>{f.label}</span>
                      <input
                        type="checkbox"
                        checked={(formData as any)[f.key]}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, [f.key]: e.target.checked }))
                        }
                        className="size-4 rounded-xs accent-primary cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: INITIAL ADMINISTRATOR */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-border/80 pb-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <UserCheck className="size-4 text-primary" />
                  Step 3: Root Tenant Administrator Account
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Provision the primary administrator user with root organization authority.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Administrator Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.adminName}
                    onChange={(e) => setFormData((p) => ({ ...p, adminName: e.target.value }))}
                    placeholder="e.g. Ashish Doshi"
                    className="w-full h-9 bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md px-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Administrator Official Email *
                  </label>
                  <input
                    type="email"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData((p) => ({ ...p, adminEmail: e.target.value }))}
                    placeholder="e.g. admin@sigma.com"
                    className="w-full h-9 bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md px-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Initial Password *
                    </label>
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <RefreshCw className="size-3" /> Generate Random
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.adminPassword}
                      onChange={(e) => setFormData((p) => ({ ...p, adminPassword: e.target.value }))}
                      className="w-full h-9 bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md pl-3 pr-8 text-xs font-mono text-amber-600 dark:text-amber-400 outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Copy Password"
                    >
                      {copiedPassword ? (
                        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Designation / Title
                  </label>
                  <input
                    type="text"
                    value={formData.adminDesignation}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, adminDesignation: e.target.value }))
                    }
                    placeholder="Managing Director / CEO"
                    className="w-full h-9 bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md px-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: WORKPLACE TIMINGS & LOCATION */}
          {step === 4 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-border/80 pb-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <MapPin className="size-4 text-primary" />
                  Step 4: Workplace Policies & Headquarters Geofence
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Establish working hours, punch grace allowance, and primary branch geofence.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1">
                    <Clock className="size-3 text-primary" /> Office Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.officeStartTime}
                    onChange={(e) => setFormData((p) => ({ ...p, officeStartTime: e.target.value }))}
                    className="w-full h-9 bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md px-3 text-xs text-foreground outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1">
                    <Clock className="size-3 text-primary" /> Office End Time
                  </label>
                  <input
                    type="time"
                    value={formData.officeEndTime}
                    onChange={(e) => setFormData((p) => ({ ...p, officeEndTime: e.target.value }))}
                    className="w-full h-9 bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md px-3 text-xs text-foreground outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
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
                    className="w-full h-9 bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md px-3 text-xs font-mono text-foreground outline-none transition"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Primary Office / HQ Location Name
                  </label>
                  <input
                    type="text"
                    value={formData.locationName}
                    onChange={(e) => setFormData((p) => ({ ...p, locationName: e.target.value }))}
                    placeholder="Head Office - Kolhapur"
                    className="w-full h-9 bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md px-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
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
                    className="w-full h-9 bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md px-3 text-xs font-mono text-foreground outline-none transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & INSTANT PROVISIONING */}
          {step === 5 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-border/80 pb-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary" />
                  Step 5: Review & Instant Fleet Provisioning
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Confirm the parameters before launching the isolated tenant database partition.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Organization Summary */}
                <div className="p-3.5 rounded-md bg-muted/40 border border-border/80 space-y-1.5 text-xs">
                  <div className="font-bold text-primary uppercase text-[10px] pb-1 border-b border-border">
                    Organization Profile
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <strong className="text-foreground">{formData.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">URL Slug:</span>
                    <strong className="text-primary font-mono">/{formData.slug}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Legal Name:</span>
                    <span className="text-foreground">{formData.legalName || formData.name}</span>
                  </div>
                </div>

                {/* Plan Summary */}
                <div className="p-3.5 rounded-md bg-muted/40 border border-border/80 space-y-1.5 text-xs">
                  <div className="font-bold text-primary uppercase text-[10px] pb-1 border-b border-border">
                    Tier & Storage
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan Tier:</span>
                    <strong className="text-foreground">{formData.plan}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">User Limit:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{formData.maxUsers} Users</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Drive Quota:</span>
                    <strong className="text-blue-600 dark:text-blue-400 font-mono">{formData.driveQuotaGb} GB</strong>
                  </div>
                </div>

                {/* Administrator Summary */}
                <div className="p-3.5 rounded-md bg-muted/40 border border-border/80 space-y-1.5 text-xs">
                  <div className="font-bold text-primary uppercase text-[10px] pb-1 border-b border-border">
                    Root Administrator
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Admin Name:</span>
                    <strong className="text-foreground">{formData.adminName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Admin Email:</span>
                    <strong className="text-foreground">{formData.adminEmail}</strong>
                  </div>
                </div>

                {/* Workplace Summary */}
                <div className="p-3.5 rounded-md bg-muted/40 border border-border/80 space-y-1.5 text-xs">
                  <div className="font-bold text-primary uppercase text-[10px] pb-1 border-b border-border">
                    Workplace Timings
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hours:</span>
                    <strong className="text-foreground">
                      {formData.officeStartTime} - {formData.officeEndTime}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Grace Allowance:</span>
                    <span className="text-foreground">{formData.graceTimeMinutes} mins</span>
                  </div>
                </div>
              </div>

              {loading && (
                <div className="p-3.5 rounded-md bg-primary/10 border border-primary/30 text-center space-y-1.5 animate-pulse">
                  <Loader2 className="size-5 text-primary animate-spin mx-auto" />
                  <p className="text-xs font-mono text-primary font-medium">{provisioningStatus}</p>
                </div>
              )}
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1 || loading}
              className="px-3.5 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-input text-xs font-semibold flex items-center gap-1.5 disabled:opacity-30 cursor-pointer transition"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back</span>
            </button>

            {step < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer transition"
              >
                <span>Continue</span>
                <ArrowRight className="size-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExecuteOnboarding}
                disabled={loading}
                className="px-4 py-2 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer transition"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Provisioning Fleet...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4" />
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
