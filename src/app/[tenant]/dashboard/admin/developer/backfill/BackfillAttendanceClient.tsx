"use client";

import { useState, useEffect, useMemo, useTransition, useCallback } from "react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek } from "date-fns";
import {
  CalendarPlus,
  Search,
  RotateCw,
  Building2,
  CalendarCheck,
  Clock,
  UserCheck,
  Zap,
  Check,
  Calendar,
  CheckSquare,
  Square,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  previewBackfillSchedule,
  executeBackfillAttendance,
  BackfillEmployee,
  PreviewDayItem,
  BackfillEntryInput,
} from "@/actions/developer-backfill";
import { toast } from "sonner";

interface BackfillAttendanceClientProps {
  initialUsers?: BackfillEmployee[];
}

type TabFilter = "ALL" | "SELECTED_ONLY" | "MISSING_ONLY" | "EXISTING_ONLY";

export function BackfillAttendanceClient({ initialUsers = [] }: BackfillAttendanceClientProps) {
  const users = initialUsers;
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || "");

  const today = useMemo(() => new Date(), []);
  const [startDate, setStartDate] = useState<string>(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState<string>(format(today, "yyyy-MM-dd"));

  // Configuration options
  const [defaultInTime, setDefaultInTime] = useState<string>("09:30");
  const [defaultOutTime, setDefaultOutTime] = useState<string>("18:00");
  const [addJitter, setAddJitter] = useState<boolean>(true);
  const [skipSundays, setSkipSundays] = useState<boolean>(true);
  const [skipHolidays, setSkipHolidays] = useState<boolean>(true);
  const [skipLeaves, setSkipLeaves] = useState<boolean>(true);
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(false);
  const [markAsSpecialCase, setMarkAsSpecialCase] = useState<boolean>(false);

  // Data & Preview State
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<BackfillEmployee | null>(users[0] || null);
  const [previewDays, setPreviewDays] = useState<PreviewDayItem[]>([]);
  const [stats, setStats] = useState({
    totalDays: 0,
    missingDaysCount: 0,
    existingDaysCount: 0,
    sundayDaysCount: 0,
    holidayDaysCount: 0,
    leaveDaysCount: 0,
    futureDaysCount: 0,
  });

  // Table filters & Search
  const [activeTab, setActiveTab] = useState<TabFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Confirmation modal
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, startTransition] = useTransition();

  // Synchronize default times when selected employee changes
  useEffect(() => {
    const u = users.find((item) => item.id === selectedUserId);
    if (u) {
      setSelectedUser(u);
      if (u.location?.startTime) setDefaultInTime(u.location.startTime);
      if (u.location?.endTime) setDefaultOutTime(u.location.endTime);
    }
  }, [selectedUserId, users]);

  // Load schedule preview
  const loadPreview = useCallback(
    async (uId = selectedUserId, sDate = startDate, eDate = endDate, isSilent = false) => {
      if (!uId || !sDate || !eDate) return;
      if (!isSilent) setLoadingPreview(true);
      try {
        const res = await previewBackfillSchedule(uId, sDate, eDate, {
          customPunchIn: defaultInTime,
          customPunchOut: defaultOutTime,
          addJitter,
          jitterMinutes: 5,
          skipSundays,
          skipHolidays,
          skipLeaves,
          isSpecialCase: markAsSpecialCase,
        });

        if (res.success && res.days) {
          setPreviewDays(res.days);
          if (res.user) setSelectedUser(res.user as any);
          if (res.stats) setStats(res.stats as any);
        } else {
          toast.error(res.error || "Failed to load schedule preview");
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to load schedule preview");
      } finally {
        if (!isSilent) setLoadingPreview(false);
      }
    },
    [selectedUserId, startDate, endDate, defaultInTime, defaultOutTime, addJitter, skipSundays, skipHolidays, skipLeaves, markAsSpecialCase]
  );

  useEffect(() => {
    if (selectedUserId) {
      loadPreview(selectedUserId, startDate, endDate);
    }
  }, [selectedUserId, startDate, endDate, addJitter, skipSundays, skipHolidays, skipLeaves, loadPreview]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPreview(selectedUserId, startDate, endDate, true);
    setRefreshing(false);
    toast.success("Preview re-calculated");
  };

  // Quick Date Presets (All capping strictly at current date / today)
  const applyPreset = (preset: "THIS_MONTH" | "LAST_MONTH" | "THIS_WEEK" | "PAST_30_DAYS" | "SINCE_JOIN") => {
    const d = new Date();
    let s = "";
    let e = "";

    switch (preset) {
      case "THIS_MONTH":
        s = format(startOfMonth(d), "yyyy-MM-dd");
        e = format(d, "yyyy-MM-dd"); // Auto-selects till current date only
        break;
      case "LAST_MONTH":
        const prevM = subMonths(d, 1);
        s = format(startOfMonth(prevM), "yyyy-MM-dd");
        e = format(endOfMonth(prevM), "yyyy-MM-dd");
        break;
      case "THIS_WEEK":
        s = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
        const endW = endOfWeek(d, { weekStartsOn: 1 });
        e = format(endW > d ? d : endW, "yyyy-MM-dd"); // Auto-selects till current date only
        break;
      case "PAST_30_DAYS":
        s = format(subDays(d, 30), "yyyy-MM-dd");
        e = format(d, "yyyy-MM-dd");
        break;
      case "SINCE_JOIN":
        if (selectedUser?.createdAt) {
          s = format(new Date(selectedUser.createdAt), "yyyy-MM-dd");
          e = format(d, "yyyy-MM-dd");
        } else {
          s = format(startOfMonth(d), "yyyy-MM-dd");
          e = format(d, "yyyy-MM-dd");
        }
        break;
    }

    setStartDate(s);
    setEndDate(e);
  };

  // Toggle single day selection
  const handleToggleSelectDay = (dateStr: string) => {
    setPreviewDays((prev) =>
      prev.map((d) => {
        if (d.dateStr === dateStr) {
          if (d.isFuture) {
            toast.error("Future dates cannot be backfilled.");
            return d;
          }
          return { ...d, selected: !d.selected };
        }
        return d;
      })
    );
  };

  // Select all or Deselect all (Strictly excludes future dates, holidays, sundays, leaves)
  const handleSelectAll = (select: boolean) => {
    setPreviewDays((prev) =>
      prev.map((d) => {
        if (select) {
          // If selecting, only select past/current missing or existing (respecting exclusion toggles)
          if (
            !d.isFuture &&
            (!skipHolidays || !d.isHoliday) &&
            (!skipSundays || !d.isSunday) &&
            (!skipLeaves || d.status !== "ON_LEAVE") &&
            (d.status === "MISSING" || (overwriteExisting && d.status === "EXISTS"))
          ) {
            return { ...d, selected: true };
          }
          return { ...d, selected: false };
        }
        return { ...d, selected: false };
      })
    );
  };

  // Update proposed time for a specific day
  const handleUpdateTime = (dateStr: string, field: "in" | "out", val: string) => {
    setPreviewDays((prev) =>
      prev.map((d) => {
        if (d.dateStr === dateStr) {
          return {
            ...d,
            proposedPunchIn: field === "in" ? val : d.proposedPunchIn,
            proposedPunchOut: field === "out" ? val : d.proposedPunchOut,
          };
        }
        return d;
      })
    );
  };

  // Count selected days
  const selectedCount = useMemo(() => {
    return previewDays.filter((d) => d.selected).length;
  }, [previewDays]);

  // Execute Backfill submission
  const handleConfirmBackfill = () => {
    const selectedEntries: BackfillEntryInput[] = previewDays
      .filter((d) => d.selected)
      .map((d) => ({
        dateStr: d.dateStr,
        punchInStr: d.proposedPunchIn,
        punchOutStr: d.proposedPunchOut,
        isLateSpecialCase: markAsSpecialCase,
      }));

    if (selectedEntries.length === 0) {
      toast.error("Please select at least one day to backfill.");
      return;
    }

    startTransition(async () => {
      const res = await executeBackfillAttendance(selectedUserId, selectedEntries, {
        overwriteExisting,
        markAsSpecialCase,
      });

      if (res.success) {
        toast.success(res.message || `Successfully backfilled ${res.createdCount} attendance records!`);
        setIsConfirmOpen(false);
        loadPreview(selectedUserId, startDate, endDate);
      } else {
        toast.error(res.error || "Failed to execute attendance backfill.");
      }
    });
  };

  // Filtered preview days
  const filteredDays = useMemo(() => {
    return previewDays.filter((d) => {
      // Tab filter
      if (activeTab === "SELECTED_ONLY" && !d.selected) return false;
      if (activeTab === "MISSING_ONLY" && d.status !== "MISSING") return false;
      if (activeTab === "EXISTING_ONLY" && d.status !== "EXISTS") return false;

      // Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const dStr = d.dateStr.toLowerCase();
        const dName = d.dayName.toLowerCase();
        const leave = d.approvedLeave ? `${d.approvedLeave.duration} ${d.approvedLeave.category}`.toLowerCase() : "";
        return dStr.includes(q) || dName.includes(q) || leave.includes(q);
      }

      return true;
    });
  }, [previewDays, activeTab, searchQuery]);

  return (
    <div className="space-y-4">
      {/* ── Executive Header Banner (Matching Existing Developer Suite Style) ── */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="size-8 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <CalendarPlus className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 sm:mb-1 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none">
                Attendance Backfill Generator
              </h1>
              <Badge
                variant="outline"
                className="text-[9px] sm:text-[10px] uppercase font-bold text-primary bg-primary/10 border-primary/20 px-1.5 sm:px-2 py-0.5 rounded-sm"
              >
                Developer Suite
              </Badge>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1 sm:line-clamp-none">
              Generate and backfill historical check-in/out records for newly onboarded employees across custom date ranges
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || loadingPreview}
            className="h-9 px-3 text-xs font-semibold gap-1.5 cursor-pointer hover:bg-muted/80 rounded-md"
            title="Recalculate preview"
          >
            <RotateCw className={cn("size-3.5", refreshing && "animate-spin text-primary")} />
            <span className="hidden sm:inline">Recalculate</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsConfirmOpen(true)}
            disabled={loadingPreview || selectedCount === 0 || isSubmitting}
            className="h-9 px-3.5 text-xs font-semibold gap-2 shadow-xs cursor-pointer rounded-md bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Zap className="size-4" />
            <span>Backfill {selectedCount} Selected Days</span>
          </Button>
        </div>
      </div>

      {/* ── Summary KPI Cards (Matching Existing Developer KPI Layout) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Date Span</span>
            <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Calendar className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground tracking-tight">{stats.totalDays}</span>
            <span className="text-[11px] text-muted-foreground">total calendar days</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            <span>{startDate} to {endDate}</span>
          </div>
        </div>

        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 shadow-2xs hover:border-amber-500/50 transition-all">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-1.5">
            <span className="text-xs font-medium">Missing / Unfilled</span>
            <div className="size-8 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 tracking-tight">
              {stats.missingDaysCount}
            </span>
            <span className="text-[11px] text-amber-700/80">days ready to backfill</span>
          </div>
          <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            <span>{selectedCount} currently selected</span>
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Existing Logs</span>
            <div className="size-8 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <UserCheck className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {stats.existingDaysCount}
            </span>
            <span className="text-[11px] text-muted-foreground">preserved in database</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            <span>{overwriteExisting ? "Overwrite enabled" : "Protected from overwrite"}</span>
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Selected Employee</span>
            <div className="size-8 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Building2 className="size-4" />
            </div>
          </div>
          <div className="truncate">
            <span className="text-sm font-bold text-foreground truncate block">
              {selectedUser?.name || "Select an employee"}
            </span>
            <span className="text-[11px] text-muted-foreground truncate block">
              {selectedUser?.department?.name || "General Department"}
              {selectedUser?.employeeCode && ` • ${selectedUser.employeeCode}`}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            <span>
              Shift: {selectedUser?.location?.startTime || "09:30"} - {selectedUser?.location?.endTime || "18:00"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Control Configuration Panel ── */}
      <div className="rounded-md bg-card border border-border/80 p-4 shadow-2xs space-y-4">
        {/* Row 1: Employee Picker & Date Range */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 flex-wrap">
          {/* Employee Dropdown */}
          <div className="flex items-center gap-2.5 w-full lg:w-auto">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              Employee:
            </span>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="h-9 w-full sm:w-[280px] text-xs font-medium rounded-md bg-background/80">
                <SelectValue placeholder="Select an employee" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-5 border border-border/60">
                        <AvatarImage src={u.avatarUrl || undefined} />
                        <AvatarFallback className="text-[9px] font-bold">
                          {u.name?.slice(0, 2).toUpperCase() || "EM"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-semibold">{u.name}</span>
                      <span className="text-muted-foreground text-[10px]">
                        ({u.department?.name || u.employeeCode || "General"})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Inputs & Presets */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-xs w-[130px] rounded-md bg-background/80"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-xs w-[130px] rounded-md bg-background/80"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => loadPreview(selectedUserId, startDate, endDate)}
                disabled={loadingPreview}
                className="h-8 px-2.5 text-xs font-semibold cursor-pointer rounded-md"
              >
                Apply
              </Button>
            </div>

            <div className="h-4 w-px bg-border/80 hidden sm:block mx-1" />

            {/* Quick Presets */}
            <div className="flex items-center gap-1 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset("THIS_MONTH")}
                className="h-8 px-2 text-[11px] font-medium cursor-pointer rounded-md hover:bg-muted/80"
              >
                This Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset("LAST_MONTH")}
                className="h-8 px-2 text-[11px] font-medium cursor-pointer rounded-md hover:bg-muted/80"
              >
                Last Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset("THIS_WEEK")}
                className="h-8 px-2 text-[11px] font-medium cursor-pointer rounded-md hover:bg-muted/80"
              >
                This Week
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset("PAST_30_DAYS")}
                className="h-8 px-2 text-[11px] font-medium cursor-pointer rounded-md hover:bg-muted/80"
              >
                Past 30d
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset("SINCE_JOIN")}
                className="h-8 px-2 text-[11px] font-medium cursor-pointer rounded-md hover:bg-muted/80"
                title="Backfill from employee joining date"
              >
                Since Joining
              </Button>
            </div>
          </div>
        </div>

        {/* Row 2: Default Shift Times & Generation Preferences */}
        <div className="pt-3 border-t border-border/40 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Default Shift In & Out */}
          <div className="flex items-center gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Default Punch In</Label>
              <Input
                type="time"
                value={defaultInTime}
                onChange={(e) => setDefaultInTime(e.target.value)}
                className="h-8 text-xs font-mono rounded-md w-32 px-2 bg-background/80 shadow-2xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Default Punch Out</Label>
              <Input
                type="time"
                value={defaultOutTime}
                onChange={(e) => setDefaultOutTime(e.target.value)}
                className="h-8 text-xs font-mono rounded-md w-32 px-2 bg-background/80 shadow-2xs"
              />
            </div>
          </div>

          {/* Jitter & Sunday / Holiday Toggles */}
          <div className="flex flex-col justify-center gap-2">
            <div className="flex items-center gap-2">
              <Switch
                id="add-jitter"
                checked={addJitter}
                onCheckedChange={setAddJitter}
                className="cursor-pointer"
              />
              <Label htmlFor="add-jitter" className="text-xs cursor-pointer font-medium">
                Natural Jitter (±1–5m)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="skip-sundays"
                checked={skipSundays}
                onCheckedChange={setSkipSundays}
                className="cursor-pointer"
              />
              <Label htmlFor="skip-sundays" className="text-xs cursor-pointer font-medium">
                Skip Sundays & Weekends
              </Label>
            </div>
          </div>

          {/* Holiday & Leave Toggles */}
          <div className="flex flex-col justify-center gap-2">
            <div className="flex items-center gap-2">
              <Switch
                id="skip-holidays"
                checked={skipHolidays}
                onCheckedChange={setSkipHolidays}
                className="cursor-pointer"
              />
              <Label htmlFor="skip-holidays" className="text-xs cursor-pointer font-medium">
                Skip Public Holidays
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="skip-leaves"
                checked={skipLeaves}
                onCheckedChange={setSkipLeaves}
                className="cursor-pointer"
              />
              <Label htmlFor="skip-leaves" className="text-xs cursor-pointer font-medium">
                Skip Approved Leaves
              </Label>
            </div>
          </div>

          {/* Overwrite & Special Case Waiver Toggles */}
          <div className="flex flex-col justify-center gap-2">
            <div className="flex items-center gap-2">
              <Switch
                id="overwrite-exist"
                checked={overwriteExisting}
                onCheckedChange={setOverwriteExisting}
                className="cursor-pointer"
              />
              <Label htmlFor="overwrite-exist" className="text-xs cursor-pointer font-medium text-rose-600 dark:text-rose-400">
                Overwrite Existing Logs
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="special-case-flag"
                checked={markAsSpecialCase}
                onCheckedChange={setMarkAsSpecialCase}
                className="cursor-pointer data-[state=checked]:bg-emerald-600"
              />
              <Label htmlFor="special-case-flag" className="text-xs cursor-pointer font-medium text-emerald-600 dark:text-emerald-400">
                Waive Late (* Special Case)
              </Label>
            </div>
          </div>
        </div>

        {/* Row 3: Status Filter Tabs & Bulk Select */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/40">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <Button
              variant={activeTab === "ALL" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("ALL")}
              className="h-8 text-xs font-medium rounded-md px-2.5 cursor-pointer"
            >
              All Days ({previewDays.length})
            </Button>
            <Button
              variant={activeTab === "SELECTED_ONLY" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("SELECTED_ONLY")}
              className="h-8 text-xs font-medium rounded-md px-2.5 text-primary cursor-pointer font-semibold"
            >
              Selected ({selectedCount})
            </Button>
            <Button
              variant={activeTab === "MISSING_ONLY" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("MISSING_ONLY")}
              className="h-8 text-xs font-medium rounded-md px-2.5 text-amber-600 dark:text-amber-400 cursor-pointer"
            >
              Missing Only ({stats.missingDaysCount})
            </Button>
            <Button
              variant={activeTab === "EXISTING_ONLY" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("EXISTING_ONLY")}
              className="h-8 text-xs font-medium rounded-md px-2.5 text-emerald-600 dark:text-emerald-400 cursor-pointer"
            >
              Existing Logs ({stats.existingDaysCount})
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectAll(true)}
              className="h-8 px-2.5 text-xs font-medium rounded-md cursor-pointer"
            >
              <CheckSquare className="size-3.5 mr-1" />
              Select All Missing
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectAll(false)}
              className="h-8 px-2.5 text-xs font-medium rounded-md cursor-pointer"
            >
              <Square className="size-3.5 mr-1" />
              Deselect All
            </Button>

            <div className="relative w-full sm:w-[200px]">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter by date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs rounded-md bg-background/80"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Interactive Preview Table ── */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40 border-b border-border/70">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 text-center py-3.5 px-3">
                  <span className="sr-only">Select</span>
                </TableHead>
                <TableHead className="font-semibold text-xs py-3.5 px-4">Date & Day</TableHead>
                <TableHead className="font-semibold text-xs py-3.5 px-3">Current Status</TableHead>
                <TableHead className="font-semibold text-xs py-3.5 px-3 min-w-[140px]">Proposed Check In</TableHead>
                <TableHead className="font-semibold text-xs py-3.5 px-3 min-w-[140px]">Proposed Check Out</TableHead>
                <TableHead className="font-semibold text-xs py-3.5 px-3">Leave / Exemption</TableHead>
                <TableHead className="font-semibold text-xs py-3.5 px-4 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/40">
              {loadingPreview ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RotateCw className="size-6 text-primary animate-spin" />
                      <p className="text-xs text-muted-foreground font-medium">
                        Calculating schedule and detecting missing attendance records...
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredDays.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CalendarCheck className="size-8 text-muted-foreground/50" />
                      <p className="text-xs font-semibold text-muted-foreground">
                        No calendar days match the current filters
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDays.map((item) => {
                  const isMissing = item.status === "MISSING";
                  const isExisting = item.status === "EXISTS";
                  const isSunday = item.isSunday;
                  const isHoliday = item.isHoliday;
                  const isLeave = item.status === "ON_LEAVE";
                  const isFuture = item.isFuture;

                  return (
                    <TableRow
                      key={item.dateStr}
                      className={cn(
                        "group hover:bg-muted/30 transition-colors",
                        item.selected && "bg-primary/5 dark:bg-primary/10",
                        isFuture && "bg-muted/5 opacity-60",
                        isHoliday && !item.selected && !isFuture && "bg-rose-500/5",
                        isSunday && !item.selected && !isFuture && !isHoliday && "bg-muted/10 opacity-70",
                        isLeave && !item.selected && !isFuture && "bg-blue-500/5"
                      )}
                    >
                      {/* Checkbox */}
                      <TableCell className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => handleToggleSelectDay(item.dateStr)}
                          disabled={isFuture}
                          className={cn(
                            "size-4 rounded border-border text-primary cursor-pointer accent-primary",
                            isFuture && "opacity-20 cursor-not-allowed"
                          )}
                        />
                      </TableCell>

                      {/* Date & Day */}
                      <TableCell className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-xs font-bold font-mono",
                              isSunday || isFuture ? "text-muted-foreground" : isHoliday ? "text-rose-600 font-black" : "text-foreground"
                            )}
                          >
                            {item.dateStr}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] px-1.5 py-0 uppercase font-semibold rounded-xs",
                              isFuture
                                ? "bg-muted text-muted-foreground"
                                : isHoliday
                                  ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                                  : isSunday
                                    ? "bg-muted text-muted-foreground"
                                    : "text-primary border-primary/20 bg-primary/5"
                            )}
                          >
                            {item.shortDay}
                          </Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                          {item.dayName}
                        </div>
                      </TableCell>

                      {/* Current Status */}
                      <TableCell className="py-3 px-3">
                        {isFuture && (
                          <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] px-1.5 py-0 rounded-xs">
                            Future Date
                          </Badge>
                        )}
                        {!isFuture && isHoliday && (
                          <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[10px] px-1.5 py-0 rounded-xs">
                            Holiday: {item.holidayName || "Public Holiday"}
                          </Badge>
                        )}
                        {!isFuture && !isHoliday && isMissing && (
                          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] px-1.5 py-0 rounded-xs">
                            Missing (Ready to Backfill)
                          </Badge>
                        )}
                        {!isFuture && isExisting && (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] px-1.5 py-0 rounded-xs">
                            Logged ({format(new Date(item.existingAttendance!.punchIn), "hh:mm a")})
                          </Badge>
                        )}
                        {!isFuture && !isHoliday && isSunday && (
                          <Badge variant="secondary" className="text-[10px] text-muted-foreground px-1.5 py-0 rounded-xs">
                            Sunday (Weekend)
                          </Badge>
                        )}
                        {!isFuture && isLeave && (
                          <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/30 text-[10px] px-1.5 py-0 rounded-xs">
                            Approved Leave ({item.approvedLeave?.duration})
                          </Badge>
                        )}
                      </TableCell>

                      {/* Proposed Check In */}
                      <TableCell className="py-3 px-3 min-w-[140px]">
                        <Input
                          type="time"
                          value={item.proposedPunchIn}
                          onChange={(e) => handleUpdateTime(item.dateStr, "in", e.target.value)}
                          className={cn(
                            "h-8 w-32 px-2 text-xs font-mono rounded-md bg-background/80 shadow-2xs",
                            item.selected ? "border-primary/50 font-bold text-foreground" : "opacity-70 text-muted-foreground"
                          )}
                          disabled={!item.selected || isFuture}
                        />
                      </TableCell>

                      {/* Proposed Check Out */}
                      <TableCell className="py-3 px-3 min-w-[140px]">
                        <Input
                          type="time"
                          value={item.proposedPunchOut}
                          onChange={(e) => handleUpdateTime(item.dateStr, "out", e.target.value)}
                          className={cn(
                            "h-8 w-32 px-2 text-xs font-mono rounded-md bg-background/80 shadow-2xs",
                            item.selected ? "border-primary/50 font-bold text-foreground" : "opacity-70 text-muted-foreground"
                          )}
                          disabled={!item.selected || isFuture}
                        />
                      </TableCell>

                      {/* Leave / Exemption */}
                      <TableCell className="py-3 px-3">
                        {item.approvedLeave ? (
                          <span className="text-[10px] font-medium text-blue-600">
                            {item.approvedLeave.duration} Leave ({item.approvedLeave.category})
                          </span>
                        ) : markAsSpecialCase ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] px-1.5 py-0 rounded-xs">
                            Waived *
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40">—</span>
                        )}
                      </TableCell>

                      {/* Action */}
                      <TableCell className="py-3 px-4 text-right">
                        <Button
                          variant={item.selected ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleToggleSelectDay(item.dateStr)}
                          disabled={isFuture}
                          className="h-7 px-2.5 text-[11px] font-medium rounded-md cursor-pointer disabled:opacity-40"
                        >
                          {isFuture ? "Future" : item.selected ? "Selected" : "Include"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Confirmation Modal ── */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Zap className="size-5 text-primary" />
              Confirm Attendance Backfill
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Please review the backfill parameters before committing attendance logs to the database.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 text-xs">
            <div className="rounded-md border border-border/80 bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Target Employee:</span>
                <span className="font-bold text-foreground">{selectedUser?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Selected Days:</span>
                <Badge variant="secondary" className="font-mono font-bold text-primary">
                  {selectedCount} days
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Date Range:</span>
                <span className="font-mono">{startDate} to {endDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Overwrite Existing:</span>
                <span className={overwriteExisting ? "text-rose-600 font-semibold" : "text-muted-foreground"}>
                  {overwriteExisting ? "Yes (Will replace)" : "No (Skip existing)"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Special Case Exemption:</span>
                <span className={markAsSpecialCase ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
                  {markAsSpecialCase ? "Enabled (Waived *)" : "Standard Policy"}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-primary/5 p-2.5 rounded-md border border-primary/20">
              <Info className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                Backfilled attendance records will automatically sync with approved leaves and reflect in the accountant ledger, employee attendance calendar, and payroll reports.
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmBackfill}
              disabled={isSubmitting}
              className="text-xs font-semibold gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <RotateCw className="size-3.5 animate-spin" />
                  Generating Records...
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  Confirm & Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
