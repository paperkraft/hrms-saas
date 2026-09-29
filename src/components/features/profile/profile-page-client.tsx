"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import Cropper, { Area } from "react-easy-crop";
import { updateSelfProfile } from "@/actions/user";
import { format } from "date-fns";
import {
  User,
  Mail,
  Phone,
  Droplets,
  Calendar,
  Briefcase,
  Heart,
  Lock,
  Loader2,
  Camera,
  Eye,
  MapPin,
  Building2,
  ShieldCheck,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const profileSchema = z.object({
  phoneNumber: z.string().optional().or(z.literal("")),
  bloodGroup: z.string().optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  emergencyContactName: z.string().optional().or(z.literal("")),
  emergencyContactPhone: z.string().optional().or(z.literal("")),
  emergencyContactRelation: z.string().optional().or(z.literal("")),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .optional()
    .or(z.literal("")),
});

interface ProfileUser {
  id: string;
  name: string | null;
  email: string;
  designation: string | null;
  dateOfBirth: string | null;
  joiningDate: string | null;
  phoneNumber: string | null;
  bloodGroup: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  workMode?: string | null;
  location?: { id: string; name: string } | null;
  additionalLocations?: { id: string; name: string }[] | null;
  departments?: {
    isPrimary: boolean;
    isLeader: boolean;
    department: { id: string; name: string };
  }[] | null;
}

interface ProfilePageClientProps {
  user: ProfileUser;
  completionPct: number;
}

// ─── Read-only field ──────────────────────────────────────────────────────────
function ReadField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null | undefined;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-md bg-muted/20 border border-border/60 group">
      <div className="size-7 rounded-md bg-muted/60 flex items-center justify-center shrink-0 mt-0.5 border border-border/40 text-muted-foreground">
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none mb-1">
          {label}
        </p>
        <p className="text-xs font-semibold text-foreground truncate">
          {value || <span className="text-muted-foreground/40 font-normal italic">Not specified</span>}
        </p>
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({
  label,
  accent = "primary",
}: {
  label: string;
  accent?: "primary" | "rose" | "amber";
}) {
  const colors = {
    primary: "text-primary",
    rose: "text-rose-500",
    amber: "text-amber-600",
  };
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className={cn("text-xs font-bold uppercase tracking-wider shrink-0", colors[accent])}>
        {label}
      </span>
      <Separator className="flex-1 h-px bg-border/60" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ProfilePageClient({ user, completionPct }: ProfilePageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"personal" | "emergency" | "security">("personal");
  const [avatar, setAvatar] = useState<string | null>((user as any).avatarUrl || null);
  const [uploading, setUploading] = useState(false);

  // Append timestamp on client-side only to bust cache and avoid Hydration Mismatch
  useEffect(() => {
    if ((user as any).avatarUrl) {
      setAvatar(`${(user as any).avatarUrl}?t=${Date.now()}`);
    }
  }, [(user as any).avatarUrl]);

  // Cropper State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Viewer State
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const closeCropper = () => {
    if (selectedImage && selectedImage.startsWith("blob:")) {
      URL.revokeObjectURL(selectedImage);
    }
    setSelectedImage(null);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setSelectedImage(objectUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    e.target.value = "";
  };

  const handleCropConfirm = async () => {
    if (!selectedImage || !croppedAreaPixels) return;

    setUploading(true);
    const currentSelectedImage = selectedImage;
    setSelectedImage(null);

    try {
      const img = new window.Image();
      const imageLoadPromise = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(e);
      });
      img.src = currentSelectedImage;
      await imageLoadPromise;

      if (currentSelectedImage.startsWith("blob:")) {
        URL.revokeObjectURL(currentSelectedImage);
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Canvas 2D context not available");
      }

      const maxDim = 800;
      canvas.width = maxDim;
      canvas.height = maxDim;

      ctx.drawImage(
        img,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        maxDim,
        maxDim
      );

      const useWebP = canvas.toDataURL("image/webp").startsWith("data:image/webp");
      const imageType = useWebP ? "image/webp" : "image/jpeg";
      const quality = useWebP ? 0.80 : 0.85;

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, imageType, quality);
      });

      if (!blob) {
        throw new Error("Failed to crop image");
      }

      const formData = new FormData();
      const filename = `avatar.${useWebP ? "webp" : "jpg"}`;
      formData.append("file", blob, filename);

      const response = await fetch("/api/upload-avatar", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Upload failed");
      }

      const { url } = await response.json();
      setAvatar(`${url}?t=${Date.now()}`);
      toast.success("Profile photo updated");

      // Notify other components to instantly reload the image
      window.dispatchEvent(new Event("avatar-updated"));
    } catch (error: any) {
      if (currentSelectedImage.startsWith("blob:")) {
        URL.revokeObjectURL(currentSelectedImage);
      }
      toast.error(error.message || "Failed to crop and upload image");
    } finally {
      setUploading(false);
    }
  };

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      phoneNumber: user.phoneNumber || "",
      bloodGroup: user.bloodGroup || "",
      dateOfBirth: user.dateOfBirth
        ? format(new Date(user.dateOfBirth), "yyyy-MM-dd")
        : "",
      emergencyContactName: user.emergencyContactName || "",
      emergencyContactPhone: user.emergencyContactPhone || "",
      emergencyContactRelation: user.emergencyContactRelation || "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof profileSchema>) {
    startTransition(async () => {
      try {
        const result = await updateSelfProfile({
          phoneNumber: values.phoneNumber,
          bloodGroup: values.bloodGroup,
          dateOfBirth: values.dateOfBirth ? new Date(values.dateOfBirth) : undefined,
          emergencyContactName: values.emergencyContactName,
          emergencyContactPhone: values.emergencyContactPhone,
          emergencyContactRelation: values.emergencyContactRelation,
          password: values.password || undefined,
        });

        if (result.success) {
          toast.success("Profile updated successfully");
          form.setValue("password", "");
          router.refresh();
        } else {
          toast.error(result.error || "Failed to update profile");
        }
      } catch {
        toast.error("An unexpected error occurred");
      }
    });
  }

  const tabs = [
    { id: "personal" as const, label: "Personal Details", icon: User },
    { id: "emergency" as const, label: "Emergency Contacts", icon: Heart },
    { id: "security" as const, label: "Security & Password", icon: Lock },
  ];

  const initials = (user.name || user.email)
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* ── Unified Profile Hero Card ── */}
        <div className="bg-card border border-border/80 rounded-md p-5 lg:p-6 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4.5">
              {/* Avatar Container */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => (avatar ? setViewingImage(avatar) : null)}
                  className={cn(
                    "relative group size-18 rounded-full border-2 border-primary/20 shadow-sm overflow-hidden bg-primary block",
                    avatar ? "cursor-pointer" : "cursor-default"
                  )}
                >
                  {uploading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 text-foreground">
                      <Loader2 className="size-5 animate-spin text-primary" />
                    </div>
                  ) : (
                    <>
                      {avatar ? (
                        <>
                          <img
                            src={avatar}
                            alt={user.name || "User Avatar"}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <Eye className="size-4 text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-primary-foreground font-bold text-xl">
                          {initials}
                        </div>
                      )}
                    </>
                  )}
                </button>

                {/* Upload Button Badge */}
                <label
                  className="absolute -bottom-0.5 -right-0.5 size-6 rounded-full bg-background border border-border/80 flex items-center justify-center cursor-pointer hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shadow-xs"
                  title="Update profile picture"
                >
                  <Camera className="size-3" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* User Info Details */}
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold text-foreground tracking-tight leading-tight">
                    {user.name || "Employee"}
                  </h1>
                  {user.designation && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      {user.designation}
                    </span>
                  )}
                  <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 border border-border/60 px-2 py-0.5 rounded-md">
                    {user.workMode === "REMOTE" ? "Remote" : user.workMode === "HYBRID" ? "Hybrid" : "On-site"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground font-medium flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-3.5 text-muted-foreground/70" />
                    <span>{user.email}</span>
                  </span>
                  {user.location?.name && (
                    <>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5 text-muted-foreground/70" />
                        <span>{user.location.name}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Completion Progress Bar */}
            <div className="shrink-0 flex flex-col items-start md:items-end gap-2 bg-muted/30 border border-border/60 px-4 py-3 rounded-md min-w-[210px]">
              <div className="flex items-center justify-between gap-3 w-full">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Profile Completion
                </span>
                <span
                  className={cn(
                    "text-xs font-bold font-mono",
                    completionPct === 100
                      ? "text-emerald-600 dark:text-emerald-400"
                      : completionPct >= 50
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {completionPct}%
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    completionPct === 100
                      ? "bg-emerald-500"
                      : completionPct >= 50
                        ? "bg-amber-500"
                        : "bg-rose-500"
                  )}
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Workspace Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* Left Column: Official Info (Read-Only) & Checklist */}
          <div className="lg:col-span-1 space-y-6">
            {/* Official Records Card */}
            <div className="bg-card border border-border/80 rounded-md p-5 shadow-2xs">
              <SectionHeader label="Official Records" />
              <div className="space-y-2.5">
                <ReadField label="Full Name" value={user.name} icon={User} />
                <ReadField label="Designation" value={user.designation} icon={Briefcase} />
                <ReadField label="Work Email" value={user.email} icon={Mail} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <ReadField
                    label="Phone"
                    value={user.phoneNumber}
                    icon={Phone}
                  />
                  <ReadField
                    label="Joining Date"
                    value={user.joiningDate ? format(new Date(user.joiningDate), "dd MMM yyyy") : null}
                    icon={Calendar}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <ReadField
                    label="Primary Location"
                    value={user.location?.name || "Main Office"}
                    icon={MapPin}
                  />
                  <ReadField
                    label="Work Mode"
                    value={
                      user.workMode === "REMOTE"
                        ? "Remote"
                        : user.workMode === "HYBRID"
                          ? "Hybrid"
                          : "On-site (Office)"
                    }
                    icon={Briefcase}
                  />
                </div>

                {user.additionalLocations && user.additionalLocations.length > 0 && (
                  <div className="p-3 rounded-md bg-muted/20 border border-border/60 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-primary/80" />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">
                        Additional Punch Locations
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {user.additionalLocations.map((loc) => (
                        <span
                          key={loc.id}
                          className="text-[11px] font-medium bg-primary/5 text-primary border border-primary/20 px-2 py-0.5 rounded-md"
                        >
                          {loc.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {user.departments && user.departments.length > 0 && (
                  <div className="p-3 rounded-md bg-muted/20 border border-border/60 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-muted-foreground/80" />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">
                        Department Assignment(s)
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {user.departments.map((d) => (
                        <span
                          key={d.department.id}
                          className="text-[11px] font-medium bg-background border border-border/70 text-foreground px-2 py-0.5 rounded-md flex items-center gap-1.5"
                        >
                          {d.department.name}
                          {d.isPrimary && (
                            <span className="text-[9px] text-amber-600 font-bold bg-amber-500/10 px-1 rounded">Primary</span>
                          )}
                          {d.isLeader && (
                            <span className="text-[9px] text-purple-600 font-bold bg-purple-500/10 px-1 rounded">TL</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3.5 p-2.5 rounded-md bg-muted/30 border border-border/40 text-[10px] text-muted-foreground font-medium leading-relaxed">
                ℹ️ Official profile records are maintained by Human Resources. Please contact administration for corrections.
              </div>
            </div>
          </div>

          {/* Right Column: Editable Settings (Tabs) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs">
              {/* Tab Navigation Bar */}
              <div className="border-b border-border/70 bg-muted/30 p-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all shrink-0 cursor-pointer border",
                      activeTab === id
                        ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                        : "bg-background text-muted-foreground hover:text-foreground border-border/70 hover:bg-muted/40"
                    )}
                  >
                    <Icon className="size-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Tab Form Content */}
              <div className="p-6">
                {/* ── 1. Personal Details Tab ── */}
                {activeTab === "personal" && (
                  <div className="space-y-5 animate-fade-in">
                    <SectionHeader label="Personal Details" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem className="space-y-1.5">
                            <FormLabel className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <Phone className="size-3.5 text-muted-foreground" /> Phone Number
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                maxLength={10}
                                placeholder="e.g. 98XXXXXXXX"
                                className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20"
                              />
                            </FormControl>
                            <FormMessage className="text-xs font-medium" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                          <FormItem className="space-y-1.5">
                            <FormLabel className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <Calendar className="size-3.5 text-muted-foreground" /> Date of Birth
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20"
                              />
                            </FormControl>
                            <FormMessage className="text-xs font-medium" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="bloodGroup"
                        render={({ field }) => (
                          <FormItem className="space-y-1.5">
                            <FormLabel className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <Droplets className="size-3.5 text-muted-foreground" /> Blood Group
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="e.g. O+, A+, B+, AB-"
                                className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20"
                              />
                            </FormControl>
                            <FormMessage className="text-xs font-medium" />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="mt-6 pt-4 border-t border-border/60 flex justify-end">
                      <Button
                        type="submit"
                        disabled={isPending}
                        className="h-9 px-5 text-xs font-semibold rounded-md shadow-xs gap-1.5 cursor-pointer"
                      >
                        {isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Save className="size-3.5" />
                        )}
                        <span>Save Personal Details</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── 2. Emergency Contacts Tab ── */}
                {activeTab === "emergency" && (
                  <div className="space-y-5 animate-fade-in">
                    <SectionHeader label="Emergency Contacts" accent="amber" />

                    <div className="p-3.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-medium leading-relaxed">
                      💡 Emergency contacts are used by HR in medical or urgent situations. Please ensure this information is accurate and kept up to date.
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="emergencyContactName"
                        render={({ field }) => (
                          <FormItem className="space-y-1.5">
                            <FormLabel className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <User className="size-3.5 text-muted-foreground" /> Contact Name
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="e.g. Jane Doe"
                                className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20"
                              />
                            </FormControl>
                            <FormMessage className="text-xs font-medium" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="emergencyContactPhone"
                        render={({ field }) => (
                          <FormItem className="space-y-1.5">
                            <FormLabel className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <Phone className="size-3.5 text-muted-foreground" /> Contact Phone
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                maxLength={10}
                                placeholder="e.g. 98XXXXXXXX"
                                className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20"
                              />
                            </FormControl>
                            <FormMessage className="text-xs font-medium" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="emergencyContactRelation"
                        render={({ field }) => (
                          <FormItem className="space-y-1.5 sm:col-span-2">
                            <FormLabel className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <Heart className="size-3.5 text-muted-foreground" /> Relationship
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="e.g. Spouse, Parent, Sibling, Guardian"
                                className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20 max-w-sm"
                              />
                            </FormControl>
                            <FormMessage className="text-xs font-medium" />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="mt-6 pt-4 border-t border-border/60 flex justify-end">
                      <Button
                        type="submit"
                        disabled={isPending}
                        className="h-9 px-5 text-xs font-semibold rounded-md shadow-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5 cursor-pointer"
                      >
                        {isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Save className="size-3.5" />
                        )}
                        <span>Save Emergency Contacts</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── 3. Security & Password Tab ── */}
                {activeTab === "security" && (
                  <div className="space-y-5 animate-fade-in">
                    <SectionHeader label="Security Credentials" accent="rose" />

                    <div className="p-3.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-medium leading-relaxed">
                      🔒 Leave the new password field blank if you do not wish to change your current account password.
                    </div>

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5 max-w-sm">
                          <FormLabel className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Lock className="size-3.5 text-muted-foreground" /> New Password
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              {...field}
                              placeholder="Minimum 6 characters"
                              className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20"
                            />
                          </FormControl>
                          <FormMessage className="text-xs font-medium" />
                        </FormItem>
                      )}
                    />

                    <div className="mt-6 pt-4 border-t border-border/60 flex justify-end">
                      <Button
                        type="submit"
                        disabled={isPending}
                        className="h-9 px-5 text-xs font-semibold rounded-md shadow-xs bg-rose-600 hover:bg-rose-700 text-white gap-1.5 cursor-pointer"
                      >
                        {isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="size-3.5" />
                        )}
                        <span>Update Password</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Image Cropper Modal */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && closeCropper()}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md rounded-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">Adjust Profile Picture</DialogTitle>
          </DialogHeader>

          <div className="relative w-full h-[300px] bg-muted/20 rounded-md overflow-hidden border border-border/60">
            {selectedImage && (
              <Cropper
                image={selectedImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={(_, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
                onZoomChange={setZoom}
              />
            )}
          </div>

          <div className="py-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium px-1">
              <span>Zoom</span>
              <span>{Math.round(zoom * 100)}%</span>
            </div>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t border-border/40 pt-4 mt-2">
            <Button
              variant="outline"
              onClick={closeCropper}
              className="h-8 text-xs font-semibold rounded-md"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCropConfirm}
              className="h-8 text-xs font-semibold rounded-md"
            >
              Apply Crop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Viewer Modal */}
      <Dialog open={!!viewingImage} onOpenChange={(open) => !open && setViewingImage(null)}>
        <DialogContent
          aria-describedby={undefined}
          className="sm:max-w-lg bg-transparent border-none shadow-none p-0 flex flex-col items-center justify-center"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>View Profile Picture</DialogTitle>
          </DialogHeader>
          {viewingImage && (
            <img
              src={viewingImage}
              alt="Profile view"
              className="max-w-full max-h-[85vh] rounded-md object-contain border-4 border-card shadow-2xl"
            />
          )}
        </DialogContent>
      </Dialog>
    </Form>
  );
}
