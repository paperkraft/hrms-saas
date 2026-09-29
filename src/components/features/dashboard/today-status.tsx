"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  MapPin,
  Clock,
  Building2,
  Calendar,
} from "lucide-react";
import {
  Input,
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui";
import { cn, getInitials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { EmployeeDetailsDialog } from "@/components/features/admin/employee-details-dialog";

function StatusBadge({ status, partialLeave }: { status: "Present" | "Late" | "Absent" | "Leave" | "WFH" | string; partialLeave?: any }) {
  let displayStatus = status;
  let variantClass = "text-muted-foreground bg-muted border-border/60";

  if (status === "Present") {
    variantClass = "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/25";
    if (partialLeave) displayStatus = `Present (${partialLeave.duration === "HALF" ? "Half Day" : "Short"})`;
  } else if (status === "Late") {
    variantClass = "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/25";
    if (partialLeave) displayStatus = `Late (${partialLeave.duration === "HALF" ? "Half Day" : "Short"})`;
  } else if (status === "Absent") {
    variantClass = "text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/25";
  } else if (status === "Leave") {
    variantClass = "text-purple-700 dark:text-purple-300 bg-purple-500/10 border-purple-500/25";
    if (partialLeave) {
      displayStatus = partialLeave.duration === "HALF" ? "Half Day Leave" : partialLeave.duration === "SHORT" ? "Short Leave" : "On Leave";
    } else {
      displayStatus = "On Leave";
    }
  }

  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-bold px-2 py-0.5 rounded-sm gap-1 uppercase tracking-tight", variantClass)}
    >
      <span className="size-1.5 rounded-full bg-current shrink-0" />
      <span>{displayStatus}</span>
    </Badge>
  );
}

interface EmployeeStatus {
  id: string;
  name: string;
  email?: string;
  designation?: string;
  phoneNumber?: string;
  joiningDate?: string | Date;
  dateOfBirth?: string | Date;
  department: string;
  status: "Present" | "Late" | "Absent" | "Leave";
  employmentStatus?: string;
  role?: string;
  roleDefinition?: any;
  location?: any;
  manager?: any;
  departments?: any[];
  punchIn?: string;
  punchOut?: string;
  totalHours?: number;
  isOutsideOffice?: boolean;
  punchInLat?: number;
  punchInLng?: number;
  punchOutLat?: number;
  punchOutLng?: number;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  bloodGroup?: string;
  workMode?: string;
  hybridStats?: { minOfficeDays: number; completedOfficeDays: number } | null;
  avatarUrl?: string | null;
  partialLeave?: { duration: string; halfDayType: string | null; startTime: string | null; endTime: string | null } | null;
}

interface TodayStatusProps {
  presentEmployees: any[];
  absentEmployees: any[];
  onLeaveEmployees: any[];
}

export function TodayStatus({
  presentEmployees,
  absentEmployees,
  onLeaveEmployees,
}: TodayStatusProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"All" | "Present" | "Late" | "Absent" | "Leave">("All");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 8;

  const handleViewProfile = (employee: EmployeeStatus) => {
    setSelectedEmployee({
      ...employee,
      status: employee.employmentStatus || "ACTIVE",
    });
    setIsDialogOpen(true);
  };

  const allData = useMemo(() => {
    const data: EmployeeStatus[] = [];

    // Process Present & Late
    presentEmployees.forEach((e) => {
      let status: "Present" | "Late" = "Present";
      if (e.isLate) {
        status = e.isLateSpecialCase ? "Present" : "Late";
      }

      data.push({
        id: e.id,
        name: e.name,
        email: e.email,
        designation: e.designation,
        phoneNumber: e.phoneNumber,
        joiningDate: e.joiningDate,
        dateOfBirth: e.dateOfBirth,
        department: e.department,
        status: status,
        employmentStatus: e.employmentStatus || e.status || "ACTIVE",
        role: e.role,
        roleDefinition: e.roleDefinition,
        location: e.location,
        manager: e.manager,
        departments: e.departments,
        punchIn: e.punchIn ? new Date(e.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase() : undefined,
        punchOut: e.punchOut ? new Date(e.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase() : "In Progress",
        totalHours: e.totalHours,
        isOutsideOffice: e.isOutsideOffice,
        punchInLat: e.punchInLat,
        punchInLng: e.punchInLng,
        punchOutLat: e.punchOutLat,
        punchOutLng: e.punchOutLng,
        emergencyContactName: e.emergencyContactName,
        emergencyContactPhone: e.emergencyContactPhone,
        emergencyContactRelation: e.emergencyContactRelation,
        bloodGroup: e.bloodGroup,
        workMode: (e as any).workMode,
        hybridStats: (e as any).hybridStats,
        avatarUrl: e.avatarUrl,
        partialLeave: (e as any).partialLeave,
      });
    });

    // Process Absent
    absentEmployees.forEach((e) => {
      data.push({
        id: e.id,
        name: e.name,
        email: e.email,
        designation: e.designation,
        phoneNumber: e.phoneNumber,
        joiningDate: e.joiningDate,
        dateOfBirth: e.dateOfBirth,
        department: e.department,
        status: "Absent",
        employmentStatus: e.employmentStatus || e.status || "ACTIVE",
        role: e.role,
        roleDefinition: e.roleDefinition,
        location: e.location,
        manager: e.manager,
        departments: e.departments,
        emergencyContactName: e.emergencyContactName,
        emergencyContactPhone: e.emergencyContactPhone,
        emergencyContactRelation: e.emergencyContactRelation,
        bloodGroup: e.bloodGroup,
        workMode: (e as any).workMode,
        hybridStats: (e as any).hybridStats,
        avatarUrl: e.avatarUrl,
      });
    });

    // Process Leave
    onLeaveEmployees.forEach((e) => {
      if (data.some((existing) => existing.id === e.id)) return;

      data.push({
        id: e.id,
        name: e.name,
        email: e.email,
        designation: e.designation,
        phoneNumber: e.phoneNumber,
        joiningDate: e.joiningDate,
        dateOfBirth: e.dateOfBirth,
        department: e.department,
        status: "Leave",
        employmentStatus: e.employmentStatus || e.status || "ACTIVE",
        role: e.role,
        roleDefinition: e.roleDefinition,
        location: e.location,
        manager: e.manager,
        departments: e.departments,
        emergencyContactName: e.emergencyContactName,
        emergencyContactPhone: e.emergencyContactPhone,
        emergencyContactRelation: e.emergencyContactRelation,
        bloodGroup: e.bloodGroup,
        workMode: (e as any).workMode,
        hybridStats: (e as any).hybridStats,
        avatarUrl: e.avatarUrl,
        partialLeave: { duration: e.duration, halfDayType: e.halfDayType, startTime: e.startTime, endTime: e.endTime },
      });
    });

    const seen = new Set<string>();
    const uniqueData: EmployeeStatus[] = [];
    data.forEach((item) => {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        uniqueData.push(item);
      }
    });

    return uniqueData.sort((a, b) => a.name.localeCompare(b.name));
  }, [presentEmployees, absentEmployees, onLeaveEmployees]);

  const filteredData = useMemo(() => {
    return allData.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.department.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesFilter = filter === "All" || item.status === filter;
      if (filter === "Present") {
        matchesFilter = item.status === "Present" || item.status === "Late";
      }

      return matchesSearch && matchesFilter;
    });
  }, [allData, searchQuery, filter]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  return (
    <>
      <div className="bg-card border border-border/80 rounded-md overflow-hidden flex flex-col shadow-2xs">
        {/* Title Header */}
        <div className="px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-border/70 flex items-center justify-between bg-muted/20">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <UserIcon className="size-3.5 text-primary shrink-0" /> Today's Workforce Presence
              </h2>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                {allData.length} Staff
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5">
              Live attendance roster, check-in status, and real-time activity logs.
            </p>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="px-3.5 sm:px-5 py-2.5 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 bg-card border-b border-border/70">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by employee name, department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8.5 text-xs bg-background/80 border-border/70 focus:bg-background rounded-md w-full"
            />
          </div>

          <div className="flex bg-muted/40 p-1 rounded-md border border-border/70 overflow-x-auto scrollbar-none no-scrollbar shrink-0 gap-1 w-full sm:w-auto">
            {(["All", "Present", "Late", "Absent", "Leave"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "flex-1 sm:flex-initial px-2.5 sm:px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap text-center cursor-pointer",
                  filter === f
                    ? "bg-background text-primary shadow-xs border border-border/60 font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile List View */}
        <div className="block sm:hidden flex-1 overflow-y-auto max-h-[460px] divide-y divide-border/40">
          {paginatedData.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center text-muted-foreground gap-2">
              <UserIcon className="size-8 opacity-40" />
              <p className="text-xs font-semibold">No attendance records found</p>
            </div>
          ) : (
            paginatedData.map((item, idx) => (
              <div
                key={`today-mob-${item.id}-${idx}`}
                onClick={() => handleViewProfile(item)}
                className="px-3.5 sm:px-4 py-2.5 sm:py-3 hover:bg-muted/20 transition-colors cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar className="size-9 rounded-full shrink-0">
                    {item.avatarUrl && <AvatarImage src={item.avatarUrl} alt={item.name} className="object-cover rounded-full" />}
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold rounded-full">
                      {getInitials(item.name || "")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 truncate">
                    <span className="text-xs font-bold text-foreground truncate">{item.name}</span>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] sm:text-[11px] text-muted-foreground truncate">
                      {item.department && (
                        <>
                          <span className="truncate max-w-[85px] font-medium text-foreground/70">{item.department}</span>
                          <span>•</span>
                        </>
                      )}
                      <span className="shrink-0">{item.punchIn || "--:--"}</span>
                      <span className="shrink-0">—</span>
                      <span className="shrink-0">{item.punchOut === "In Progress" ? "Working" : item.punchOut || "--:--"}</span>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <StatusBadge status={item.status} partialLeave={item.partialLeave} />
                  <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                    {item.isOutsideOffice && (
                      <span className="text-[9px] font-bold text-rose-600 bg-rose-500/10 border border-rose-500/20 px-1 rounded">Outside</span>
                    )}
                    {item.totalHours ? <span className="font-bold">{item.totalHours}h</span> : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block flex-1 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-muted/40 border-b border-border/70 text-left">
              <tr>
                <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">Employee</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Department</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Punch In</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Punch Out</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground text-right pr-5">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="h-48 text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <UserIcon className="size-8 opacity-40" />
                      <p className="text-xs font-semibold">No attendance records found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, idx) => (
                  <tr
                    key={`today-desk-${item.id}-${idx}`}
                    onClick={() => handleViewProfile(item)}
                    className="group hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8 rounded-full shrink-0">
                          {item.avatarUrl && <AvatarImage src={item.avatarUrl} alt={item.name} className="object-cover rounded-full" />}
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold rounded-full">
                            {getInitials(item.name || "")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col truncate">
                          <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                            {item.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground truncate">
                            {item.designation || "Team Member"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-muted-foreground">{item.department}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} partialLeave={item.partialLeave} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-xs font-mono font-semibold", item.isOutsideOffice ? "text-rose-600 font-bold" : "text-foreground")}>
                          {item.punchIn || "--:--"}
                        </span>
                        {item.punchInLat && item.punchInLng && (
                          <a
                            href={`https://www.google.com/maps?q=${item.punchInLat},${item.punchInLng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:text-primary/80 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                            title="View punch-in location on map"
                          >
                            <MapPin className="size-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "text-xs font-mono font-semibold",
                            item.punchOut === "In Progress"
                              ? "text-muted-foreground/60 italic font-medium text-[11px]"
                              : item.isOutsideOffice
                                ? "text-rose-600 font-bold"
                                : "text-foreground"
                          )}
                        >
                          {item.punchOut || "--:--"}
                        </span>
                        {item.punchOutLat && item.punchOutLng && (
                          <a
                            href={`https://www.google.com/maps?q=${item.punchOutLat},${item.punchOutLng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:text-primary/80 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                            title="View punch-out location on map"
                          >
                            <MapPin className="size-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right pr-5">
                      <span className="text-xs font-mono font-bold text-foreground">
                        {item.totalHours ? `${item.totalHours}h` : "--"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredData.length > 0 && (
          <div className="px-5 py-3.5 border-t border-border/70 flex items-center justify-between bg-card text-xs text-muted-foreground">
            <div className="hidden sm:block text-xs font-medium">
              Showing <span className="font-bold text-foreground">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{" "}
              <span className="font-bold text-foreground">{Math.min(currentPage * PAGE_SIZE, filteredData.length)}</span> of{" "}
              <span className="font-bold text-foreground">{filteredData.length}</span> employees
            </div>

            <div className="flex items-center gap-1 mx-auto sm:mx-0">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="size-8 flex items-center justify-center rounded-md border border-border/70 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </button>

              <div className="flex items-center gap-1 mx-1.5">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                  if (totalPages > 5 && Math.abs(p - currentPage) > 1 && p !== 1 && p !== totalPages) {
                    if (p === 2 || p === totalPages - 1) return <span key={p} className="px-1 text-muted-foreground/40">...</span>;
                    return null;
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={cn(
                        "size-8 flex items-center justify-center rounded-md text-xs font-bold transition-all cursor-pointer",
                        currentPage === p
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="size-8 flex items-center justify-center rounded-md border border-border/70 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Profile Detail Modal */}
      <EmployeeDetailsDialog
        user={selectedEmployee}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        showAttendanceTimeline={true}
      />
    </>
  );
}
