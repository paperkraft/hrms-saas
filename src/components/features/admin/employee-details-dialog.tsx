"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui";
import {
  Mail,
  Phone,
  Calendar as CalendarIcon,
  Briefcase,
  User as UserIcon,
  MapPin,
  Eye,
  CheckCircle2,
  Clock,
  UserMinus,
  Home,
  Calendar,
  Copy,
  Check,
  PhoneCall,
  Send,
  Building2,
  Heart,
  Shield,
  UserCheck,
  AlertTriangle,
  Globe,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { isExternalUser } from "@/lib/permissions";

interface EmployeeDetailsDialogProps {
  user: any;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showAttendanceTimeline?: boolean;
}

export function EmployeeDetailsDialog({
  user,
  trigger,
  open,
  onOpenChange,
  showAttendanceTimeline = false,
}: EmployeeDetailsDialogProps) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  if (!user) return null;

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user.email) return;
    navigator.clipboard.writeText(user.email);
    setCopiedEmail(true);
    toast.success("Email copied to clipboard");
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user.phoneNumber) return;
    navigator.clipboard.writeText(user.phoneNumber);
    setCopiedPhone(true);
    toast.success("Phone number copied to clipboard");
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const userDepts = user.departments || [];
  const primaryDept = userDepts.find((d: any) => d.isPrimary)?.department || user.department;
  const isLeaderAny = (user.ledDepartments && user.ledDepartments.length > 0) || userDepts.some((d: any) => d.isLeader);

  const sanitizeContact = (val?: string | null) => {
    if (!val) return null;
    const str = String(val).trim();
    if (!str || str.toLowerCase() === "null" || str.toLowerCase() === "undefined") return null;
    return str;
  };

  const emergencyName = sanitizeContact(user.emergencyContactName);
  const emergencyPhone = sanitizeContact(user.emergencyContactPhone);
  let emergencyRelation = sanitizeContact(user.emergencyContactRelation);
  if (emergencyRelation && emergencyRelation.includes("@")) {
    emergencyRelation = null;
  }

  const effectiveStatus = user.employmentStatus || user.status || "ACTIVE";

  const content = (
    <DialogContent className="w-[calc(100%-2rem)] sm:max-w-xl p-0 overflow-hidden rounded-md border border-border/80 shadow-2xl bg-card">
      <DialogHeader className="sr-only">
        <DialogTitle>Employee Profile - {user.name || user.email}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* ── Top Header Banner ── */}
        <div className="h-20 bg-linear-to-r from-primary/15 via-primary/8 to-background relative shrink-0 border-b border-border/40">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle at 80% 50%, hsl(var(--primary)) 0%, transparent 60%)",
            }}
          />
        </div>

        {/* ── User Overview & Avatar Bar ── */}
        <div className="px-6 pb-4 -mt-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-3.5">
              <Avatar className="size-18 rounded-full border-4 border-card shadow-md shrink-0 bg-primary">
                {user.avatarUrl && (
                  <AvatarImage src={user.avatarUrl} alt={user.name || ""} className="object-cover" />
                )}
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold flex items-center justify-center size-full">
                  {getInitials(user.name || "")}
                </AvatarFallback>
              </Avatar>

              <div className="mb-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-foreground tracking-tight leading-tight truncate">
                    {user.name || "Unknown User"}
                  </h2>
                  <StatusBadge status={effectiveStatus} />
                </div>
                <p className="text-xs font-semibold text-primary/80 mt-0.5 truncate">
                  {user.designation || "Designation Not Set"}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 mt-0.5 truncate">
                  <Mail className="size-3 text-muted-foreground/70" />
                  <span>{user.email}</span>
                </p>
              </div>
            </div>

            {/* Role & Work Mode Pills */}
            <div className="flex items-center gap-1.5 flex-wrap sm:self-end">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted/60 border border-border/70 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Shield className="size-3 text-muted-foreground" />
                {user.roleDefinition?.name || user.role || "EMPLOYEE"}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-[10px] font-bold uppercase tracking-wider text-primary">
                {user.workMode === "REMOTE" ? "Remote" : user.workMode === "HYBRID" ? "Hybrid" : "On-site"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Main Details Content ── */}
        <div className="p-6 pt-2 space-y-5">
          {/* Resigned / Terminated Status Banner */}
          {user.status === "RESIGNED" && (
            <div className="p-3.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5" /> Resigned Employee
                </span>
                {user.resignationDate && (
                  <span className="text-[11px] text-amber-600 font-medium">
                    Effective: {new Date(user.resignationDate).toLocaleDateString()}
                  </span>
                )}
              </div>
              {user.resignationReason && (
                <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80">
                  <span className="font-semibold">Reason:</span> {user.resignationReason}
                </p>
              )}
            </div>
          )}

          {user.status === "TERMINATED" && (
            <div className="p-3.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-xs">
              <span className="font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                <UserMinus className="size-3.5" /> Terminated Employee
              </span>
            </div>
          )}

          {/* ── Section 1: Employment & Organization ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Briefcase className="size-3.5 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Employment Details
              </span>
              <div className="flex-1 h-px bg-border/60" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Department Assignment */}
              <div className="p-3 rounded-md bg-muted/20 border border-border/60 space-y-1 sm:col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">
                  Department Assignment(s)
                </p>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {isExternalUser(user) ? (
                    <span className="text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                      <Globe className="size-3 text-blue-500" />
                      External Collaborator (No Department Assignment)
                    </span>
                  ) : primaryDept ? (
                    <span className="text-xs font-semibold bg-background border border-border/70 text-foreground px-2 py-0.5 rounded-md flex items-center gap-1.5">
                      <Building2 className="size-3 text-muted-foreground" />
                      {primaryDept.name || primaryDept}
                      <span className="text-[9px] text-amber-600 font-bold bg-amber-500/10 px-1 rounded">Primary</span>
                      {isLeaderAny && (
                        <span className="text-[9px] text-purple-600 font-bold bg-purple-500/10 px-1 rounded">TL</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">No primary department</span>
                  )}

                  {userDepts
                    .filter((d: any) => !d.isPrimary)
                    .map((d: any) => (
                      <span
                        key={d.department.id}
                        className="text-xs font-medium bg-muted/40 border border-border/60 text-foreground px-2 py-0.5 rounded-md flex items-center gap-1"
                      >
                        {d.department.name}
                        {d.isLeader && (
                          <span className="text-[9px] text-purple-600 font-bold bg-purple-500/10 px-1 rounded">TL</span>
                        )}
                      </span>
                    ))}
                </div>
              </div>

              {/* Reporting Manager */}
              <div className="p-3 rounded-md bg-muted/20 border border-border/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none mb-1">
                  Reporting Manager
                </p>
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <UserCheck className="size-3.5 text-muted-foreground" />
                  <span>{user.manager?.name || "Direct / Management"}</span>
                </p>
              </div>

              {/* Office Location */}
              <div className="p-3 rounded-md bg-muted/20 border border-border/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none mb-1">
                  Primary Location
                </p>
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 truncate">
                  <MapPin className="size-3.5 text-primary/80 shrink-0" />
                  <span className="truncate">{user.location?.name || "Default Office"}</span>
                </p>
              </div>

              {/* Joining Dates */}
              <div className="p-3 rounded-md bg-muted/20 border border-border/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none mb-1">
                  {user.rejoiningDate ? "Original Joining Date" : "Joining Date"}
                </p>
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <CalendarIcon className="size-3.5 text-muted-foreground" />
                  <span>
                    {user.joiningDate
                      ? new Date(user.joiningDate).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Not specified"}
                  </span>
                </p>
              </div>

              {/* Date of Birth */}
              <div className="p-3 rounded-md bg-muted/20 border border-border/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none mb-1">
                  Date of Birth
                </p>
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <span>
                    {user.dateOfBirth
                      ? new Date(user.dateOfBirth).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Not specified"}
                  </span>
                </p>
              </div>

              {/* Additional Punch Locations */}
              {user.additionalLocations && user.additionalLocations.length > 0 && (
                <div className="p-3 rounded-md bg-muted/20 border border-border/60 space-y-1.5 sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">
                    Additional Allowed Punch Locations
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {user.additionalLocations.map((loc: any) => (
                      <span
                        key={loc.id}
                        className="text-[11px] font-medium bg-primary/5 text-primary border border-primary/20 px-2 py-0.5 rounded-md flex items-center gap-1"
                      >
                        <MapPin className="size-2.5" />
                        {loc.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Section 2: Contact Information ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Phone className="size-3.5 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Contact Information
              </span>
              <div className="flex-1 h-px bg-border/60" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Email Address */}
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/20 border border-border/60 sm:col-span-2 group">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-7 rounded-md bg-muted/60 flex items-center justify-center shrink-0 border border-border/40 text-muted-foreground">
                    <Mail className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none mb-0.5">
                      Work Email
                    </p>
                    <p className="text-xs font-semibold text-foreground truncate">{user.email || "N/A"}</p>
                  </div>
                </div>

                {user.email && (
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-transparent hover:border-border/60"
                      title="Copy Email"
                    >
                      {copiedEmail ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    </button>
                    <a
                      href={`mailto:${user.email}`}
                      className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer border border-transparent hover:border-primary/20"
                      title="Send Email"
                    >
                      <Send className="size-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {/* Phone Number */}
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/20 border border-border/60 group">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-7 rounded-md bg-muted/60 flex items-center justify-center shrink-0 border border-border/40 text-muted-foreground">
                    <Phone className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none mb-0.5">
                      Phone Number
                    </p>
                    <p className="text-xs font-semibold text-foreground truncate">{user.phoneNumber || "Not Set"}</p>
                  </div>
                </div>

                {user.phoneNumber && (
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={handleCopyPhone}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-transparent hover:border-border/60"
                      title="Copy Phone"
                    >
                      {copiedPhone ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    </button>
                    <a
                      href={`tel:${user.phoneNumber}`}
                      className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer border border-transparent hover:border-primary/20"
                      title="Call Phone"
                    >
                      <PhoneCall className="size-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {/* Blood Group */}
              <div className="flex items-center gap-2.5 p-3 rounded-md bg-muted/20 border border-border/60">
                <div className="size-7 rounded-md bg-muted/60 flex items-center justify-center shrink-0 border border-border/40 text-rose-500 font-bold text-xs">
                  {user.bloodGroup || "🩸"}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none mb-0.5">
                    Blood Group
                  </p>
                  <p className="text-xs font-semibold text-foreground">{user.bloodGroup || "Not specified"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 3: Emergency Contact ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Heart className="size-3.5 text-rose-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Emergency Contacts
              </span>
              <div className="flex-1 h-px bg-border/60" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Emergency Contact Name */}
              <div className="flex items-center justify-between p-3 rounded-md bg-rose-500/5 border border-rose-500/15">
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-md bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20 text-rose-600">
                    <UserIcon className="size-3.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600/70 leading-none mb-0.5">
                      Contact Person
                    </p>
                    <p className="text-xs font-semibold text-foreground">
                      {emergencyName || "Not Provided"}
                    </p>
                  </div>
                </div>
                {emergencyRelation && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 px-2 py-0.5 rounded-md border border-rose-500/20">
                    {emergencyRelation}
                  </span>
                )}
              </div>

              {/* Emergency Contact Phone */}
              <div className="flex items-center justify-between p-3 rounded-md bg-rose-500/5 border border-rose-500/15 group">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-7 rounded-md bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20 text-rose-600">
                    <Phone className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600/70 leading-none mb-0.5">
                      Emergency Phone
                    </p>
                    <p className="text-xs font-semibold text-foreground truncate">
                      {emergencyPhone || "Not Provided"}
                    </p>
                  </div>
                </div>

                {emergencyPhone && (
                  <a
                    href={`tel:${emergencyPhone}`}
                    className="p-1.5 rounded-md hover:bg-rose-500/15 text-rose-600 transition-colors cursor-pointer border border-transparent hover:border-rose-500/20 shrink-0 ml-2"
                    title="Call Emergency Contact"
                  >
                    <PhoneCall className="size-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* ── Today's Attendance Timeline (Optional) ── */}
          {showAttendanceTimeline && (
            <div className="pt-2 border-t border-border/60 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="size-3.5 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Today's Attendance & Work Status
                </span>
                <div className="flex-1 h-px bg-border/60" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-md bg-muted/20 border border-border/60 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Punch Timeline
                  </p>
                  <div className="relative pl-4 border-l-2 border-primary/30 space-y-3">
                    <div>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase">Punch In</p>
                      <p className="text-xs font-bold text-foreground">{user.punchIn || "--:--"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Punch Out</p>
                      <p className="text-xs font-bold text-foreground">{user.punchOut || "--:--"}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-md bg-muted/20 border border-border/60 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Effective Work Time
                    </p>
                    <p className="text-2xl font-bold font-mono text-foreground">{user.totalHours || "0.0"} hrs</p>
                  </div>

                  <div className="pt-2">
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                      {user.isOutsideOffice ? "Remote Punch" : "Office Punch"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DialogContent>
  );

  if (open !== undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {content}
      </Dialog>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <button
            type="button"
            className="p-1.5 hover:bg-primary/10 rounded-md transition-colors text-muted-foreground hover:text-primary border border-transparent hover:border-primary/20 cursor-pointer"
            title="View User Details"
          >
            <Eye className="size-3.5" />
          </button>
        )}
      </DialogTrigger>
      {content}
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = String(status || "ACTIVE").toUpperCase().trim();
  switch (s) {
    case "ACTIVE":
    case "PRESENT":
    case "LATE":
    case "ABSENT":
    case "LEAVE":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          <CheckCircle2 className="size-3" /> Active
        </span>
      );
    case "RESIGNED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
          <Clock className="size-3" /> Resigned
        </span>
      );
    case "TERMINATED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
          <UserMinus className="size-3" /> Terminated
        </span>
      );
    case "INACTIVE":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-500/10 text-slate-600 border border-slate-500/20">
          Inactive
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          <CheckCircle2 className="size-3" /> Active
        </span>
      );
  }
}
