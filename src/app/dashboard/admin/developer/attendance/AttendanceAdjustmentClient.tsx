"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { format, differenceInMinutes } from "date-fns";
import {
  ShieldCheck,
  Clock,
  Plus,
  Search,
  RotateCw,
  Edit3,
  Trash2,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Sparkles,
  Zap,
  Timer,
  Compass,
  UserCheck,
  Sun,
  Sunset,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DateFilter } from "@/components/features/accountant/date-filter";
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
  DialogFooter,
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import {
  getAttendancesForAdjustment,
  adjustAttendanceAction,
  createAttendanceAction,
  deleteAttendanceAction,
  getUsersForAdjustment,
} from "@/actions/developer";
import { toast } from "sonner";

type FilterTab = "ALL" | "ON_TIME" | "LATE" | "HALF_DAY" | "SPECIAL_CASE" | "OUTSIDE_OFFICE" | "AUTO_LOGOUT";

function calculateDuration(punchIn?: string | Date | null, punchOut?: string | Date | null) {
  if (!punchIn) return null;
  const inDate = new Date(punchIn);
  const outDate = punchOut ? new Date(punchOut) : new Date();
  const diffMins = differenceInMinutes(outDate, inDate);
  if (diffMins < 0) return null;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return { hours, mins, totalMinutes: diffMins, isOngoing: !punchOut };
}

function AttendanceAdjustmentClientContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("d");
  const currentDateStr = dateParam || format(new Date(), "yyyy-MM-dd");
  const currentDate = useMemo(() => new Date(currentDateStr), [currentDateStr]);

  const [attendances, setAttendances] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");

  // Dialog State
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  // Delete Confirmation State
  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [punchInStr, setPunchInStr] = useState("");
  const [punchOutStr, setPunchOutStr] = useState("");
  const [isLate, setIsLate] = useState(false);
  const [isLateSpecialCase, setIsLateSpecialCase] = useState(false);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [isOutsideOffice, setIsOutsideOffice] = useState(false);
  const [isAutoPunchOut, setIsAutoPunchOut] = useState(false);
  const [punchInLatStr, setPunchInLatStr] = useState("");
  const [punchInLngStr, setPunchInLngStr] = useState("");
  const [punchOutLatStr, setPunchOutLatStr] = useState("");
  const [punchOutLngStr, setPunchOutLngStr] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAttendances = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await getAttendancesForAdjustment(currentDate);
      if (res.success && res.attendances) {
        setAttendances(res.attendances);
      } else {
        toast.error(res.error || "Failed to fetch attendances");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error while loading data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentDate]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await getUsersForAdjustment();
      if (res.success && res.users) {
        setUsers(res.users);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  }, []);

  useEffect(() => {
    fetchAttendances(true);
    fetchUsers();
  }, [fetchAttendances, fetchUsers]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAttendances(false);
  };

  // Selected User Object for Create Mode
  const currentSelectedUser = useMemo(() => {
    if (!isCreateMode && selectedRecord?.user) return selectedRecord.user;
    return users.find((u) => u.id === selectedUserId) || null;
  }, [isCreateMode, selectedRecord, selectedUserId, users]);

  // Form Computed Duration
  const formDuration = useMemo(() => {
    if (!punchInStr) return null;
    return calculateDuration(punchInStr, punchOutStr || null);
  }, [punchInStr, punchOutStr]);

  // Quick Preset Handlers
  const applyPreset = (preset: "STANDARD" | "EARLY" | "LATE" | "HALF_MORNING" | "HALF_AFTERNOON") => {
    const baseDate = currentDateStr;
    if (preset === "STANDARD") {
      setPunchInStr(`${baseDate}T09:30`);
      setPunchOutStr(`${baseDate}T18:00`);
      setIsLate(false);
      setIsLateSpecialCase(false);
      setIsHalfDay(false);
      setIsAutoPunchOut(false);
    } else if (preset === "EARLY") {
      setPunchInStr(`${baseDate}T09:00`);
      setPunchOutStr(`${baseDate}T18:00`);
      setIsLate(false);
      setIsLateSpecialCase(false);
      setIsHalfDay(false);
      setIsAutoPunchOut(false);
    } else if (preset === "LATE") {
      setPunchInStr(`${baseDate}T10:15`);
      setPunchOutStr(`${baseDate}T19:15`);
      setIsLate(true);
      setIsLateSpecialCase(false);
      setIsHalfDay(false);
      setIsAutoPunchOut(false);
    } else if (preset === "HALF_MORNING") {
      setPunchInStr(`${baseDate}T09:30`);
      setPunchOutStr(`${baseDate}T14:00`);
      setIsLate(false);
      setIsLateSpecialCase(false);
      setIsHalfDay(true);
      setIsAutoPunchOut(false);
    } else if (preset === "HALF_AFTERNOON") {
      setPunchInStr(`${baseDate}T14:00`);
      setPunchOutStr(`${baseDate}T18:30`);
      setIsLate(false);
      setIsLateSpecialCase(false);
      setIsHalfDay(true);
      setIsAutoPunchOut(false);
    }
  };

  const handleCopyOfficeCoordinates = () => {
    if (!currentSelectedUser?.location) {
      toast.info("No primary office location found for this user.");
      return;
    }
    const { lat, lng } = currentSelectedUser.location;
    if (lat !== undefined && lat !== null) {
      setPunchInLatStr(lat.toString());
      setPunchOutLatStr(lat.toString());
    }
    if (lng !== undefined && lng !== null) {
      setPunchInLngStr(lng.toString());
      setPunchOutLngStr(lng.toString());
    }
    setIsOutsideOffice(false);
    toast.success(`Applied ${currentSelectedUser.location.name || "Office"} GPS coordinates`);
  };

  const handleEditClick = (record: any) => {
    setIsCreateMode(false);
    setSelectedRecord(record);
    setSelectedUserId(record.userId);

    // Format dates to datetime-local strings
    setPunchInStr(record.punchIn ? format(new Date(record.punchIn), "yyyy-MM-dd'T'HH:mm") : "");
    setPunchOutStr(record.punchOut ? format(new Date(record.punchOut), "yyyy-MM-dd'T'HH:mm") : "");

    setIsLate(record.isLate || false);
    setIsLateSpecialCase(record.isLateSpecialCase || false);
    setIsHalfDay(record.isHalfDay || false);
    setIsOutsideOffice(record.isOutsideOffice || false);
    setIsAutoPunchOut(record.isAutoPunchOut || false);

    const defaultLat = record.user?.location?.lat?.toString() || "";
    const defaultLng = record.user?.location?.lng?.toString() || "";

    setPunchInLatStr(record.punchInLat?.toString() || defaultLat);
    setPunchInLngStr(record.punchInLng?.toString() || defaultLng);
    setPunchOutLatStr(record.punchOutLat?.toString() || defaultLat);
    setPunchOutLngStr(record.punchOutLng?.toString() || defaultLng);
    setIsDialogOpen(true);
  };

  const handleCreateClick = () => {
    setIsCreateMode(true);
    setSelectedRecord(null);
    setSelectedUserId(users[0]?.id || "");

    // Default punch in to current date at 09:30 AM
    const defaultPunchIn = new Date(currentDate);
    defaultPunchIn.setHours(9, 30, 0, 0);
    setPunchInStr(format(defaultPunchIn, "yyyy-MM-dd'T'HH:mm"));

    const defaultPunchOut = new Date(currentDate);
    defaultPunchOut.setHours(18, 0, 0, 0);
    setPunchOutStr(format(defaultPunchOut, "yyyy-MM-dd'T'HH:mm"));

    setIsLate(false);
    setIsLateSpecialCase(false);
    setIsHalfDay(false);
    setIsOutsideOffice(false);
    setIsAutoPunchOut(false);
    setPunchInLatStr("");
    setPunchInLngStr("");
    setPunchOutLatStr("");
    setPunchOutLngStr("");
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!isCreateMode && !selectedRecord) return;
    if (isCreateMode && !selectedUserId) {
      toast.error("Please select an employee");
      return;
    }
    if (!punchInStr) {
      toast.error("Please specify a valid check-in time");
      return;
    }

    setSaving(true);

    try {
      const punchInDate = new Date(punchInStr);
      const punchOutDate = punchOutStr ? new Date(punchOutStr) : null;

      if (punchOutDate && punchOutDate < punchInDate) {
        toast.error("Punch-out time cannot be earlier than punch-in time");
        setSaving(false);
        return;
      }

      if (isCreateMode) {
        const res = await createAttendanceAction({
          userId: selectedUserId,
          date: currentDate,
          punchIn: punchInDate,
          punchOut: punchOutDate,
          isLate,
          isLateSpecialCase,
          isHalfDay,
          isOutsideOffice,
          isAutoPunchOut,
        });

        if (res.success) {
          toast.success("Attendance entry created successfully");
          setIsDialogOpen(false);
          fetchAttendances();
        } else {
          toast.error(res.error || "Failed to create attendance");
        }
      } else {
        const updateData = {
          punchIn: punchInDate,
          punchOut: punchOutDate,
          isLate,
          isLateSpecialCase,
          isHalfDay,
          isOutsideOffice,
          isAutoPunchOut,
          punchInLat: punchInLatStr ? parseFloat(punchInLatStr) : null,
          punchInLng: punchInLngStr ? parseFloat(punchInLngStr) : null,
          punchOutLat: punchOutLatStr ? parseFloat(punchOutLatStr) : null,
          punchOutLng: punchOutLngStr ? parseFloat(punchOutLngStr) : null,
        };

        const res = await adjustAttendanceAction(selectedRecord.id, updateData);

        if (res.success) {
          toast.success("Attendance adjusted successfully");
          setIsDialogOpen(false);
          fetchAttendances();
        } else {
          toast.error(res.error || "Failed to update attendance");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePrompt = (record: any) => {
    setRecordToDelete(record);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    setDeleting(true);
    try {
      const res = await deleteAttendanceAction(recordToDelete.id);
      if (res.success) {
        toast.success("Attendance record deleted successfully");
        setIsDeleteDialogOpen(false);
        if (isDialogOpen && selectedRecord?.id === recordToDelete.id) {
          setIsDialogOpen(false);
        }
        setRecordToDelete(null);
        fetchAttendances();
      } else {
        toast.error(res.error || "Failed to delete attendance record");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred during deletion");
    } finally {
      setDeleting(false);
    }
  };

  // KPIs & Summary Metrics
  const stats = useMemo(() => {
    const total = attendances.length;
    const halfDayCount = attendances.filter((a) => a.isHalfDay).length;
    const lateCount = attendances.filter((a) => a.isLate && !a.isHalfDay).length;
    const specialCaseCount = attendances.filter((a) => a.isLateSpecialCase).length;
    const onTimeCount = attendances.filter((a) => !a.isLate && !a.isHalfDay).length;
    const outsideOfficeCount = attendances.filter((a) => a.isOutsideOffice).length;
    const autoLogoutCount = attendances.filter((a) => a.isAutoPunchOut).length;
    const inProgressCount = attendances.filter((a) => a.punchIn && !a.punchOut).length;
    const onTimeRate = total > 0 ? Math.round((onTimeCount / total) * 100) : 100;

    return {
      total,
      halfDayCount,
      lateCount,
      specialCaseCount,
      onTimeCount,
      outsideOfficeCount,
      autoLogoutCount,
      inProgressCount,
      onTimeRate,
    };
  }, [attendances]);

  // Filtered & Searched Attendances
  const filteredAttendances = useMemo(() => {
    return attendances.filter((rec) => {
      // Tab Filter
      if (activeTab === "ON_TIME" && (rec.isLate || rec.isHalfDay)) return false;
      if (activeTab === "LATE" && (!rec.isLate || rec.isHalfDay)) return false;
      if (activeTab === "HALF_DAY" && !rec.isHalfDay) return false;
      if (activeTab === "SPECIAL_CASE" && !rec.isLateSpecialCase) return false;
      if (activeTab === "OUTSIDE_OFFICE" && !rec.isOutsideOffice) return false;
      if (activeTab === "AUTO_LOGOUT" && !rec.isAutoPunchOut) return false;

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const name = rec.user?.name?.toLowerCase() || "";
        const email = rec.user?.email?.toLowerCase() || "";
        const code = rec.user?.employeeCode?.toLowerCase() || "";
        const dept = rec.user?.department?.name?.toLowerCase() || "";
        return name.includes(query) || email.includes(query) || code.includes(query) || dept.includes(query);
      }

      return true;
    });
  }, [attendances, activeTab, searchQuery]);

  return (
    <div className="space-y-4">
      {/* ── Executive Header Banner ── */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="size-8 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 sm:mb-1 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none">
                Attendance Adjustments
              </h1>
              <Badge variant="outline" className="text-[9px] sm:text-[10px] uppercase font-bold text-primary bg-primary/10 border-primary/20 px-1.5 sm:px-2 py-0.5 rounded-sm">
                Developer Suite
              </Badge>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1 sm:line-clamp-none">
              Manual override console for employee check-ins, technical half-days, timestamps, and geofences
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="shrink-0">
            <DateFilter currentDate={dateParam} baseUrl="/dashboard/admin/developer/attendance" />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="h-9 px-3 text-xs font-semibold gap-1.5 cursor-pointer hover:bg-muted/80 rounded-md"
            title="Refresh logs"
          >
            <RotateCw className={cn("size-3.5", refreshing && "animate-spin text-primary")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button onClick={handleCreateClick} size="sm" className="h-9 px-3.5 text-xs font-semibold gap-2 shadow-xs cursor-pointer rounded-md">
            <Plus className="size-4" />
            <span>Manual Entry</span>
          </Button>
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Logged Sessions</span>
            <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <UserCheck className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground tracking-tight">{stats.total}</span>
            <span className="text-[11px] text-muted-foreground">recorded</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-block size-2 rounded-full bg-emerald-500" />
            <span>{stats.inProgressCount} in progress</span>
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Technical Half-Days (HL)</span>
            <div className="size-8 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Sun className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400 tracking-tight">{stats.halfDayCount}</span>
            <span className="text-[11px] text-muted-foreground">0.5d credits</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="text-purple-600 dark:text-purple-400 font-medium">Half-day shift logs</span>
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Late Marks & Exceptions</span>
            <div className="size-8 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground tracking-tight">{stats.lateCount}</span>
            <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">late arrivals</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            <span>{stats.specialCaseCount} marked as Special Case</span>
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Remote & Auto Logoffs</span>
            <div className="size-8 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <MapPin className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground tracking-tight">{stats.outsideOfficeCount}</span>
            <span className="text-[11px] text-muted-foreground">outside office</span>
          </div>
          <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            <span>{stats.autoLogoutCount} auto-logouts</span>
          </div>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-md border border-border/80 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, employee ID, or department..."
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
            All ({attendances.length})
          </Button>
          <Button
            variant={activeTab === "ON_TIME" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("ON_TIME")}
            className="h-8 text-xs font-medium rounded-md px-2.5 text-emerald-600 dark:text-emerald-400 cursor-pointer"
          >
            On Time ({stats.onTimeCount})
          </Button>
          <Button
            variant={activeTab === "HALF_DAY" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("HALF_DAY")}
            className="h-8 text-xs font-medium rounded-md px-2.5 text-purple-600 dark:text-purple-400 cursor-pointer"
          >
            Half Day ({stats.halfDayCount})
          </Button>
          <Button
            variant={activeTab === "LATE" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("LATE")}
            className="h-8 text-xs font-medium rounded-md px-2.5 text-rose-600 dark:text-rose-400 cursor-pointer"
          >
            Late ({stats.lateCount})
          </Button>
          <Button
            variant={activeTab === "SPECIAL_CASE" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("SPECIAL_CASE")}
            className="h-8 text-xs font-medium rounded-md px-2.5 text-sky-600 dark:text-sky-400 cursor-pointer"
          >
            Special Case ({stats.specialCaseCount})
          </Button>
          <Button
            variant={activeTab === "OUTSIDE_OFFICE" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("OUTSIDE_OFFICE")}
            className="h-8 text-xs font-medium rounded-md px-2.5 text-purple-600 dark:text-purple-400 cursor-pointer"
          >
            Outside ({stats.outsideOfficeCount})
          </Button>
        </div>
      </div>

      {/* ── Main Attendance Table ── */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40 border-b border-border/70">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-xs py-3.5">Employee</TableHead>
                <TableHead className="font-semibold text-xs py-3.5">Check In</TableHead>
                <TableHead className="font-semibold text-xs py-3.5">Check Out</TableHead>
                <TableHead className="font-semibold text-xs py-3.5 text-center">Duration</TableHead>
                <TableHead className="font-semibold text-xs py-3.5">Policy Badges</TableHead>
                <TableHead className="font-semibold text-xs py-3.5">Location / GPS</TableHead>
                <TableHead className="font-semibold text-xs py-3.5 text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RotateCw className="size-6 text-primary animate-spin" />
                      <p className="text-xs text-muted-foreground font-medium">Loading attendance records...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredAttendances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center">
                      <div className="size-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mb-3">
                        <Timer className="size-6" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">No attendance records found</h3>
                      <p className="text-xs text-muted-foreground mt-1 mb-4">
                        {searchQuery || activeTab !== "ALL"
                          ? "No records matched your search or active filter tab."
                          : `No attendance entries exist for ${format(currentDate, "MMMM d, yyyy")}.`}
                      </p>
                      <Button onClick={handleCreateClick} size="sm" variant="outline" className="gap-2 text-xs cursor-pointer">
                        <Plus className="size-3.5" />
                        Create Manual Entry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAttendances.map((record) => {
                  const duration = calculateDuration(record.punchIn, record.punchOut);
                  const hasGps = record.punchInLat || record.punchInLng || record.punchOutLat || record.punchOutLng;

                  return (
                    <TableRow key={record.id} className="group hover:bg-muted/30 transition-colors">
                      {/* Employee Info */}
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9 border border-border/80 shrink-0">
                            <AvatarImage src={record.user?.avatarUrl || undefined} alt={record.user?.name || "User"} />
                            <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">
                              {record.user?.name?.slice(0, 2).toUpperCase() || "EM"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs text-foreground tracking-tight truncate">
                                {record.user?.name || "Unnamed"}
                              </span>
                              {record.user?.employeeCode && (
                                <span className="text-[10px] font-mono font-medium text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                                  {record.user.employeeCode}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 truncate">
                              <span>{record.user?.email}</span>
                              {record.user?.department?.name && (
                                <>
                                  <span>•</span>
                                  <span className="text-foreground/80 font-medium">{record.user.department.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Punch In */}
                      <TableCell className="py-3">
                        {record.punchIn ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-semibold text-foreground">
                                {format(new Date(record.punchIn), "hh:mm a")}
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground font-medium">
                              {format(new Date(record.punchIn), "MMM dd, yyyy")}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">—</span>
                        )}
                      </TableCell>

                      {/* Punch Out */}
                      <TableCell className="py-3">
                        {record.punchOut ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-semibold text-foreground">
                                {format(new Date(record.punchOut), "hh:mm a")}
                              </span>
                              {record.isAutoPunchOut && (
                                <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                                  Auto
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-medium">
                              {format(new Date(record.punchOut), "MMM dd, yyyy")}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>In Progress</span>
                          </div>
                        )}
                      </TableCell>

                      {/* Duration */}
                      <TableCell className="py-3 text-center">
                        {duration ? (
                          <Badge
                            variant="secondary"
                            className={cn(
                              "font-mono text-xs font-semibold px-2 py-0.5 rounded-md",
                              record.isHalfDay
                                ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                                : duration.totalMinutes >= 480
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                                : duration.totalMinutes >= 240
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                                : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
                            )}
                          >
                            {duration.hours}h {duration.mins.toString().padStart(2, "0")}m
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">—</span>
                        )}
                      </TableCell>

                      {/* Policy Badges */}
                      <TableCell className="py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {record.isHalfDay && (
                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25">
                              Technical Half Day (HL)
                            </Badge>
                          )}

                          {!record.isHalfDay && (
                            record.isLate ? (
                              <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25">
                                Late Mark
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25">
                                On Time
                              </Badge>
                            )
                          )}

                          {record.isLateSpecialCase && (
                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25">
                              Special Case
                            </Badge>
                          )}

                          {record.isOutsideOffice && (
                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25">
                              Outside Office
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Location / GPS */}
                      <TableCell className="py-3">
                        {record.isOutsideOffice ? (
                          <div className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 font-medium">
                            <Compass className="size-3.5 shrink-0" />
                            <span>Remote / Outside</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                            <Building2 className="size-3.5 text-primary/70 shrink-0" />
                            <span>{record.user?.location?.name || "Office In-Site"}</span>
                          </div>
                        )}

                        {hasGps && (
                          <div className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">
                            GPS Active
                          </div>
                        )}
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
                                  onClick={() => handleEditClick(record)}
                                  className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                                >
                                  <Edit3 className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Adjust entry & timings</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeletePrompt(record)}
                                  className="size-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete entry permanently</TooltipContent>
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

      {/* ── Edit / Manual Entry Dialog ── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card">
          <div className="shrink-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-4 border-b border-border/80">
            <DialogHeader className="gap-1">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                  {isCreateMode ? <Plus className="size-5" /> : <Edit3 className="size-4.5" />}
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                    {isCreateMode ? "Add Manual Attendance Record" : "Adjust Attendance Record"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    {isCreateMode
                      ? "Create an administrative attendance entry with precise timings and half-day options"
                      : `Modifying record for ${selectedRecord?.user?.name || "Employee"}`}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4.5 overscroll-contain">
            {/* Employee Selector (Create Mode) or Info Banner (Edit Mode) */}
            {isCreateMode ? (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Select Target Employee</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="h-10 text-xs rounded-xl bg-background border-border/80">
                    <SelectValue placeholder="Choose an employee..." />
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
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/70">
                <Avatar className="size-10 border border-border">
                  <AvatarImage src={selectedRecord?.user?.avatarUrl || undefined} />
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                    {selectedRecord?.user?.name?.slice(0, 2).toUpperCase() || "EM"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-foreground truncate">{selectedRecord?.user?.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">
                    {selectedRecord?.user?.email} • {selectedRecord?.user?.employeeCode || "ID N/A"}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-semibold">
                  {format(currentDate, "PP")}
                </Badge>
              </div>
            )}

            {/* Quick Shift Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Zap className="size-3.5 text-amber-500" />
                  Quick Shift Presets
                </Label>
                <span className="text-[10px] text-muted-foreground">Auto-populates timings & flags</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("STANDARD")}
                  className="h-8 text-[11px] font-medium rounded-lg justify-start gap-1.5 hover:bg-primary/5 hover:border-primary/30 cursor-pointer"
                >
                  <Sparkles className="size-3 text-primary shrink-0" />
                  <span>09:30 - 18:00 (Std)</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("EARLY")}
                  className="h-8 text-[11px] font-medium rounded-lg justify-start gap-1.5 hover:bg-primary/5 hover:border-primary/30 cursor-pointer"
                >
                  <Sparkles className="size-3 text-primary shrink-0" />
                  <span>09:00 - 18:00 (Early)</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("LATE")}
                  className="h-8 text-[11px] font-medium rounded-lg justify-start gap-1.5 hover:bg-rose-500/5 hover:border-rose-500/30 text-rose-600 dark:text-rose-400 cursor-pointer"
                >
                  <Clock className="size-3 text-rose-500 shrink-0" />
                  <span>10:15 - 19:15 (Late)</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("HALF_MORNING")}
                  className="h-8 text-[11px] font-medium rounded-lg justify-start gap-1.5 bg-purple-500/5 border-purple-500/25 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 cursor-pointer"
                >
                  <Sun className="size-3 text-purple-500 shrink-0" />
                  <span>Technical Half Day (AM)</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("HALF_AFTERNOON")}
                  className="h-8 text-[11px] font-medium rounded-lg justify-start gap-1.5 bg-purple-500/5 border-purple-500/25 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 cursor-pointer"
                >
                  <Sunset className="size-3 text-purple-500 shrink-0" />
                  <span>Technical Half Day (PM)</span>
                </Button>
                {currentSelectedUser?.location && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyOfficeCoordinates}
                    className="h-8 text-[11px] font-medium rounded-lg justify-start gap-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-500/5 cursor-pointer"
                  >
                    <Compass className="size-3 text-purple-500 shrink-0" />
                    <span>Office GPS</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Date & Timings Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/20">
              <div className="space-y-1.5">
                <Label htmlFor="punchIn" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-full bg-emerald-500" />
                  Check-In Timestamp
                </Label>
                <Input
                  id="punchIn"
                  type="datetime-local"
                  value={punchInStr}
                  onChange={(e) => setPunchInStr(e.target.value)}
                  className="h-9 text-xs font-mono rounded-lg bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="punchOut" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span className="inline-block size-2 rounded-full bg-rose-500" />
                    Check-Out Timestamp
                  </Label>
                  {punchOutStr && (
                    <button
                      type="button"
                      onClick={() => setPunchOutStr("")}
                      className="text-[10px] text-muted-foreground hover:text-destructive underline cursor-pointer"
                    >
                      Clear Out
                    </button>
                  )}
                </div>
                <Input
                  id="punchOut"
                  type="datetime-local"
                  value={punchOutStr}
                  onChange={(e) => setPunchOutStr(e.target.value)}
                  className="h-9 text-xs font-mono rounded-lg bg-background"
                />
              </div>

              {/* Live Session Duration Banner */}
              {formDuration && (
                <div className="col-span-full mt-1 p-2.5 rounded-lg bg-card border border-border/70 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Timer className="size-4 text-primary" />
                    <span className="text-xs font-medium text-foreground">Calculated Duration:</span>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "font-mono text-xs font-bold",
                      isHalfDay
                        ? "bg-purple-500/10 text-purple-700 dark:text-purple-300"
                        : formDuration.totalMinutes >= 480
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : formDuration.totalMinutes >= 240
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                    )}
                  >
                    {formDuration.hours}h {formDuration.mins}m{" "}
                    {isHalfDay ? "(Technical Half Day)" : formDuration.isOngoing ? "(In Progress)" : "(Completed)"}
                  </Badge>
                </div>
              )}
            </div>

            {/* Policy & Rules Toggles (Grid) */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Policy & Verification Flags</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div
                  onClick={() => {
                    const nextVal = !isHalfDay;
                    setIsHalfDay(nextVal);
                    if (nextVal) setIsLate(false); // Technical half-day clears late mark penalty
                  }}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                    isHalfDay
                      ? "bg-purple-500/10 border-purple-500/40 text-purple-950 dark:text-purple-100 ring-1 ring-purple-500/20"
                      : "bg-card border-border/80 hover:bg-muted/30"
                  )}
                >
                  <div className="space-y-0.5 pr-2">
                    <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                      <Sun className="size-3.5" />
                      Technical Half Day (HL)
                    </div>
                    <div className="text-[10px] text-muted-foreground">0.5d present credit without late penalty</div>
                  </div>
                  <Switch checked={isHalfDay} onCheckedChange={(val) => {
                    setIsHalfDay(val);
                    if (val) setIsLate(false);
                  }} />
                </div>

                <div
                  onClick={() => {
                    const nextVal = !isLate;
                    setIsLate(nextVal);
                    if (nextVal) setIsHalfDay(false);
                  }}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                    isLate
                      ? "bg-rose-500/5 border-rose-500/30 text-rose-900 dark:text-rose-100"
                      : "bg-card border-border/80 hover:bg-muted/30"
                  )}
                >
                  <div className="space-y-0.5 pr-2">
                    <div className="text-xs font-semibold">Late Mark</div>
                    <div className="text-[10px] text-muted-foreground">Flags check-in as delayed</div>
                  </div>
                  <Switch checked={isLate} onCheckedChange={(val) => {
                    setIsLate(val);
                    if (val) setIsHalfDay(false);
                  }} />
                </div>

                <div
                  onClick={() => setIsLateSpecialCase(!isLateSpecialCase)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                    isLateSpecialCase
                      ? "bg-sky-500/5 border-sky-500/30 text-sky-900 dark:text-sky-100"
                      : "bg-card border-border/80 hover:bg-muted/30"
                  )}
                >
                  <div className="space-y-0.5 pr-2">
                    <div className="text-xs font-semibold">Special Case Waive</div>
                    <div className="text-[10px] text-muted-foreground">Waives deduction on late arrival</div>
                  </div>
                  <Switch checked={isLateSpecialCase} onCheckedChange={setIsLateSpecialCase} />
                </div>

                <div
                  onClick={() => setIsOutsideOffice(!isOutsideOffice)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                    isOutsideOffice
                      ? "bg-purple-500/5 border-purple-500/30 text-purple-900 dark:text-purple-100"
                      : "bg-card border-border/80 hover:bg-muted/30"
                  )}
                >
                  <div className="space-y-0.5 pr-2">
                    <div className="text-xs font-semibold">Outside Office</div>
                    <div className="text-[10px] text-muted-foreground">Remote or client location</div>
                  </div>
                  <Switch checked={isOutsideOffice} onCheckedChange={setIsOutsideOffice} />
                </div>

                <div
                  onClick={() => setIsAutoPunchOut(!isAutoPunchOut)}
                  className={cn(
                    "col-span-full flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                    isAutoPunchOut
                      ? "bg-amber-500/5 border-amber-500/30 text-amber-900 dark:text-amber-100"
                      : "bg-card border-border/80 hover:bg-muted/30"
                  )}
                >
                  <div className="space-y-0.5 pr-2">
                    <div className="text-xs font-semibold">Auto Logout Flag</div>
                    <div className="text-[10px] text-muted-foreground">Marks entry as closed automatically by system end-of-day job</div>
                  </div>
                  <Switch checked={isAutoPunchOut} onCheckedChange={setIsAutoPunchOut} />
                </div>
              </div>
            </div>

            {/* GPS Geofence Coordinates Accordion */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="gps-details" className="border-border/70 rounded-xl border px-3">
                <AccordionTrigger className="text-xs font-semibold py-2.5 text-muted-foreground hover:text-foreground cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Compass className="size-3.5 text-primary" />
                    <span>Advanced Geofencing GPS Coordinates</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Punch In Latitude</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="e.g. 16.7050"
                        value={punchInLatStr}
                        onChange={(e) => setPunchInLatStr(e.target.value)}
                        className="h-8 text-xs font-mono mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Punch In Longitude</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="e.g. 74.2433"
                        value={punchInLngStr}
                        onChange={(e) => setPunchInLngStr(e.target.value)}
                        className="h-8 text-xs font-mono mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Punch Out Latitude</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="e.g. 16.7050"
                        value={punchOutLatStr}
                        onChange={(e) => setPunchOutLatStr(e.target.value)}
                        className="h-8 text-xs font-mono mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Punch Out Longitude</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="e.g. 74.2433"
                        value={punchOutLngStr}
                        onChange={(e) => setPunchOutLngStr(e.target.value)}
                        className="h-8 text-xs font-mono mt-1"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Sticky Dialog Action Bar */}
          <div className="shrink-0 px-5 py-3.5 bg-muted/40 border-t border-border/80 flex items-center justify-between gap-3 w-full">
            <div>
              {!isCreateMode && selectedRecord && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeletePrompt(selectedRecord)}
                  className="gap-1.5 h-9 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                  disabled={saving}
                >
                  <Trash2 className="size-3.5" />
                  <span>Delete</span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDialogOpen(false)}
                disabled={saving}
                className="h-9 px-4 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="h-9 px-5 text-xs font-semibold gap-2 shadow-xs cursor-pointer"
              >
                {saving && <RotateCw className="size-3.5 animate-spin" />}
                <span>{isCreateMode ? "Create Record" : "Save Changes"}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card">
          <div className="p-5 border-b border-border/80 bg-destructive/5">
            <DialogHeader className="gap-1">
              <div className="flex items-center gap-2.5 text-destructive mb-0.5">
                <div className="size-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="size-4.5 text-destructive" />
                </div>
                <DialogTitle className="text-base font-bold text-foreground">Delete Attendance Entry</DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Are you sure you want to permanently remove this attendance log? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
          </div>

          {recordToDelete && (
            <div className="p-5 space-y-2 text-xs">
              <div className="p-3.5 rounded-xl border border-border/80 bg-muted/40 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Employee:</span>
                  <span className="font-bold text-foreground">{recordToDelete.user?.name || recordToDelete.user?.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium text-foreground">{format(currentDate, "MMMM d, yyyy")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Punch In:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {recordToDelete.punchIn ? format(new Date(recordToDelete.punchIn), "hh:mm a") : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Punch Out:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {recordToDelete.punchOut ? format(new Date(recordToDelete.punchOut), "hh:mm a") : "—"}
                  </span>
                </div>
                {recordToDelete.isHalfDay && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="text-purple-600 dark:text-purple-400 font-bold">Technical Half Day (HL - 0.5d)</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="p-4 sm:px-5 sm:py-3.5 bg-muted/40 border-t border-border/80 flex items-center justify-end gap-2.5 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(false)}
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
              <span>Delete Permanently</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AttendanceAdjustmentClient() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center p-16 gap-3">
          <RotateCw className="animate-spin size-8 text-primary" />
          <p className="text-xs text-muted-foreground font-medium">Loading Attendance Adjuster...</p>
        </div>
      }
    >
      <AttendanceAdjustmentClientContent />
    </Suspense>
  );
}
