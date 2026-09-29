"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { format } from "date-fns";
import {
  CalendarCheck,
  Plus,
  Search,
  RotateCw,
  Edit3,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Zap,
  Sun,
  Sunset,
  Calendar,
  Layers,
  Timer,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MonthFilter } from "@/components/features/accountant/month-filter";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  developerCreateLeave,
  developerUpdateLeaveDuration,
  fetchRecentLeaves,
  developerDeleteLeave,
} from "@/actions/leave/developer";
import { toast } from "sonner";

type FilterTab = "ALL" | "FULL" | "HALF" | "SHORT" | "POLICY_1" | "POLICY_2" | "UNPAID";

interface UserOption {
  id: string;
  name: string | null;
  email: string | null;
  employeeCode: string | null;
  designation?: string | null;
  avatarUrl?: string | null;
  department?: { name: string } | null;
}

function LeaveAdjustmentClientContent({ users }: { users: UserOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const monthParam = searchParams.get("m");
  const yearParam = searchParams.get("y");

  const selectedMonth = useMemo(() => (monthParam ? parseInt(monthParam, 10) : new Date().getMonth() + 1), [monthParam]);
  const selectedYear = useMemo(() => (yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()), [yearParam]);

  const monthDate = useMemo(() => {
    return new Date(selectedYear, selectedMonth - 1, 1);
  }, [selectedYear, selectedMonth]);

  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [cUser, setCUser] = useState("");
  const [cStart, setCStart] = useState("");
  const [cEnd, setCEnd] = useState("");
  const [cCategory, setCCategory] = useState("MONTHLY_POLICY_1");
  const [cDuration, setCDuration] = useState("FULL");
  const [cType, setCType] = useState("CASUAL");
  const [cHalf, setCHalf] = useState("FIRST_HALF");
  const [cStartT, setCStartT] = useState("");
  const [cEndT, setCEndT] = useState("");
  const [cReason, setCReason] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [uDuration, setUDuration] = useState("FULL");
  const [uHalf, setUHalf] = useState("FIRST_HALF");
  const [uStartT, setUStartT] = useState("");
  const [uEndT, setUEndT] = useState("");
  const [uReason, setUReason] = useState("");
  const [updating, setUpdating] = useState(false);

  // Delete Modal State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [leaveToDelete, setLeaveToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const loadLeaves = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetchRecentLeaves(selectedMonth, selectedYear);
      if (res.success && res.leaves) {
        setLeaves(res.leaves);
      } else {
        toast.error(res.error || "Failed to load leave records");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load leave records");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    loadLeaves(true);
  }, [loadLeaves]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadLeaves(false);
  };

  // Quick Preset for Create Modal
  const applyCreatePreset = (preset: "TODAY_FULL" | "TOMORROW_FULL" | "TODAY_HALF_AM" | "TODAY_HALF_PM" | "TODAY_SHORT") => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = format(tomorrow, "yyyy-MM-dd");

    if (preset === "TODAY_FULL") {
      setCStart(todayStr);
      setCEnd(todayStr);
      setCDuration("FULL");
    } else if (preset === "TOMORROW_FULL") {
      setCStart(tomorrowStr);
      setCEnd(tomorrowStr);
      setCDuration("FULL");
    } else if (preset === "TODAY_HALF_AM") {
      setCStart(todayStr);
      setCEnd(todayStr);
      setCDuration("HALF");
      setCHalf("FIRST_HALF");
    } else if (preset === "TODAY_HALF_PM") {
      setCStart(todayStr);
      setCEnd(todayStr);
      setCDuration("HALF");
      setCHalf("SECOND_HALF");
    } else if (preset === "TODAY_SHORT") {
      setCStart(todayStr);
      setCEnd(todayStr);
      setCDuration("SHORT");
      setCStartT("10:00");
      setCEndT("11:30");
    }
  };

  const handleOpenCreate = () => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    setCUser(users[0]?.id || "");
    setCStart(todayStr);
    setCEnd(todayStr);
    setCCategory("MONTHLY_POLICY_1");
    setCDuration("FULL");
    setCType("CASUAL");
    setCHalf("FIRST_HALF");
    setCStartT("");
    setCEndT("");
    setCReason("Administrative leave override");
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cUser || !cStart || !cEnd) {
      toast.error("Please fill required fields.");
      return;
    }

    setCreating(true);
    try {
      const result = await developerCreateLeave({
        userId: cUser,
        startDate: cStart,
        endDate: cEnd,
        category: cCategory,
        duration: cDuration,
        leaveType: cType,
        halfDayType: cHalf,
        startTime: cStartT,
        endTime: cEndT,
        reason: cReason || "Administrative Leave Adjustment"
      });

      if (result.success) {
        toast.success("Leave adjustment applied and auto-approved.");
        setIsCreateOpen(false);
        loadLeaves(false);
      } else {
        toast.error(result.error || "Failed to create leave adjustment.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEdit = (leave: any) => {
    setSelectedLeave(leave);
    setUDuration(leave.duration);
    setUHalf(leave.halfDayType || "FIRST_HALF");
    setUStartT(leave.startTime || "");
    setUEndT(leave.endTime || "");
    setUReason("");
    setIsEditOpen(true);
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeave) return;

    setUpdating(true);
    try {
      const result = await developerUpdateLeaveDuration({
        leaveId: selectedLeave.id,
        newDuration: uDuration,
        newHalfDayType: uHalf,
        newStartTime: uStartT,
        newEndTime: uEndT,
        reason: uReason || "Developer duration adjustment"
      });

      if (result.success) {
        toast.success("Leave record and balances updated successfully.");
        setIsEditOpen(false);
        loadLeaves(false);
      } else {
        toast.error(result.error || "Failed to update leave.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setUpdating(false);
    }
  };

  const handleOpenDelete = (leave: any) => {
    setLeaveToDelete(leave);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!leaveToDelete) return;
    setDeleting(true);
    try {
      const result = await developerDeleteLeave(leaveToDelete.id);
      if (result.success) {
        toast.success("Leave record removed & balance restored.");
        setIsDeleteOpen(false);
        if (isEditOpen && selectedLeave?.id === leaveToDelete.id) {
          setIsEditOpen(false);
        }
        setLeaveToDelete(null);
        loadLeaves(false);
      } else {
        toast.error(result.error || "Failed to delete leave record.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred during deletion");
    } finally {
      setDeleting(false);
    }
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const total = leaves.length;
    const fullCount = leaves.filter((l) => l.duration === "FULL").length;
    const halfCount = leaves.filter((l) => l.duration === "HALF").length;
    const shortCount = leaves.filter((l) => l.duration === "SHORT").length;
    const unpaidCount = leaves.filter((l) => l.category === "UNPAID").length;
    const policy1Count = leaves.filter((l) => l.category === "MONTHLY_POLICY_1").length;
    const policy2Count = leaves.filter((l) => l.category === "SEMI_ANNUAL_POLICY_2").length;

    return {
      total,
      fullCount,
      halfCount,
      shortCount,
      unpaidCount,
      policy1Count,
      policy2Count,
    };
  }, [leaves]);

  // Filtered Leaves
  const filteredLeaves = useMemo(() => {
    return leaves.filter((leave) => {
      // Tab filter
      if (activeTab === "FULL" && leave.duration !== "FULL") return false;
      if (activeTab === "HALF" && leave.duration !== "HALF") return false;
      if (activeTab === "SHORT" && leave.duration !== "SHORT") return false;
      if (activeTab === "POLICY_1" && leave.category !== "MONTHLY_POLICY_1") return false;
      if (activeTab === "POLICY_2" && leave.category !== "SEMI_ANNUAL_POLICY_2") return false;
      if (activeTab === "UNPAID" && leave.category !== "UNPAID") return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = leave.user?.name?.toLowerCase() || "";
        const email = leave.user?.email?.toLowerCase() || "";
        const code = leave.user?.employeeCode?.toLowerCase() || "";
        const dept = leave.user?.department?.name?.toLowerCase() || "";
        const reason = leave.reason?.toLowerCase() || "";
        return name.includes(q) || email.includes(q) || code.includes(q) || dept.includes(q) || reason.includes(q);
      }

      return true;
    });
  }, [leaves, activeTab, searchQuery]);

  return (
    <div className="space-y-4">
      {/* ── Executive Header Banner ── */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="size-8 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <CalendarCheck className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 sm:mb-1 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none">
                Leave Adjustments
              </h1>
              <Badge variant="outline" className="text-[9px] sm:text-[10px] uppercase font-bold text-primary bg-primary/10 border-primary/20 px-1.5 sm:px-2 py-0.5 rounded-sm">
                Developer Suite
              </Badge>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1 sm:line-clamp-none">
              Manual override console for {format(monthDate, "MMMM yyyy")} leave requests, categories, durations, and balance reconciliation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="shrink-0">
            <MonthFilter baseUrl="/dashboard/admin/developer/leave-adjustment" />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="h-9 px-3 text-xs font-semibold gap-1.5 cursor-pointer hover:bg-muted/80 rounded-md"
            title="Refresh records"
          >
            <RotateCw className={cn("size-3.5", refreshing && "animate-spin text-primary")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button onClick={handleOpenCreate} size="sm" className="h-9 px-3.5 text-xs font-semibold gap-2 shadow-xs cursor-pointer rounded-md">
            <Plus className="size-4" />
            <span>Create Leave Override</span>
          </Button>
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Recorded Adjustments</span>
            <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground tracking-tight">{stats.total}</span>
            <span className="text-[11px] text-muted-foreground">total logs</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-block size-2 rounded-full bg-primary" />
            <span>{stats.policy1Count} Policy 1 / {stats.policy2Count} Policy 2</span>
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Full Day Leaves</span>
            <div className="size-8 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground tracking-tight">{stats.fullCount}</span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">approved</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            <span>Standard 1.0 day balance deduction</span>
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Half & Short Leaves</span>
            <div className="size-8 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Sun className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground tracking-tight">{stats.halfCount + stats.shortCount}</span>
            <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">partial entries</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            <span>{stats.halfCount} Half Day / {stats.shortCount} Short Perm</span>
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Unpaid (LOP) Leaves</span>
            <div className="size-8 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground tracking-tight">{stats.unpaidCount}</span>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">loss of pay</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            <span>Tracked for payroll deductions</span>
          </div>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-md border border-border/80 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by employee, email, code, department, reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-background/80 border-border/70 focus:bg-background rounded-md"
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

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <Button
            variant={activeTab === "ALL" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("ALL")}
            className="h-8 text-xs font-medium rounded-md px-2.5 cursor-pointer"
          >
            All ({leaves.length})
          </Button>
          <Button
            variant={activeTab === "FULL" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("FULL")}
            className="h-8 text-xs font-medium rounded-md px-2.5 text-emerald-600 dark:text-emerald-400 cursor-pointer"
          >
            Full Day ({stats.fullCount})
          </Button>
          <Button
            variant={activeTab === "HALF" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("HALF")}
            className="h-8 text-xs font-medium rounded-md px-2.5 text-purple-600 dark:text-purple-400 cursor-pointer"
          >
            Half Day ({stats.halfCount})
          </Button>
          <Button
            variant={activeTab === "SHORT" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("SHORT")}
            className="h-8 text-xs font-medium rounded-md px-2.5 text-sky-600 dark:text-sky-400 cursor-pointer"
          >
            Short Perm ({stats.shortCount})
          </Button>
          <Button
            variant={activeTab === "POLICY_1" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("POLICY_1")}
            className="h-8 text-xs font-medium rounded-md px-2.5 text-indigo-600 dark:text-indigo-400 cursor-pointer"
          >
            Policy 1 ({stats.policy1Count})
          </Button>
          <Button
            variant={activeTab === "UNPAID" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("UNPAID")}
            className="h-8 text-xs font-medium rounded-md px-2.5 text-amber-600 dark:text-amber-400 cursor-pointer"
          >
            Unpaid ({stats.unpaidCount})
          </Button>
        </div>
      </div>

      {/* ── Main Leaves Table ── */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40 border-b border-border/70">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-xs py-3.5">Employee</TableHead>
                <TableHead className="font-semibold text-xs py-3.5">Date Range</TableHead>
                <TableHead className="font-semibold text-xs py-3.5">Category / Type</TableHead>
                <TableHead className="font-semibold text-xs py-3.5">Duration</TableHead>
                <TableHead className="font-semibold text-xs py-3.5">Reason / System Notes</TableHead>
                <TableHead className="font-semibold text-xs py-3.5 text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RotateCw className="size-6 text-primary animate-spin" />
                      <p className="text-xs text-muted-foreground font-medium">Loading leave records...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredLeaves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center">
                      <div className="size-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mb-3">
                        <Calendar className="size-6" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">No leave records found</h3>
                      <p className="text-xs text-muted-foreground mt-1 mb-4">
                        {searchQuery || activeTab !== "ALL"
                          ? "No records matched your search or active filter tab."
                          : `No leave adjustments exist for ${format(monthDate, "MMMM yyyy")}.`}
                      </p>
                      <Button onClick={handleOpenCreate} size="sm" variant="outline" className="gap-2 text-xs cursor-pointer">
                        <Plus className="size-3.5" />
                        Create Leave Override
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeaves.map((leave) => {
                  const startStr = format(new Date(leave.startDate), "MMM dd, yyyy");
                  const endStr = format(new Date(leave.endDate), "MMM dd, yyyy");
                  const isSingleDay = startStr === endStr;

                  return (
                    <TableRow key={leave.id} className="group hover:bg-muted/30 transition-colors">
                      {/* Employee Info */}
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9 border border-border/80 shrink-0">
                            <AvatarImage src={leave.user?.avatarUrl || undefined} alt={leave.user?.name || "User"} />
                            <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">
                              {leave.user?.name?.slice(0, 2).toUpperCase() || "EM"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs text-foreground tracking-tight truncate">
                                {leave.user?.name || "Unnamed"}
                              </span>
                              {leave.user?.employeeCode && (
                                <span className="text-[10px] font-mono font-medium text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                                  {leave.user.employeeCode}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 truncate">
                              <span>{leave.user?.email}</span>
                              {leave.user?.department?.name && (
                                <>
                                  <span>•</span>
                                  <span className="text-foreground/80 font-medium">{leave.user.department.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Date Range */}
                      <TableCell className="py-3">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-xs text-foreground">
                            {isSingleDay ? startStr : `${startStr} – ${endStr}`}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Applied: {format(new Date(leave.createdAt), "MMM dd, yyyy")}
                          </div>
                        </div>
                      </TableCell>

                      {/* Category & Type */}
                      <TableCell className="py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {leave.category === "MONTHLY_POLICY_1" && (
                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25">
                              Policy 1 {leave.leaveType ? `(${leave.leaveType})` : ""}
                            </Badge>
                          )}
                          {leave.category === "SEMI_ANNUAL_POLICY_2" && (
                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/25">
                              Policy 2 (Semi-Annual)
                            </Badge>
                          )}
                          {leave.category === "UNPAID" && (
                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25">
                              Unpaid (LOP)
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Duration */}
                      <TableCell className="py-3">
                        {leave.duration === "FULL" && (
                          <Badge variant="secondary" className="font-mono text-xs font-semibold px-2 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                            Full Day (1.0d)
                          </Badge>
                        )}
                        {leave.duration === "HALF" && (
                          <Badge variant="secondary" className="font-mono text-xs font-semibold px-2 py-0.5 bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                            {leave.halfDayType === "FIRST_HALF" ? "First Half (0.5d)" : "Second Half (0.5d)"}
                          </Badge>
                        )}
                        {leave.duration === "SHORT" && (
                          <Badge variant="secondary" className="font-mono text-xs font-semibold px-2 py-0.5 bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                            Short {leave.startTime && leave.endTime ? `(${leave.startTime} - ${leave.endTime})` : "Perm"}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Reason & Audit Note */}
                      <TableCell className="py-3">
                        <div className="space-y-0.5 max-w-xs">
                          <div className="text-xs text-foreground font-medium truncate" title={leave.reason}>
                            {leave.reason || "No reason provided"}
                          </div>
                          {leave.systemNote && (
                            <div className="text-[10px] text-muted-foreground font-mono truncate" title={leave.systemNote}>
                              {leave.systemNote}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3 text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenEdit(leave)}
                                  className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                                >
                                  <Edit3 className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Adjust leave duration & balances</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenDelete(leave)}
                                  className="size-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Revoke & delete leave record</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Create Leave Override Dialog ── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card">
          <div className="shrink-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-4 border-b border-border/80">
            <DialogHeader className="gap-1">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                  <Plus className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                    Create Leave Override
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Directly grant an approved leave bypassing backdated lockouts & auto-deducting balances
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4.5 overscroll-contain">
            {/* Employee Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Select Target Employee</Label>
              <Select value={cUser} onValueChange={setCUser}>
                <SelectTrigger className="h-10 text-xs rounded-xl bg-background border-border/80">
                  <SelectValue placeholder="Choose employee..." />
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-xl">
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs py-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-5">
                          <AvatarImage src={u.avatarUrl || undefined} />
                          <AvatarFallback className="text-[9px]">{u.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-foreground">{u.name}</span>
                        <span className="text-muted-foreground font-mono text-[11px]">
                          ({u.employeeCode || u.email})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick Shift / Date Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Zap className="size-3.5 text-amber-500" />
                  Quick Presets
                </Label>
                <span className="text-[10px] text-muted-foreground">Auto-configures dates & duration</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyCreatePreset("TODAY_FULL")}
                  className="h-8 text-[11px] font-medium rounded-lg justify-start gap-1.5 hover:bg-primary/5 hover:border-primary/30 cursor-pointer"
                >
                  <Sparkles className="size-3 text-primary shrink-0" />
                  <span>Today (Full Day)</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyCreatePreset("TOMORROW_FULL")}
                  className="h-8 text-[11px] font-medium rounded-lg justify-start gap-1.5 hover:bg-primary/5 hover:border-primary/30 cursor-pointer"
                >
                  <Sparkles className="size-3 text-primary shrink-0" />
                  <span>Tomorrow (Full)</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyCreatePreset("TODAY_HALF_AM")}
                  className="h-8 text-[11px] font-medium rounded-lg justify-start gap-1.5 bg-purple-500/5 border-purple-500/25 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 cursor-pointer"
                >
                  <Sun className="size-3 text-purple-500 shrink-0" />
                  <span>Today (First Half)</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyCreatePreset("TODAY_HALF_PM")}
                  className="h-8 text-[11px] font-medium rounded-lg justify-start gap-1.5 bg-purple-500/5 border-purple-500/25 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 cursor-pointer"
                >
                  <Sunset className="size-3 text-purple-500 shrink-0" />
                  <span>Today (Second Half)</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyCreatePreset("TODAY_SHORT")}
                  className="h-8 text-[11px] font-medium rounded-lg justify-start gap-1.5 bg-sky-500/5 border-sky-500/25 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 cursor-pointer"
                >
                  <Timer className="size-3 text-sky-500 shrink-0" />
                  <span>Short Leave (Today)</span>
                </Button>
              </div>
            </div>

            {/* Policy Category & Leave Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/20">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Leave Category</Label>
                <Select value={cCategory} onValueChange={setCCategory}>
                  <SelectTrigger className="h-9 text-xs rounded-lg bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="MONTHLY_POLICY_1">Monthly Policy 1</SelectItem>
                    <SelectItem value="SEMI_ANNUAL_POLICY_2">Semi Annual Policy 2</SelectItem>
                    <SelectItem value="UNPAID">Unpaid (Loss of Pay)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {cCategory === "MONTHLY_POLICY_1" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Policy 1 Type</Label>
                  <Select value={cType} onValueChange={setCType}>
                    <SelectTrigger className="h-9 text-xs rounded-lg bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="CASUAL">Casual Leave</SelectItem>
                      <SelectItem value="MEDICAL">Medical Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Category Info</Label>
                  <div className="h-9 px-3 text-xs flex items-center bg-background/50 border border-border/70 rounded-lg text-muted-foreground">
                    {cCategory === "UNPAID" ? "Treated as Loss of Pay" : "Deducted from Semi-Annual pool"}
                  </div>
                </div>
              )}
            </div>

            {/* Date Range & Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/20">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Start Date</Label>
                <Input
                  type="date"
                  value={cStart}
                  onChange={(e) => setCStart(e.target.value)}
                  className="h-9 text-xs rounded-lg bg-background font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">End Date</Label>
                <Input
                  type="date"
                  value={cEnd}
                  onChange={(e) => setCEnd(e.target.value)}
                  className="h-9 text-xs rounded-lg bg-background font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Duration</Label>
                <Select value={cDuration} onValueChange={setCDuration}>
                  <SelectTrigger className="h-9 text-xs rounded-lg bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="FULL">Full Day</SelectItem>
                    <SelectItem value="HALF">Half Day</SelectItem>
                    <SelectItem value="SHORT">Short Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sub Duration Settings */}
              {cDuration === "HALF" && (
                <div className="col-span-full space-y-1.5 pt-1">
                  <Label className="text-xs font-semibold text-foreground">Half Day Timing Slot</Label>
                  <Select value={cHalf} onValueChange={setCHalf}>
                    <SelectTrigger className="h-9 text-xs rounded-lg bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="FIRST_HALF">First Half (Morning to Midday)</SelectItem>
                      <SelectItem value="SECOND_HALF">Second Half (Midday to Evening)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {cDuration === "SHORT" && (
                <div className="col-span-full grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Start Time</Label>
                    <Input
                      type="time"
                      value={cStartT}
                      onChange={(e) => setCStartT(e.target.value)}
                      className="h-9 text-xs font-mono rounded-lg bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">End Time</Label>
                    <Input
                      type="time"
                      value={cEndT}
                      onChange={(e) => setCEndT(e.target.value)}
                      className="h-9 text-xs font-mono rounded-lg bg-background"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Reason & Audit Note */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Reason / Administrative Audit Note</Label>
              <Input
                value={cReason}
                onChange={(e) => setCReason(e.target.value)}
                placeholder="e.g. Backdated emergency bypass or medical adjustment"
                className="h-9 text-xs rounded-lg bg-background"
              />
            </div>
          </div>

          {/* Sticky Dialog Action Bar */}
          <div className="shrink-0 px-5 py-3.5 bg-muted/40 border-t border-border/80 flex items-center justify-end gap-2.5 w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
              disabled={creating}
              className="h-9 px-4 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateSubmit}
              disabled={creating}
              className="h-9 px-5 text-xs font-semibold gap-2 shadow-xs cursor-pointer"
            >
              {creating && <RotateCw className="size-3.5 animate-spin" />}
              <span>Create Leave Override</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Leave Duration Dialog ── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card">
          <div className="shrink-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-4 border-b border-border/80">
            <DialogHeader className="gap-1">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                  <Edit3 className="size-4.5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                    Update Leave Duration
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Modifying duration automatically recalculates & restores leave balances
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4.5 overscroll-contain">
            {/* Record Summary */}
            {selectedLeave && (
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/70 space-y-2 text-xs">
                <div className="flex items-center gap-3">
                  <Avatar className="size-9 border border-border">
                    <AvatarImage src={selectedLeave.user?.avatarUrl || undefined} />
                    <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                      {selectedLeave.user?.name?.slice(0, 2).toUpperCase() || "EM"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-foreground truncate">{selectedLeave.user?.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {selectedLeave.user?.email} • {selectedLeave.user?.employeeCode || "ID N/A"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-[11px]">
                  <div>
                    <span className="text-muted-foreground">Start: </span>
                    <span className="font-medium text-foreground">{format(new Date(selectedLeave.startDate), "MMM dd, yyyy")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">End: </span>
                    <span className="font-medium text-foreground">{format(new Date(selectedLeave.endDate), "MMM dd, yyyy")}</span>
                  </div>
                </div>
              </div>
            )}

            {/* New Duration Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Select New Duration</Label>
              <Select value={uDuration} onValueChange={setUDuration}>
                <SelectTrigger className="h-10 text-xs rounded-xl bg-background border-border/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="FULL">Full Day (1.0 Day)</SelectItem>
                  <SelectItem value="HALF">Half Day (0.5 Day)</SelectItem>
                  <SelectItem value="SHORT">Short Leave (Time Specific)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {uDuration === "HALF" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Half Day Type</Label>
                <Select value={uHalf} onValueChange={setUHalf}>
                  <SelectTrigger className="h-9 text-xs rounded-lg bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="FIRST_HALF">First Half</SelectItem>
                    <SelectItem value="SECOND_HALF">Second Half</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {uDuration === "SHORT" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Start Time</Label>
                  <Input
                    type="time"
                    value={uStartT}
                    onChange={(e) => setUStartT(e.target.value)}
                    className="h-9 text-xs font-mono rounded-lg bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">End Time</Label>
                  <Input
                    type="time"
                    value={uEndT}
                    onChange={(e) => setUEndT(e.target.value)}
                    className="h-9 text-xs font-mono rounded-lg bg-background"
                  />
                </div>
              </div>
            )}

            {/* Audit Note */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Audit Reason / Note</Label>
              <Input
                value={uReason}
                onChange={(e) => setUReason(e.target.value)}
                placeholder="e.g. Changed Half Day to Full Day per manager request"
                className="h-9 text-xs rounded-lg bg-background"
              />
            </div>
          </div>

          {/* Sticky Action Bar */}
          <div className="shrink-0 px-5 py-3.5 bg-muted/40 border-t border-border/80 flex items-center justify-between gap-3 w-full">
            <div>
              {selectedLeave && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenDelete(selectedLeave)}
                  className="gap-1.5 h-9 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                  disabled={updating}
                >
                  <Trash2 className="size-3.5" />
                  <span>Delete Record</span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(false)}
                disabled={updating}
                className="h-9 px-4 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleUpdateSubmit}
                disabled={updating}
                className="h-9 px-5 text-xs font-semibold gap-2 shadow-xs cursor-pointer"
              >
                {updating && <RotateCw className="size-3.5 animate-spin" />}
                <span>Update Duration</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card">
          <div className="p-5 border-b border-border/80 bg-destructive/5">
            <DialogHeader className="gap-1">
              <div className="flex items-center gap-2.5 text-destructive mb-0.5">
                <div className="size-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="size-4.5 text-destructive" />
                </div>
                <DialogTitle className="text-base font-bold text-foreground">Revoke & Delete Leave</DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Permanently deletes this leave record and automatically restores the deducted leave days to the employee&apos;s balance.
              </DialogDescription>
            </DialogHeader>
          </div>

          {leaveToDelete && (
            <div className="p-5 space-y-2 text-xs">
              <div className="p-3.5 rounded-xl border border-border/80 bg-muted/40 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Employee:</span>
                  <span className="font-bold text-foreground">{leaveToDelete.user?.name || leaveToDelete.user?.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Dates:</span>
                  <span className="font-medium text-foreground">
                    {format(new Date(leaveToDelete.startDate), "MMM dd, yyyy")} – {format(new Date(leaveToDelete.endDate), "MMM dd, yyyy")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Category:</span>
                  <span className="font-medium text-foreground">{leaveToDelete.category}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-semibold text-foreground">{leaveToDelete.duration}</span>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 sm:px-5 sm:py-3.5 bg-muted/40 border-t border-border/80 flex items-center justify-end gap-2.5 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteOpen(false)}
              disabled={deleting}
              className="h-9 px-4 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="h-9 px-4 text-xs font-semibold gap-2 cursor-pointer shadow-xs"
            >
              {deleting ? <RotateCw className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              <span>Revoke & Restore Balance</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function LeaveAdjustmentClient({ users }: { users: UserOption[] }) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center p-16 gap-3">
          <RotateCw className="animate-spin size-8 text-primary" />
          <p className="text-xs text-muted-foreground font-medium">Loading Leave Adjuster...</p>
        </div>
      }
    >
      <LeaveAdjustmentClientContent users={users} />
    </Suspense>
  );
}

