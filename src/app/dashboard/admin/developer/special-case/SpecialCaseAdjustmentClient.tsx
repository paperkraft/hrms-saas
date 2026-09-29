"use client";

import { useState, useEffect, useMemo, useTransition, useCallback } from "react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek } from "date-fns";
import {
  Sparkles,
  Search,
  RotateCw,
  Building2,
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserCheck,
  RotateCcw,
  Sun,
  ShieldCheck,
  Filter,
  Check,
  Calendar as CalendarIcon,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  getUserAttendanceForSpecialCase,
  toggleSpecialCaseDay,
  batchUpdateSpecialCase,
} from "@/actions/developer-special-case";
import { toast } from "sonner";

interface UserItem {
  id: string;
  name: string | null;
  email: string | null;
  employeeCode: string | null;
  designation: string | null;
  avatarUrl: string | null;
  gender: string | null;
  department: { id: string; name: string } | null;
  location: { id: string; name: string; startTime: string; endTime: string; graceTimeMinutes: number } | null;
}

interface DayItem {
  dateStr: string;
  date: Date;
  dayName: string;
  shortDay: string;
  isSunday: boolean;
  attendance: {
    id: string;
    punchIn: string | Date;
    punchOut: string | Date | null;
    isLate: boolean;
    isLateSpecialCase: boolean;
    isHalfDay: boolean;
    isEarlyLogoff: boolean;
    isOutsideOffice: boolean;
    totalHours: number;
  } | null;
  leave: {
    id: string;
    duration: string;
    category: string;
    leaveType: string | null;
    halfDayType: string | null;
    startTime: string | null;
    endTime: string | null;
  } | null;
}

interface StatsData {
  totalDays: number;
  presentCount: number;
  unwaivedLateCount: number;
  waivedSpecialCaseCount: number;
  totalLateMarks: number;
  totalHoursWorked: number;
}

type FilterTab = "ALL" | "UNWAIVED_LATE" | "WAIVED_SPECIAL" | "PRESENT_ONLY" | "LEAVE_ONLY";

interface SpecialCaseAdjustmentClientProps {
  initialUsers?: UserItem[];
}

export function SpecialCaseAdjustmentClient({ initialUsers = [] }: SpecialCaseAdjustmentClientProps) {
  const users = initialUsers;
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || "");

  const today = useMemo(() => new Date(), []);
  const [startDate, setStartDate] = useState<string>(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState<string>(format(endOfMonth(today), "yyyy-MM-dd"));

  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedUser, setSelectedUser] = useState<UserItem | null>(users[0] || null);
  const [days, setDays] = useState<DayItem[]>([]);
  const [stats, setStats] = useState<StatsData>({
    totalDays: 0,
    presentCount: 0,
    unwaivedLateCount: 0,
    waivedSpecialCaseCount: 0,
    totalLateMarks: 0,
    totalHoursWorked: 0,
  });

  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [isPending, startTransition] = useTransition();

  // Fetch attendance data for selected user and date range
  const fetchData = useCallback(
    async (uId = selectedUserId, sDate = startDate, eDate = endDate, isSilent = false) => {
      if (!uId || !sDate || !eDate) return;
      if (!isSilent) setLoadingData(true);
      try {
        const res = await getUserAttendanceForSpecialCase(uId, sDate, eDate);
        if (res.success) {
          if (res.user) setSelectedUser(res.user as any);
          setDays(res.days || []);
          if (res.stats) setStats(res.stats);
        } else {
          toast.error(res.error || "Failed to fetch attendance data");
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to fetch attendance data");
      } finally {
        if (!isSilent) setLoadingData(false);
      }
    },
    [selectedUserId, startDate, endDate]
  );

  useEffect(() => {
    if (selectedUserId) {
      const u = users.find((item) => item.id === selectedUserId);
      if (u) setSelectedUser(u);
      fetchData(selectedUserId, startDate, endDate);
    }
  }, [selectedUserId, fetchData, users]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData(selectedUserId, startDate, endDate, true);
    setRefreshing(false);
    toast.success("Attendance logs refreshed");
  };

  // Date Presets
  const applyPreset = (type: "THIS_MONTH" | "LAST_MONTH" | "THIS_WEEK" | "PAST_7_DAYS" | "PAST_30_DAYS") => {
    const d = new Date();
    let s = "";
    let e = "";

    switch (type) {
      case "THIS_MONTH":
        s = format(startOfMonth(d), "yyyy-MM-dd");
        e = format(endOfMonth(d), "yyyy-MM-dd");
        break;
      case "LAST_MONTH":
        const prevM = subMonths(d, 1);
        s = format(startOfMonth(prevM), "yyyy-MM-dd");
        e = format(endOfMonth(prevM), "yyyy-MM-dd");
        break;
      case "THIS_WEEK":
        s = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
        e = format(endOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
        break;
      case "PAST_7_DAYS":
        s = format(subDays(d, 7), "yyyy-MM-dd");
        e = format(d, "yyyy-MM-dd");
        break;
      case "PAST_30_DAYS":
        s = format(subDays(d, 30), "yyyy-MM-dd");
        e = format(d, "yyyy-MM-dd");
        break;
    }

    setStartDate(s);
    setEndDate(e);
    fetchData(selectedUserId, s, e);
  };

  // Toggle single day
  const handleToggleDay = (attendanceId: string, currentVal: boolean, dateStr: string) => {
    const newVal = !currentVal;

    // Optimistic UI update
    setDays((prev) =>
      prev.map((d) => {
        if (d.attendance?.id === attendanceId) {
          return {
            ...d,
            attendance: {
              ...d.attendance,
              isLateSpecialCase: newVal,
            },
          };
        }
        return d;
      })
    );

    // Update stats optimistically
    setStats((prev) => ({
      ...prev,
      unwaivedLateCount: newVal
        ? Math.max(0, prev.unwaivedLateCount - 1)
        : prev.unwaivedLateCount + 1,
      waivedSpecialCaseCount: newVal
        ? prev.waivedSpecialCaseCount + 1
        : Math.max(0, prev.waivedSpecialCaseCount - 1),
    }));

    startTransition(async () => {
      const res = await toggleSpecialCaseDay(attendanceId, newVal);
      if (res.success) {
        toast.success(`${dateStr}: Special Case ${newVal ? "enabled (Late Waived)" : "disabled"}`);
        fetchData(selectedUserId, startDate, endDate, true);
      } else {
        toast.error(res.error || "Failed to update special case status");
        fetchData(selectedUserId, startDate, endDate);
      }
    });
  };

  // Batch action
  const handleBatchAction = (mode: "WAIVE_LATE_ONLY" | "ALL_DAYS" | "CLEAR") => {
    if (!selectedUserId) return;

    let msg = "Applying batch updates...";
    if (mode === "WAIVE_LATE_ONLY") msg = "Waiving all late marks in the selected range...";
    if (mode === "ALL_DAYS") msg = "Enabling special case on all attendance records in range...";
    if (mode === "CLEAR") msg = "Clearing special case waivers from range...";

    toast.loading(msg, { id: "batch-action" });

    startTransition(async () => {
      const res = await batchUpdateSpecialCase(selectedUserId, startDate, endDate, mode);
      toast.dismiss("batch-action");
      if (res.success) {
        toast.success(`Updated ${res.updatedCount} attendance record(s) successfully!`);
        fetchData(selectedUserId, startDate, endDate);
      } else {
        toast.error(res.error || "Batch update failed");
      }
    });
  };

  // Filtered days list
  const filteredDays = useMemo(() => {
    return days.filter((d) => {
      const att = d.attendance;

      // Tab filter
      if (activeTab === "UNWAIVED_LATE" && (!att || !att.isLate || att.isLateSpecialCase)) return false;
      if (activeTab === "WAIVED_SPECIAL" && (!att || !att.isLateSpecialCase)) return false;
      if (activeTab === "PRESENT_ONLY" && (!att || !att.punchIn)) return false;
      if (activeTab === "LEAVE_ONLY" && !d.leave) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const dStr = d.dateStr.toLowerCase();
        const dName = d.dayName.toLowerCase();
        const leaveInfo = (d.leave?.duration || "") + (d.leave?.leaveType || "") + (d.leave?.category || "");
        return dStr.includes(q) || dName.includes(q) || leaveInfo.toLowerCase().includes(q);
      }

      return true;
    });
  }, [days, activeTab, searchQuery]);

  const formatTimeStr = (dateVal: string | Date | null) => {
    if (!dateVal) return "--";
    try {
      return format(new Date(dateVal), "hh:mm a");
    } catch {
      return "--";
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Executive Header Banner (Matching Existing Developer Suite Style) ── */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="size-8 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Sparkles className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 sm:mb-1 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none">
                Special Case & Late Waivers
              </h1>
              <Badge
                variant="outline"
                className="text-[9px] sm:text-[10px] uppercase font-bold text-primary bg-primary/10 border-primary/20 px-1.5 sm:px-2 py-0.5 rounded-sm"
              >
                Developer Suite
              </Badge>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1 sm:line-clamp-none">
              Employee-specific late waiver console for family accommodations, medical adjustments, and custom date ranges
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || loadingData}
            className="h-9 px-3 text-xs font-semibold gap-1.5 cursor-pointer hover:bg-muted/80 rounded-md"
            title="Refresh logs"
          >
            <RotateCw className={cn("size-3.5", refreshing && "animate-spin text-primary")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleBatchAction("WAIVE_LATE_ONLY")}
            disabled={loadingData || isPending || !selectedUserId}
            className="h-9 px-3.5 text-xs font-semibold gap-2 shadow-xs cursor-pointer rounded-md bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Sparkles className="size-4" />
            <span>Waive Late Marks in Range</span>
          </Button>
        </div>
      </div>

      {/* ── Summary KPI Cards (Matching Existing Developer KPI Layout) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Logged Sessions</span>
            <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <UserCheck className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground tracking-tight">{stats.presentCount}</span>
            <span className="text-[11px] text-muted-foreground">/ {stats.totalDays} days in range</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-block size-2 rounded-full bg-primary" />
            <span>{stats.totalHoursWorked} hrs logged</span>
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Unwaived Late Marks</span>
            <div className="size-8 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "text-2xl font-bold tracking-tight",
                stats.unwaivedLateCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"
              )}
            >
              {stats.unwaivedLateCount}
            </span>
            <span className="text-[11px] text-muted-foreground">penalized</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            <span>Subject to salary deduction</span>
          </div>
        </div>

        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-2xs hover:border-emerald-500/50 transition-all">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 mb-1.5">
            <span className="text-xs font-medium">Waived Special Cases</span>
            <div className="size-8 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Sparkles className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {stats.waivedSpecialCaseCount}
            </span>
            <span className="text-[11px] text-emerald-700/80">protected days</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <span>Zero penalty (* mark in ledger)</span>
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
              Shift: {selectedUser?.location?.startTime || "09:30"} - {selectedUser?.location?.endTime || "18:00"} (
              {selectedUser?.location?.graceTimeMinutes ?? 15}m grace)
            </span>
          </div>
        </div>
      </div>

      {/* ── Filter & Search Toolbar (Matching Existing Developer Control System) ── */}
      <div className="rounded-md bg-card border border-border/80 p-4 shadow-2xs space-y-3.5">
        {/* Row 1: Employee Select & Date Preset Controls */}
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
                onClick={() => fetchData(selectedUserId, startDate, endDate)}
                disabled={loadingData}
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
                onClick={() => applyPreset("PAST_7_DAYS")}
                className="h-8 px-2 text-[11px] font-medium cursor-pointer rounded-md hover:bg-muted/80"
              >
                Past 7d
              </Button>
            </div>
          </div>
        </div>

        {/* Row 2: Status Tab Filters & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/40">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <Button
              variant={activeTab === "ALL" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("ALL")}
              className="h-8 text-xs font-medium rounded-md px-2.5 cursor-pointer"
            >
              All Days ({days.length})
            </Button>
            <Button
              variant={activeTab === "UNWAIVED_LATE" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("UNWAIVED_LATE")}
              className={cn(
                "h-8 text-xs font-medium rounded-md px-2.5 cursor-pointer",
                stats.unwaivedLateCount > 0 ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-muted-foreground"
              )}
            >
              Late Marks ({stats.unwaivedLateCount})
            </Button>
            <Button
              variant={activeTab === "WAIVED_SPECIAL" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("WAIVED_SPECIAL")}
              className={cn(
                "h-8 text-xs font-medium rounded-md px-2.5 cursor-pointer",
                stats.waivedSpecialCaseCount > 0
                  ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                  : "text-muted-foreground"
              )}
            >
              Waived ({stats.waivedSpecialCaseCount})
            </Button>
            <Button
              variant={activeTab === "PRESENT_ONLY" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("PRESENT_ONLY")}
              className="h-8 text-xs font-medium rounded-md px-2.5 text-foreground cursor-pointer"
            >
              Present ({stats.presentCount})
            </Button>
            <Button
              variant={activeTab === "LEAVE_ONLY" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("LEAVE_ONLY")}
              className="h-8 text-xs font-medium rounded-md px-2.5 text-blue-600 dark:text-blue-400 cursor-pointer"
            >
              Leaves / Permissions
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-[220px]">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter days by date/leave..."
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

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchAction("CLEAR")}
              disabled={loadingData || isPending || !selectedUserId}
              className="h-8 px-2.5 text-xs font-medium cursor-pointer rounded-md text-destructive hover:bg-destructive/10"
              title="Clear all special case waivers in range"
            >
              <RotateCcw className="size-3.5 mr-1" />
              Reset Range
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main Attendance Table (Matching Developer Suite Table Layout) ── */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40 border-b border-border/70">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-xs py-3.5 px-4">Date & Day</TableHead>
                <TableHead className="font-semibold text-xs py-3.5 px-3">Check In</TableHead>
                <TableHead className="font-semibold text-xs py-3.5 px-3">Check Out</TableHead>
                <TableHead className="font-semibold text-xs py-3.5 px-3 text-center">Duration</TableHead>
                <TableHead className="font-semibold text-xs py-3.5 px-3">Policy Flags</TableHead>
                <TableHead className="font-semibold text-xs py-3.5 px-3">Approved Leave / Grace</TableHead>
                <TableHead className="font-semibold text-xs py-3.5 px-4 text-center">
                  Special Case (Late Waived)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/40">
              {loadingData ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RotateCw className="size-6 text-primary animate-spin" />
                      <p className="text-xs text-muted-foreground font-medium">
                        Loading employee logs and attendance history...
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
                        No attendance entries found for this period
                      </p>
                      <p className="text-[11px] text-muted-foreground/80 max-w-sm">
                        Try adjusting the date filters or selecting another employee.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDays.map((item) => {
                  const att = item.attendance;
                  const isSunday = item.isSunday;
                  const hasPunch = !!att?.punchIn;
                  const isWaived = !!att?.isLateSpecialCase;
                  const isLate = !!att?.isLate;
                  const isHalfDay = !!att?.isHalfDay;

                  return (
                    <TableRow
                      key={item.dateStr}
                      className={cn(
                        "group hover:bg-muted/30 transition-colors",
                        isSunday && "bg-muted/10 opacity-70",
                        isWaived && "bg-emerald-500/5 dark:bg-emerald-950/20"
                      )}
                    >
                      {/* Date & Day */}
                      <TableCell className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-xs font-bold",
                              isSunday ? "text-muted-foreground" : "text-foreground"
                            )}
                          >
                            {item.dateStr}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] px-1.5 py-0 uppercase font-semibold rounded-xs",
                              isSunday
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

                      {/* Check In */}
                      <TableCell className="py-3 px-3">
                        {hasPunch ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "font-mono text-xs font-semibold",
                                  isWaived && "text-emerald-600 dark:text-emerald-400 font-bold",
                                  !isWaived && isLate && "text-rose-600 font-bold",
                                  !isWaived && isHalfDay && "text-purple-600 font-bold",
                                  !isLate && !isHalfDay && "text-foreground"
                                )}
                              >
                                {formatTimeStr(att!.punchIn)}
                                {isWaived && "*"}
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground font-medium">
                              {format(new Date(att!.punchIn), "MMM dd")}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">—</span>
                        )}
                      </TableCell>

                      {/* Check Out */}
                      <TableCell className="py-3 px-3">
                        {att?.punchOut ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-semibold text-foreground">
                                {formatTimeStr(att.punchOut)}
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground font-medium">
                              {format(new Date(att.punchOut), "MMM dd")}
                            </div>
                          </div>
                        ) : hasPunch ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>In Progress</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">—</span>
                        )}
                      </TableCell>

                      {/* Duration */}
                      <TableCell className="py-3 px-3 text-center">
                        {att?.totalHours ? (
                          <Badge
                            variant="secondary"
                            className={cn(
                              "font-mono text-xs font-semibold px-2 py-0.5 rounded-md",
                              isHalfDay
                                ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                                : att.totalHours >= 8
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {att.totalHours}h
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs font-mono">—</span>
                        )}
                      </TableCell>

                      {/* Policy Flags */}
                      <TableCell className="py-3 px-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {isWaived && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] gap-1 px-1.5 py-0 rounded-xs">
                              <Sparkles className="size-3" />
                              Waived *
                            </Badge>
                          )}

                          {!isWaived && isLate && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 rounded-xs">
                              Late Mark
                            </Badge>
                          )}

                          {isHalfDay && (
                            <Badge className="bg-purple-500/10 text-purple-600 border border-purple-500/20 text-[10px] px-1.5 py-0 rounded-xs">
                              Technical HL
                            </Badge>
                          )}

                          {hasPunch && !isLate && !isHalfDay && !isWaived && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] text-muted-foreground px-1.5 py-0 rounded-xs"
                            >
                              On Time
                            </Badge>
                          )}

                          {!hasPunch && isSunday && (
                            <span className="text-[10px] text-muted-foreground">Weekend</span>
                          )}

                          {!hasPunch && !isSunday && !item.leave && (
                            <span className="text-[10px] text-muted-foreground/50">No punch</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Approved Leave / Grace */}
                      <TableCell className="py-3 px-3">
                        {item.leave ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1.5 py-0 font-medium rounded-xs",
                              item.leave.category === "UNPAID"
                                ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                            )}
                          >
                            {item.leave.duration === "SHORT"
                              ? `Short Leave (${item.leave.startTime}-${item.leave.endTime})`
                              : item.leave.duration === "HALF"
                              ? `Half Day (${item.leave.halfDayType || "HL"})`
                              : "Full Day Leave"}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/40 text-[10px]">—</span>
                        )}
                      </TableCell>

                      {/* Special Case Switch */}
                      <TableCell className="py-3 px-4 text-center">
                        {att ? (
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={isWaived}
                              onCheckedChange={() => handleToggleDay(att.id, isWaived, item.dateStr)}
                              disabled={isPending}
                              className="cursor-pointer data-[state=checked]:bg-emerald-600"
                            />
                            <span
                              className={cn(
                                "text-[10px] font-semibold w-14 text-left",
                                isWaived ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/60"
                              )}
                            >
                              {isWaived ? "Waived" : "Standard"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/30 text-[10px]">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
