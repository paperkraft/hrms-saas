"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { isAdminRole } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Clock, Timer, CheckCircle2, AlertCircle, Save, Loader2,
    ShieldAlert, CalendarRange, ListOrdered, Globe, Sparkles,
    Megaphone, HardDrive, Bell, KeyRound, Lock, ShieldCheck,
    RefreshCw, Key, Shield, AlertTriangle
} from "lucide-react"
import { updateSystemConfig } from "@/actions/settings"
import { updatePayrollPin, adminResetPayrollPin, getPayrollPinStatus } from "@/actions/payroll/security"
import { triggerManualNotificationCleanup } from "@/actions/notification"
import { LocationManagement } from "./location-management"
import { HolidayManagement } from "./holiday-management"
import { AnnouncementManagement } from "./announcement-management"
import { AnnouncementPriority } from "@prisma/client"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface SettingsFormProps {
    initialData: {
        defaultOfficeStartTime: string;
        defaultOfficeEndTime: string;
        defaultGraceTimeMinutes: number;
        lateMarkEnabled: boolean;
        lateMarkAllowedCount: number;
        specialCaseEnabled: boolean;
        specialCaseExtraMinutes: number;
        specialCaseMaxLateMinutes: number;
        autoPunchOutEnabled: boolean;
        autoPunchOutDelayHours: number;
        autoPunchOutWarningThreshold: number;
        semiAnnualPolicyEnabled: boolean;
        semiAnnualCycleStartMonth: number;
        firstHalfEndTime: string;
        secondHalfStartTime: string;
        earlyLogoffAllowedCount: number;
        earlyLogoffEnabled: boolean;
        maxOvertimeHoursPerDay: number;
        defaultPersonalDriveQuotaBytes?: number;
        maxDriveFileUploadSizeBytes?: number;
    },
    initialLocations: any[];
    initialHolidays: { id: string; name: string; date: Date }[];
    initialDepartments: { id: string; name: string }[];
    initialAnnouncements: {
        id: string;
        title: string;
        content: string;
        priority: AnnouncementPriority;
        createdAt: Date;
        isActive: boolean;
        author: { name: string | null; email: string };
        targetDepartment?: { name: string } | null;
    }[];
}

function SectionCard({ title, description, icon: Icon, iconColor = "text-primary", iconBg = "bg-primary/10", children }: {
    title: string;
    description: string;
    icon: React.ElementType;
    iconColor?: string;
    iconBg?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs flex flex-col justify-between">
            <div>
                <div className="p-4 border-b border-border/70 flex items-center gap-3 bg-card">
                    <div className={cn("size-8 rounded-md flex items-center justify-center border border-border/60 shrink-0", iconBg, iconColor)}>
                        <Icon className="size-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">{title}</h3>
                        <p className="text-xs text-muted-foreground font-medium">{description}</p>
                    </div>
                </div>
                <div className="p-4 space-y-4">
                    {children}
                </div>
            </div>
        </div>
    )
}

function FieldRow({ label, children, disabled }: { label: string; children: React.ReactNode; disabled?: boolean }) {
    return (
        <div className={cn("space-y-1.5", disabled && "opacity-40 pointer-events-none")}>
            <Label className="text-xs font-semibold text-foreground">{label}</Label>
            {children}
        </div>
    )
}

function ToggleRow({ label, description, checked, onCheckedChange, disabled, color = "bg-primary" }: {
    label: string;
    description: string;
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
    disabled?: boolean;
    color?: string;
}) {
    return (
        <div className={cn("flex items-center justify-between py-3 px-3.5 rounded-md border border-border/70 bg-muted/20", disabled && "opacity-40")}>
            <div className="space-y-0.5 pr-3">
                <p className="text-xs font-bold text-foreground">{label}</p>
                <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">{description}</p>
            </div>
            <Switch
                checked={checked}
                onCheckedChange={onCheckedChange}
                disabled={disabled}
                className={cn("cursor-pointer shrink-0", `data-[state=checked]:${color}`)}
            />
        </div>
    )
}

export function SettingsForm({ initialData, initialLocations, initialHolidays, initialDepartments, initialAnnouncements }: SettingsFormProps) {
    const [loading, setLoading] = useState(false)
    const [isPurging, setIsPurging] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [formData, setFormData] = useState(initialData)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(false)
        const result = await updateSystemConfig(formData)
        if (result?.error) {
            setError(result.error)
            toast.error(result.error)
        } else {
            setSuccess(true)
            toast.success("System configuration saved successfully!")
            setTimeout(() => setSuccess(false), 3000)
        }
        setLoading(false)
    }

    const handlePurgeNotifications = async () => {
        setIsPurging(true)
        const result = await triggerManualNotificationCleanup()
        setIsPurging(false)
        if (result.success && result.stats) {
            toast.success(
                `Purged ${result.stats.total} stale notification${result.stats.total === 1 ? "" : "s"} (${result.stats.celebrations} celebrations, ${result.stats.announcements} announcements, ${result.stats.reminders} reminders, ${result.stats.leaves || 0} leaves, ${result.stats.activity || 0} tasks/overtime/allowances)`
            )
        } else {
            toast.error(result.error || "Failed to purge notifications")
        }
    }

    const inputClass = "h-9 bg-background border-border/80 focus:ring-primary/20 rounded-md text-xs font-medium"

    return (
        <div className="space-y-4 animate-fade-in">
            <Tabs defaultValue="general" className="w-full space-y-4">
                {/* ── Tabs Navigation Bar ── */}
                <div className="w-full overflow-x-auto scrollbar-hide">
                    <TabsList className="bg-muted/40 p-1 rounded-md border border-border/70 h-10 sm:h-9 w-full sm:w-auto flex items-center justify-start gap-1">
                        <TabsTrigger
                            value="general"
                            className="h-8 px-3 sm:px-4 text-xs font-bold rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-border/60 transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-initial shrink-0"
                        >
                            <Clock className="size-3.5 text-primary" />
                            <span>Global Defaults</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="locations"
                            className="h-8 px-3 sm:px-4 text-xs font-bold rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-border/60 transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-initial shrink-0"
                        >
                            <Globe className="size-3.5 text-sky-600" />
                            <span>Locations</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="attendance"
                            className="h-8 px-3 sm:px-4 text-xs font-bold rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-border/60 transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-initial shrink-0"
                        >
                            <ShieldAlert className="size-3.5 text-amber-600" />
                            <span>Attendance Policies</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="leave"
                            className="h-8 px-3 sm:px-4 text-xs font-bold rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-border/60 transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-initial shrink-0"
                        >
                            <CalendarRange className="size-3.5 text-purple-600" />
                            <span>Leave Frameworks</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="holidays"
                            className="h-8 px-3 sm:px-4 text-xs font-bold rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-border/60 transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-initial shrink-0"
                        >
                            <Sparkles className="size-3.5 text-emerald-600" />
                            <span>Public Holidays</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="announcements"
                            className="h-8 px-3 sm:px-4 text-xs font-bold rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-border/60 transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-initial shrink-0"
                        >
                            <Megaphone className="size-3.5 text-rose-600" />
                            <span>Announcements</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* ─── GENERAL CONFIGURATION ─── */}
                <TabsContent value="general" className="outline-none m-0">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <SectionCard title="Daily Working Hours" description="Core office operating window" icon={Clock}>
                                <div className="grid grid-cols-2 gap-3">
                                    <FieldRow label="Office Opens">
                                        <Input
                                            type="time"
                                            value={formData.defaultOfficeStartTime}
                                            onChange={(e) => setFormData(prev => ({ ...prev, defaultOfficeStartTime: e.target.value }))}
                                            className={inputClass}
                                            required
                                        />
                                    </FieldRow>
                                    <FieldRow label="Office Closes">
                                        <Input
                                            type="time"
                                            value={formData.defaultOfficeEndTime}
                                            onChange={(e) => setFormData(prev => ({ ...prev, defaultOfficeEndTime: e.target.value }))}
                                            className={inputClass}
                                            required
                                        />
                                    </FieldRow>
                                </div>
                            </SectionCard>

                            <SectionCard title="Arrival Tolerance" description="System grace buffer before marking late" icon={Timer} iconColor="text-amber-600" iconBg="bg-amber-500/10">
                                <FieldRow label="Grace Window (Minutes)">
                                    <Input
                                        type="number"
                                        min="0"
                                        value={formData.defaultGraceTimeMinutes}
                                        onChange={(e) => setFormData(prev => ({ ...prev, defaultGraceTimeMinutes: parseInt(e.target.value) || 0 }))}
                                        className={inputClass}
                                        required
                                    />
                                </FieldRow>
                            </SectionCard>

                            <SectionCard title="Drive Storage Limits" description="Personal storage quota & max file size" icon={HardDrive} iconColor="text-emerald-600" iconBg="bg-emerald-500/10">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <FieldRow label="Personal Drive Quota (GB)">
                                        <Input
                                            type="number"
                                            step="1"
                                            min="1"
                                            value={formData.defaultPersonalDriveQuotaBytes ? Math.round(formData.defaultPersonalDriveQuotaBytes / (1024 * 1024 * 1024)) : 2}
                                            onChange={(e) => {
                                                const gb = parseInt(e.target.value) || 0;
                                                setFormData(prev => ({ ...prev, defaultPersonalDriveQuotaBytes: gb * 1024 * 1024 * 1024 }));
                                            }}
                                            className={inputClass}
                                            required
                                        />
                                    </FieldRow>
                                    <FieldRow label="Max File Upload (MB)">
                                        <Input
                                            type="number"
                                            min="1"
                                            value={formData.maxDriveFileUploadSizeBytes ? Math.round(formData.maxDriveFileUploadSizeBytes / (1024 * 1024)) : 100}
                                            onChange={(e) => {
                                                const mb = parseInt(e.target.value) || 0;
                                                setFormData(prev => ({ ...prev, maxDriveFileUploadSizeBytes: mb * 1024 * 1024 }));
                                            }}
                                            className={inputClass}
                                            required
                                        />
                                    </FieldRow>
                                </div>
                            </SectionCard>

                        </div>

                        <SaveBar loading={loading} success={success} error={error} label="Save Defaults" />
                    </form>

                    {/* Security & System Operations */}
                    <div className="pt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <SectionCard title="Salary & Payroll PIN" description="Protect confidential compensation records" icon={KeyRound} iconColor="text-amber-600" iconBg="bg-amber-500/10">
                                <PayrollPinSection />
                            </SectionCard>

                            <SectionCard title="Notification Purge" description="Manual trigger for stale broadcast cleanup" icon={Bell} iconColor="text-amber-600" iconBg="bg-amber-500/10">
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Purge Birthday/Anniversary & Leave alerts older than 7 days, expired Announcements, yesterday's Check-in/out reminders, and task reviews/comments/file-shares/overtime/allowances older than 30 days.
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isPurging}
                                    onClick={handlePurgeNotifications}
                                    className="w-full h-9 text-xs font-semibold gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 rounded-md cursor-pointer transition-colors"
                                >
                                    {isPurging ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="size-4 text-amber-500" />
                                    )}
                                    <span>{isPurging ? "Purging System Alerts..." : "Purge Stale Notifications Now"}</span>
                                </Button>
                            </SectionCard>
                        </div>
                    </div>
                </TabsContent>

                {/* ─── LOCATIONS ─── */}
                <TabsContent value="locations" className="outline-none m-0">
                    <LocationManagement initialLocations={initialLocations} />
                </TabsContent>

                {/* ─── ATTENDANCE POLICIES ─── */}
                <TabsContent value="attendance" className="outline-none m-0">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Card 1: Late Mark Toggle + Threshold */}
                            <SectionCard title="Late Mark Enforcement" description="Threshold-based arrival penalties" icon={ShieldAlert} iconColor="text-amber-600" iconBg="bg-amber-500/10">
                                <ToggleRow
                                    label="Enable Late Marking"
                                    description="Monitor and flag late arrivals system-wide."
                                    checked={formData.lateMarkEnabled}
                                    onCheckedChange={(v) => setFormData(prev => ({ ...prev, lateMarkEnabled: v }))}
                                />
                                <FieldRow label="Monthly Violation Limit" disabled={!formData.lateMarkEnabled}>
                                    <Input
                                        type="number"
                                        value={formData.lateMarkAllowedCount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, lateMarkAllowedCount: parseInt(e.target.value) || 0 }))}
                                        className={inputClass}
                                        disabled={!formData.lateMarkEnabled}
                                    />
                                </FieldRow>
                            </SectionCard>

                            {/* Card 2: Early Log-off Enforcement */}
                            <SectionCard title="Early Log-off Policy" description="Penalties for early departures" icon={Timer} iconColor="text-rose-600" iconBg="bg-rose-500/10">
                                <ToggleRow
                                    label="Enable Early Log-off Policy"
                                    description="Monitor and penalize early departures system-wide."
                                    checked={formData.earlyLogoffEnabled}
                                    onCheckedChange={(v) => setFormData(prev => ({ ...prev, earlyLogoffEnabled: v }))}
                                />
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    Every X early log-offs (before shift end) will count as a 0.5 day LWP deduction.
                                </p>
                                <FieldRow label="Early Log-offs Per 0.5 Day" disabled={!formData.earlyLogoffEnabled}>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={formData.earlyLogoffAllowedCount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, earlyLogoffAllowedCount: parseInt(e.target.value) || 0 }))}
                                        className={inputClass}
                                        disabled={!formData.earlyLogoffEnabled}
                                    />
                                </FieldRow>
                            </SectionCard>

                            {/* Card: Overtime Settings */}
                            <SectionCard title="Overtime Policy" description="Maximum allowed OT hours" icon={Clock} iconColor="text-primary" iconBg="bg-primary/10">
                                <FieldRow label="Max Overtime Hours Per Day">
                                    <Input
                                        type="number"
                                        min="0"
                                        max="24"
                                        value={formData.maxOvertimeHoursPerDay}
                                        onChange={(e) => setFormData(prev => ({ ...prev, maxOvertimeHoursPerDay: parseInt(e.target.value) || 0 }))}
                                        className={inputClass}
                                    />
                                </FieldRow>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    Set the maximum number of overtime hours an employee can request per day.
                                </p>
                            </SectionCard>

                            {/* Card 3: Intelligent Waiver */}
                            <SectionCard title="Intelligent Waiver" description="Waive late mark on full-hour completion" icon={Timer} iconColor="text-emerald-600" iconBg="bg-emerald-500/10">
                                <ToggleRow
                                    label="Enable Waiver Rule"
                                    description="Waive late mark if total work hours meet target."
                                    checked={formData.specialCaseEnabled}
                                    onCheckedChange={(v) => setFormData(prev => ({ ...prev, specialCaseEnabled: v }))}
                                    disabled={!formData.lateMarkEnabled}
                                />
                                <FieldRow label="Max Permitted Late Arrival (Mins)" disabled={!formData.lateMarkEnabled || !formData.specialCaseEnabled}>
                                    <Input
                                        type="number"
                                        value={formData.specialCaseMaxLateMinutes ?? ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, specialCaseMaxLateMinutes: parseInt(e.target.value) || 0 }))}
                                        className={inputClass}
                                        placeholder="e.g. 10"
                                        disabled={!formData.lateMarkEnabled || !formData.specialCaseEnabled}
                                    />
                                </FieldRow>
                                <FieldRow label="Required Extra Work Time (Mins)" disabled={!formData.lateMarkEnabled || !formData.specialCaseEnabled}>
                                    <Input
                                        type="number"
                                        value={formData.specialCaseExtraMinutes}
                                        onChange={(e) => setFormData(prev => ({ ...prev, specialCaseExtraMinutes: parseInt(e.target.value) || 0 }))}
                                        className={inputClass}
                                        placeholder="e.g. 0"
                                        disabled={!formData.lateMarkEnabled || !formData.specialCaseEnabled}
                                    />
                                </FieldRow>
                            </SectionCard>

                            {/* Card 4: Auto Check-Out */}
                            <SectionCard title="Auto Check-Out" description="Autonomous session lifecycle management" icon={ShieldAlert} iconColor="text-sky-600" iconBg="bg-sky-500/10">
                                <ToggleRow
                                    label="Enable Auto Check-Out"
                                    description="Terminate stale sessions at end of day."
                                    checked={formData.autoPunchOutEnabled}
                                    onCheckedChange={(v) => setFormData(prev => ({ ...prev, autoPunchOutEnabled: v }))}
                                />
                                <FieldRow label="Post-Shift Grace (hrs)" disabled={!formData.autoPunchOutEnabled}>
                                    <Input
                                        type="number"
                                        value={formData.autoPunchOutDelayHours}
                                        onChange={(e) => setFormData(prev => ({ ...prev, autoPunchOutDelayHours: parseInt(e.target.value) || 0 }))}
                                        className={inputClass}
                                        disabled={!formData.autoPunchOutEnabled}
                                    />
                                </FieldRow>
                                <FieldRow label="Warning Threshold" disabled={!formData.autoPunchOutEnabled}>
                                    <Input
                                        type="number"
                                        value={formData.autoPunchOutWarningThreshold}
                                        onChange={(e) => setFormData(prev => ({ ...prev, autoPunchOutWarningThreshold: parseInt(e.target.value) || 0 }))}
                                        className={inputClass}
                                        disabled={!formData.autoPunchOutEnabled}
                                    />
                                </FieldRow>
                            </SectionCard>

                        </div>

                        <SaveBar loading={loading} success={success} error={error} label="Save Attendance Policies" />
                    </form>
                </TabsContent>

                {/* ─── LEAVE FRAMEWORKS ─── */}
                <TabsContent value="leave" className="outline-none m-0">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Card 1: Semi-Annual Toggle */}
                            <SectionCard title="Semi-Annual Policy" description="H1/H2 leave cycle enforcement" icon={CalendarRange} iconColor="text-purple-600" iconBg="bg-purple-500/10">
                                <ToggleRow
                                    label="Enable Semi-Annual Rule"
                                    description="Enforce H1/H2 isolation and consecutive-only yearly leave."
                                    checked={formData.semiAnnualPolicyEnabled}
                                    onCheckedChange={(v) => setFormData(prev => ({ ...prev, semiAnnualPolicyEnabled: v }))}
                                />
                            </SectionCard>

                            {/* Card 2: Cycle Start Month */}
                            <SectionCard title="Cycle Start Month" description="Fiscal year cycle anchor" icon={CalendarRange} iconColor="text-sky-600" iconBg="bg-sky-500/10">
                                <FieldRow label="Cycle Start Month" disabled={!formData.semiAnnualPolicyEnabled}>
                                    <Select
                                        value={(formData.semiAnnualCycleStartMonth ?? 4).toString()}
                                        onValueChange={(val) => setFormData(prev => ({ ...prev, semiAnnualCycleStartMonth: parseInt(val) }))}
                                        disabled={!formData.semiAnnualPolicyEnabled}
                                    >
                                        <SelectTrigger className="h-9 bg-background border-border/80 rounded-md text-xs font-semibold">
                                            <SelectValue placeholder="Select start month" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-md border-border/80">
                                            <SelectItem value="1" className="text-xs">January</SelectItem>
                                            <SelectItem value="4" className="text-xs">April (Fiscal Year)</SelectItem>
                                            <SelectItem value="7" className="text-xs">July (Mid-Year)</SelectItem>
                                            <SelectItem value="10" className="text-xs">October (Q4)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FieldRow>
                                <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                                    Defines when the first half of the leave cycle begins for all employees.
                                </p>
                            </SectionCard>

                            {/* Card 3: Half-Day Boundaries */}
                            <SectionCard title="Half-Day Boundaries" description="Session split configuration" icon={ListOrdered} iconColor="text-orange-600" iconBg="bg-orange-500/10">
                                <div className="grid grid-cols-2 gap-3">
                                    <FieldRow label="First Half Ends">
                                        <Input
                                            type="time"
                                            value={formData.firstHalfEndTime}
                                            onChange={(e) => setFormData(prev => ({ ...prev, firstHalfEndTime: e.target.value }))}
                                            className={inputClass}
                                        />
                                    </FieldRow>
                                    <FieldRow label="Second Half Starts">
                                        <Input
                                            type="time"
                                            value={formData.secondHalfStartTime}
                                            onChange={(e) => setFormData(prev => ({ ...prev, secondHalfStartTime: e.target.value }))}
                                            className={inputClass}
                                        />
                                    </FieldRow>
                                </div>
                            </SectionCard>
                        </div>

                        <SaveBar loading={loading} success={success} error={error} label="Save Leave Frameworks" />
                    </form>
                </TabsContent>

                {/* ─── PUBLIC HOLIDAYS ─── */}
                <TabsContent value="holidays" className="outline-none m-0">
                    <HolidayManagement initialHolidays={initialHolidays} />
                </TabsContent>

                {/* ─── ANNOUNCEMENTS ─── */}
                <TabsContent value="announcements" className="outline-none m-0">
                    <AnnouncementManagement initialAnnouncements={initialAnnouncements} departments={initialDepartments} />
                </TabsContent>
            </Tabs>
        </div>
    )
}

function SaveBar({ loading, success, error, label }: { loading: boolean; success: boolean; error: string | null; label: string }) {
    return (
        <div className="flex items-center justify-between p-4 bg-card border border-border/80 rounded-md shadow-2xs">
            <div className="flex-1 pr-4">
                {success && (
                    <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold">
                        <CheckCircle2 className="size-4 shrink-0" />
                        <span>Configuration saved successfully</span>
                    </div>
                )}
                {error && (
                    <div className="flex items-center gap-2 text-rose-600 text-xs font-semibold">
                        <AlertCircle className="size-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
            </div>
            <Button
                type="submit"
                disabled={loading}
                className="h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-semibold text-xs shadow-xs transition-colors cursor-pointer gap-1.5"
            >
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <><Save className="size-3.5" />{label}</>}
            </Button>
        </div>
    )
}

function PayrollPinSection() {
    const { data: session } = useSession()
    const isAdmin = isAdminRole(session?.user)

    const [currentPin, setCurrentPin] = useState("")
    const [newPin, setNewPin] = useState("")
    const [confirmPin, setConfirmPin] = useState("")
    const [loading, setLoading] = useState(false)
    const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null)
    const [pinStatus, setPinStatus] = useState<{ isDefault: boolean; pinLength: number } | null>(null)
    const [overrideMode, setOverrideMode] = useState(false)
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)

    const loadPinStatus = async () => {
        try {
            const res = await getPayrollPinStatus()
            if (res.success && res.data) {
                setPinStatus(res.data)
            }
        } catch { }
    }

    useEffect(() => {
        loadPinStatus()
    }, [])

    const handlePinUpdate = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        if (!overrideMode && !currentPin) {
            setStatusMsg({ text: "Please enter your current PIN.", isError: true })
            return
        }
        if (!newPin) {
            setStatusMsg({ text: "Please enter a new PIN.", isError: true })
            return
        }
        if (newPin !== confirmPin) {
            setStatusMsg({ text: "New PIN and Confirmation PIN do not match.", isError: true })
            return
        }
        if (!/^\d{4}$/.test(newPin)) {
            setStatusMsg({ text: "New PIN must be exactly 4 numeric digits.", isError: true })
            return
        }

        setLoading(true)
        setStatusMsg(null)
        try {
            if (overrideMode) {
                const res = await adminResetPayrollPin({ newPin })
                if (res.success) {
                    toast.success(res.message || "Security PIN updated successfully.")
                    setStatusMsg({ text: "Security PIN force-overridden successfully!", isError: false })
                    setNewPin("")
                    setConfirmPin("")
                    loadPinStatus()
                } else {
                    setStatusMsg({ text: res.error || "Failed to update PIN.", isError: true })
                    toast.error(res.error || "Failed to update PIN.")
                }
            } else {
                const res = await updatePayrollPin(currentPin, newPin)
                if (res.success) {
                    toast.success(res.message || "Security PIN updated successfully.")
                    setStatusMsg({ text: "PIN updated successfully!", isError: false })
                    setCurrentPin("")
                    setNewPin("")
                    setConfirmPin("")
                    loadPinStatus()
                } else {
                    setStatusMsg({ text: res.error || "Failed to update PIN.", isError: true })
                    toast.error(res.error || "Failed to update PIN.")
                }
            }
        } catch (err: any) {
            setStatusMsg({ text: err.message || "An unexpected error occurred.", isError: true })
        } finally {
            setLoading(false)
        }
    }

    const handleResetToDefault = async () => {
        setLoading(true)
        setStatusMsg(null)
        try {
            const res = await adminResetPayrollPin({ resetToDefault: true })
            if (res.success) {
                toast.success("Security PIN restored to system default.")
                setStatusMsg({ text: "Security PIN restored to system default!", isError: false })
                setCurrentPin("")
                setNewPin("")
                setConfirmPin("")
                setIsResetDialogOpen(false)
                loadPinStatus()
            } else {
                setStatusMsg({ text: res.error || "Failed to reset PIN.", isError: true })
                toast.error(res.error || "Failed to reset PIN.")
            }
        } catch (err: any) {
            setStatusMsg({ text: err.message || "An unexpected error occurred.", isError: true })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-3.5">
            {/* Status & Protection Notice */}
            <div className="flex items-center justify-between p-2.5 rounded bg-muted/30 border border-border/70 text-[11px]">
                <div className="flex items-start gap-2 text-muted-foreground">
                    <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
                    <span>Protects salary records & compensation registers.</span>
                </div>
                {pinStatus && (
                    <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 border",
                        pinStatus.isDefault
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    )}>
                        {pinStatus.isDefault ? "Initial Security PIN" : "Custom PIN Active"}
                    </span>
                )}
            </div>

            {/* Admin Override Toggle */}
            {isAdmin && (
                <div className="flex items-center justify-between p-2 rounded-md bg-primary/5 border border-primary/20 text-xs">
                    <div className="flex items-center gap-2">
                        <Shield className="size-3.5 text-primary" />
                        <span className="font-semibold text-foreground text-[11px]">Admin PIN Recovery Mode</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setOverrideMode(!overrideMode)
                            setStatusMsg(null)
                        }}
                        className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    >
                        {overrideMode ? "Switch to Standard Mode" : "Force Override (No Current PIN)"}
                    </button>
                </div>
            )}

            <div className="space-y-3">
                {!overrideMode ? (
                    <FieldRow label="Current PIN">
                        <Input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            placeholder="Current PIN (4 digits)..."
                            value={currentPin}
                            onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handlePinUpdate();
                                }
                            }}
                            className="h-8.5 text-xs bg-background border-border/80"
                        />
                    </FieldRow>
                ) : (
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] flex items-center gap-1.5">
                        <AlertTriangle className="size-3.5 shrink-0" />
                        <span>Admin Override active: Current PIN is not required.</span>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                    <FieldRow label="New PIN">
                        <Input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            placeholder="New PIN (4 digits)..."
                            value={newPin}
                            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handlePinUpdate();
                                }
                            }}
                            className="h-8.5 text-xs bg-background border-border/80"
                        />
                    </FieldRow>
                    <FieldRow label="Confirm PIN">
                        <Input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            placeholder="Confirm PIN..."
                            value={confirmPin}
                            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handlePinUpdate();
                                }
                            }}
                            className="h-8.5 text-xs bg-background border-border/80"
                        />
                    </FieldRow>
                </div>

                {statusMsg && (
                    <div className={cn(
                        "p-2 rounded text-xs font-semibold flex items-center gap-1.5",
                        statusMsg.isError ? "bg-rose-500/10 text-rose-600 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    )}>
                        {statusMsg.isError ? <AlertCircle className="size-3.5 shrink-0" /> : <CheckCircle2 className="size-3.5 shrink-0" />}
                        <span>{statusMsg.text}</span>
                    </div>
                )}

                <div className="space-y-2 pt-1">
                    <Button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handlePinUpdate();
                        }}
                        disabled={loading || (!overrideMode && !currentPin) || !newPin || !confirmPin}
                        size="sm"
                        className="w-full h-8 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer gap-1.5 shadow-xs"
                    >
                        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <><Lock className="size-3.5" /> {overrideMode ? "Force Override Security PIN" : "Update Security PIN"}</>}
                    </Button>

                    {/* Admin 1-Click Reset to Default Button */}
                    {isAdmin && (
                        <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                            <AlertDialogTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={loading}
                                    size="sm"
                                    className="w-full h-8 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border-amber-500/30 cursor-pointer gap-1.5"
                                >
                                    <RefreshCw className="size-3.5" />
                                    <span>Restore Default Security PIN</span>
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
                                        <AlertTriangle className="size-4.5" />
                                        <AlertDialogTitle>Restore System Security PIN?</AlertDialogTitle>
                                    </div>
                                    <AlertDialogDescription className="text-xs text-muted-foreground mt-1.5">
                                        This action will restore the Payroll Security PIN to the initial system default. Authorized staff will be able to access salary registers using the initial setup PIN.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-2">
                                    <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={handleResetToDefault}
                                        className="text-xs h-8 font-bold bg-amber-600 hover:bg-amber-700 text-white"
                                    >
                                        Yes, Restore Default PIN
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </div>
        </div>
    )
}

