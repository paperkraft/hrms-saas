"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Clock,
  Search,
  Filter,
  Calendar,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock3,
  Layers,
  FileCheck,
  Building2,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OvertimeRequestsTable } from "@/components/features/accountant/overtime-requests-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui";
import { Textarea } from "@/components/ui/textarea";
import { updateLeaveStatus } from "@/actions/leave/admin";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { format, differenceInCalendarDays } from "date-fns";
import { cn, getInitials } from "@/lib/utils";
import { MonthFilter } from "@/components/features/accountant/month-filter";

interface LeavesManageClientProps {
  initialRequests: any[];
  initialOvertimeRequests?: any[];
  role: string;
  currentUserId: string;
}

export function LeavesManageClient({
  initialRequests,
  initialOvertimeRequests = [],
  role,
  currentUserId,
}: LeavesManageClientProps) {
  const router = useRouter();
  const isAdmin = role === "ADMIN" || role === "SYSTEM_ADMIN";
  const [requests, setRequests] = useState(initialRequests);

  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | null>(null);
  const [managerNote, setManagerNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    const matchesSearch =
      req.user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.user.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.reason && req.reason.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = selectedStatus === "ALL" || req.status === selectedStatus;
    const matchesCategory = selectedCategory === "ALL" || req.category === selectedCategory;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Calculate counts
  const approvedCount = requests.filter((r) => r.status === "APPROVED").length;
  const rejectedCount = requests.filter((r) => r.status === "REJECTED").length;
  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const totalCount = requests.length;

  const categories = [
    { value: "ALL", label: "All Policies" },
    { value: "MONTHLY_POLICY_1", label: "Monthly Policy" },
    { value: "SEMI_ANNUAL_POLICY_2", label: "Semi-Annual Policy" },
    { value: "UNPAID", label: "Unpaid Leaves" },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "text-emerald-600 bg-emerald-500/10 border-emerald-500/20";
      case "REJECTED":
        return "text-rose-600 bg-rose-500/10 border-rose-500/20";
      default:
        return "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/20";
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "MONTHLY_POLICY_1":
        return "Monthly Policy";
      case "SEMI_ANNUAL_POLICY_2":
        return "Semi-Annual Policy";
      case "UNPAID":
        return "Unpaid";
      default:
        return category;
    }
  };

  const getFormattedDuration = (req: any, totalDays: number) => {
    if (req.duration === "HALF_DAY") {
      return `Half Day (${req.halfDayType === "FIRST_HALF" ? "1st Half" : "2nd Half"})`;
    }
    if (req.duration === "SHORT_LEAVE") {
      return `Short Leave (${req.shortLeaveHours || 2}h)`;
    }
    return `${totalDays} ${totalDays === 1 ? "day" : "days"}`;
  };

  const handleOpenDetails = (req: any) => {
    setSelectedRequest(req);
    setActionType(null);
    setManagerNote(req.managerNote || "");
    setIsDetailsOpen(true);
  };

  const handleOpenAction = (req: any, type: "APPROVE" | "REJECT") => {
    setSelectedRequest(req);
    setActionType(type);
    setManagerNote("");
    setIsDetailsOpen(true);
  };

  const handleSubmitAction = async () => {
    if (!selectedRequest || !actionType) return;

    setSubmitting(true);
    const result = await updateLeaveStatus(
      selectedRequest.id,
      actionType === "APPROVE" ? "APPROVED" : "REJECTED",
      managerNote || undefined
    );
    setSubmitting(false);

    if (result.success) {
      toast.success(
        `Leave request successfully ${actionType === "APPROVE" ? "approved" : "rejected"}`
      );
      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedRequest.id
            ? {
              ...r,
              status: actionType === "APPROVE" ? "APPROVED" : "REJECTED",
              managerNote,
            }
            : r
        )
      );
      setIsDetailsOpen(false);
      setSelectedRequest(null);
      setActionType(null);
      router.refresh();
    } else {
      toast.error(result.error || "Failed to update leave request status");
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Page Header Banner ── */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="size-8 sm:size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <FileCheck className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none mb-0.5 sm:mb-1">
              Team Approvals
            </h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1 sm:line-clamp-none">
              Review, approve, or reject employee leave and overtime applications with audit notes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <MonthFilter baseUrl="/dashboard/leaves/manage" />
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <Tabs defaultValue="leaves">
        <div className="flex items-center justify-between gap-4">
          <TabsList className="bg-muted/40 p-1 rounded-md border border-border/70 h-10 sm:h-9 w-full sm:w-auto flex items-center justify-start gap-1">
            <TabsTrigger
              value="leaves"
              className="h-8 px-3 sm:px-4 text-xs font-bold rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-border/60 transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-initial"
            >
              <FileText className="size-3.5 text-primary shrink-0" />
              <span>Leave Requests</span>
              <span className="ml-1 bg-primary/10 text-primary px-1.5 py-0.2 rounded font-mono text-[10px] font-bold">
                {requests.length}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="overtime"
              className="h-8 px-3 sm:px-4 text-xs font-bold rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-border/60 transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-initial"
            >
              <Clock className="size-3.5 text-amber-600 shrink-0" />
              <span>Overtime Requests</span>
              <span className="ml-1 bg-amber-500/10 text-amber-600 px-1.5 py-0.2 rounded font-mono text-[10px] font-bold">
                {initialOvertimeRequests.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="leaves" className="space-y-4 mt-2">
          {/* ── Summary Counters ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="bg-card border border-border/80 rounded-md p-4 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-muted-foreground block">Pending Review</span>
                <span className="text-xl font-bold tracking-tight text-amber-600 font-mono mt-1 block">
                  {pendingCount}
                </span>
              </div>
              <div className="p-2 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <Clock3 className="size-4" />
              </div>
            </div>

            <div className="bg-card border border-border/80 rounded-md p-4 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-muted-foreground block">Approved Leaves</span>
                <span className="text-xl font-bold tracking-tight text-emerald-600 font-mono mt-1 block">
                  {approvedCount}
                </span>
              </div>
              <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <CheckCircle2 className="size-4" />
              </div>
            </div>

            <div className="bg-card border border-border/80 rounded-md p-4 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-muted-foreground block">Rejected Leaves</span>
                <span className="text-xl font-bold tracking-tight text-rose-600 font-mono mt-1 block">
                  {rejectedCount}
                </span>
              </div>
              <div className="p-2 rounded-md bg-rose-500/10 text-rose-600 border border-rose-500/20">
                <XCircle className="size-4" />
              </div>
            </div>

            <div className="bg-card border border-border/80 rounded-md p-4 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-muted-foreground block">Total Logged</span>
                <span className="text-xl font-bold tracking-tight text-foreground font-mono mt-1 block">
                  {totalCount}
                </span>
              </div>
              <div className="p-2 rounded-md bg-primary/10 text-primary border border-primary/20">
                <Layers className="size-4" />
              </div>
            </div>
          </div>

          {/* ── Search & Filter Controls ── */}
          <div className="bg-card border border-border/80 rounded-md p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
              <Input
                placeholder="Search by employee, designation, or reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Policy Filter */}
              <div className="flex items-center bg-muted/40 p-1 rounded-md border border-border/70">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(cat.value)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                      selectedCategory === cat.value
                        ? "bg-card text-foreground font-bold shadow-xs border border-border/60"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <div className="flex items-center bg-muted/40 p-1 rounded-md border border-border/70">
                {[
                  { value: "ALL", label: "All" },
                  { value: "PENDING", label: "Pending" },
                  { value: "APPROVED", label: "Approved" },
                  { value: "REJECTED", label: "Rejected" },
                ].map((st) => (
                  <button
                    key={st.value}
                    onClick={() => setSelectedStatus(st.value)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                      selectedStatus === st.value
                        ? "bg-card text-foreground font-bold shadow-xs border border-border/60"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Main Data View ── */}
          {filteredRequests.length === 0 ? (
            <div className="bg-card border border-border/80 border-dashed rounded-md py-16 flex flex-col items-center justify-center text-center shadow-2xs">
              <div className="size-10 rounded-md bg-muted/40 flex items-center justify-center text-muted-foreground/50 mb-3 border border-border/50">
                <FileText className="size-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground">No leave requests found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs px-4">
                Try adjusting your search criteria, policy category, or status filter.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Cards List View */}
              <div className="block sm:hidden space-y-3">
                {filteredRequests.map((req) => {
                  const startD = new Date(req.startDate);
                  const endD = new Date(req.endDate);
                  const totalDays = differenceInCalendarDays(endD, startD) + 1;

                  return (
                    <div
                      key={req.id}
                      onClick={() => handleOpenDetails(req)}
                      className="bg-card border border-border/80 rounded-md p-4 hover:border-primary/45 transition-colors cursor-pointer space-y-3 shadow-2xs"
                    >
                      {/* Top Row: Employee Avatar & Info */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8 rounded-full shrink-0">
                            {req.user.avatarUrl && <AvatarImage src={req.user.avatarUrl} alt={req.user.name} className="object-cover rounded-full" />}
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center size-full">
                              {getInitials(req.user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">
                              {req.user.name || "Employee"}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-medium truncate mt-0.5">
                              {req.user.designation || "Staff Member"}
                            </p>
                          </div>
                        </div>
                        <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0", getStatusColor(req.status))}>
                          {req.status}
                        </span>
                      </div>

                      {/* Badges: Department & Policy Type */}
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted/40 text-muted-foreground border border-border/60">
                          {req.user.department?.name || "Global"}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                          {getCategoryLabel(req.category)}
                        </span>
                      </div>

                      {/* Timeline & Duration */}
                      <div className="flex flex-col gap-1 text-xs font-medium bg-muted/20 p-2.5 rounded-md border border-border/50">
                        <div className="flex items-center gap-1.5 text-foreground/90 font-semibold tabular-nums">
                          <Calendar className="size-3.5 text-muted-foreground/60 shrink-0" />
                          <span>{format(startD, "dd MMM yy")}</span>
                          <ArrowRight className="size-3 text-muted-foreground/40" />
                          <span>{format(endD, "dd MMM yy")}</span>
                        </div>
                        <div className="text-[10px] font-bold text-muted-foreground mt-0.5">
                          {getFormattedDuration(req, totalDays)}
                        </div>
                      </div>

                      {/* Actions row */}
                      {req.status === "PENDING" && (
                        <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenAction(req, "APPROVE")}
                            className="flex-1 h-8 text-xs font-semibold rounded-md border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenAction(req, "REJECT")}
                            className="flex-1 h-8 text-xs font-semibold rounded-md border-rose-500/30 text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead className="bg-muted/30 border-b border-border/70">
                      <tr>
                        <th className="py-3.5 px-5 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">Employee</th>
                        <th className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">Department</th>
                        <th className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">Policy Type</th>
                        <th className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">Timeline</th>
                        <th className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">Duration</th>
                        <th className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">Status</th>
                        <th className="py-3.5 px-5 text-right text-xs font-bold text-muted-foreground whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {filteredRequests.map((req) => {
                        const startD = new Date(req.startDate);
                        const endD = new Date(req.endDate);
                        const totalDays = differenceInCalendarDays(endD, startD) + 1;

                        return (
                          <tr
                            key={req.id}
                            onClick={() => handleOpenDetails(req)}
                            className="hover:bg-muted/10 cursor-pointer transition-colors duration-150 group"
                          >
                            <td className="py-3 px-5 flex items-center gap-3">
                              <Avatar className="size-8 rounded-full shrink-0">
                                {req.user.avatarUrl && <AvatarImage src={req.user.avatarUrl} alt={req.user.name} className="object-cover rounded-full" />}
                                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center size-full">
                                  {getInitials(req.user.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                                  {req.user.name || "Employee"}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-medium truncate mt-0.5">
                                  {req.user.designation || "Staff Member"}
                                </p>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-xs font-semibold text-foreground/80">
                                {req.user.department?.name || "Global"}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-xs font-semibold text-foreground/90">
                                {getCategoryLabel(req.category)}
                              </span>
                              {req.leaveType && (
                                <span className="block text-[10px] font-medium text-muted-foreground mt-0.5">
                                  {req.leaveType}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/80 tabular-nums">
                                <Calendar className="size-3 text-muted-foreground/60" />
                                <span>{format(startD, "dd MMM yy")}</span>
                                <ArrowRight className="size-2.5 text-muted-foreground/40" />
                                <span>{format(endD, "dd MMM yy")}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-xs font-semibold text-foreground tabular-nums">
                                {getFormattedDuration(req, totalDays)}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-bold inline-block whitespace-nowrap", getStatusColor(req.status))}>
                                {req.status}
                              </span>
                            </td>
                            <td className="py-3 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                {req.status === "PENDING" && isAdmin ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleOpenAction(req, "APPROVE")}
                                      className="h-8 px-3 text-xs font-semibold rounded-md border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleOpenAction(req, "REJECT")}
                                      className="h-8 px-3 text-xs font-semibold rounded-md border-rose-500/30 text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                                    >
                                      Reject
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-muted-foreground hover:text-primary transition-all rounded-md cursor-pointer"
                                    onClick={() => handleOpenDetails(req)}
                                    title="View Application Details"
                                  >
                                    <ExternalLink className="size-3.5" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── Dialog Details & Review Actions ── */}
          {selectedRequest && (
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
              <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg p-0 overflow-hidden rounded-md border border-border/80 shadow-2xl bg-card gap-0">
                <DialogHeader className="px-6 py-5 border-b shrink-0 bg-background/50 border-border/60">
                  <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                    {actionType === "APPROVE"
                      ? "Approve Leave Request"
                      : actionType === "REJECT"
                        ? "Reject Leave Request"
                        : "Leave Application Details"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground font-medium mt-0.5">
                    {actionType
                      ? "Review application and provide optional manager feedback."
                      : "Detailed summary of employee leave submission."}
                  </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-4 text-xs font-medium max-h-[70vh] overflow-y-auto custom-scrollbar">
                  {/* Employee overview */}
                  <div className="flex items-center gap-3 bg-muted/20 p-3.5 rounded-md border border-border/70">
                    <Avatar className="size-9 rounded-full shrink-0">
                      {selectedRequest.user.avatarUrl && <AvatarImage src={selectedRequest.user.avatarUrl} alt={selectedRequest.user.name} className="object-cover rounded-full" />}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold flex items-center justify-center size-full">
                        {getInitials(selectedRequest.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-bold text-foreground text-xs">{selectedRequest.user.name}</h4>
                      <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                        {selectedRequest.user.designation} • {selectedRequest.user.department?.name || "Global Department"}
                      </p>
                    </div>
                  </div>

                  {/* Grid details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="bg-muted/10 p-3 rounded-md border border-border/50">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Timeline
                      </span>
                      <p className="font-bold text-foreground text-xs">
                        {format(new Date(selectedRequest.startDate), "dd MMM yyyy")} -{" "}
                        {format(new Date(selectedRequest.endDate), "dd MMM yyyy")}
                      </p>
                    </div>

                    <div className="bg-muted/10 p-3 rounded-md border border-border/50">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Duration
                      </span>
                      <p className="font-bold text-foreground text-xs">
                        {getFormattedDuration(selectedRequest, differenceInCalendarDays(new Date(selectedRequest.endDate), new Date(selectedRequest.startDate)) + 1)}
                      </p>
                    </div>

                    <div className="bg-muted/10 p-3 rounded-md border border-border/50">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Leave Policy
                      </span>
                      <p className="font-bold text-foreground text-xs">{getCategoryLabel(selectedRequest.category)}</p>
                    </div>

                    <div className="bg-muted/10 p-3 rounded-md border border-border/50">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Status
                      </span>
                      <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-bold inline-block", getStatusColor(selectedRequest.status))}>
                        {selectedRequest.status}
                      </span>
                    </div>
                  </div>

                  {/* Leave Reason */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-foreground">
                      Applicant Reason
                    </span>
                    <p className="bg-muted/20 border border-border/60 rounded-md p-3 font-medium text-foreground/80 leading-relaxed italic">
                      "{selectedRequest.reason || "No reason provided for this request."}"
                    </p>
                  </div>

                  {/* Manager notes */}
                  {actionType ? (
                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-semibold text-foreground">
                        Manager Remarks / Feedback (Optional)
                      </label>
                      <Textarea
                        placeholder="Enter approval conditions, hand-off notes, or rejection feedback..."
                        value={managerNote}
                        onChange={(e) => setManagerNote(e.target.value)}
                        className="text-xs bg-background min-h-[80px] rounded-md border-border/80 focus:ring-primary/20 resize-none"
                      />
                    </div>
                  ) : selectedRequest.managerNote ? (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-xs font-semibold text-foreground">
                        Manager Remarks
                      </span>
                      <p className="bg-amber-500/10 border border-amber-500/20 text-foreground rounded-md p-3 leading-relaxed">
                        {selectedRequest.managerNote}
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* Dialog Footer Actions */}
                <div className="p-4 border-t border-border/60 bg-muted/20 shrink-0 flex items-center justify-end gap-2.5">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDetailsOpen(false);
                      setSelectedRequest(null);
                      setActionType(null);
                    }}
                    className="h-9 text-xs font-semibold rounded-md border-border/80 cursor-pointer"
                  >
                    Close
                  </Button>

                  {actionType && (
                    <Button
                      disabled={submitting}
                      onClick={handleSubmitAction}
                      className={cn(
                        "h-9 px-5 text-xs font-semibold rounded-md shadow-xs text-white cursor-pointer",
                        actionType === "APPROVE"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-rose-600 hover:bg-rose-700"
                      )}
                    >
                      {submitting
                        ? "Processing..."
                        : actionType === "APPROVE"
                          ? "Confirm Approval"
                          : "Confirm Rejection"}
                    </Button>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        <TabsContent value="overtime" className="m-0">
          <OvertimeRequestsTable data={initialOvertimeRequests} role={role} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
