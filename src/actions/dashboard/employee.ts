"use server"

import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTodayRange, getWeekRange } from "@/lib/attendance-helper"
import { ensureBalance } from "../leave/core"
import { processAutoPunchOuts } from "@/lib/auto-punch-out"
import { getUpcomingHolidays } from "../holiday"
import { getAnnouncements } from "../announcement"
import { getNotifications } from "../notification"
import { getDaysDifference } from "@/lib/utils"
import { appConfig } from "@/lib/app-config"

// --- Employee Dashboard Stats ---
export async function getEmployeeDashboardStats() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const userId = session.user.id;

  const [user] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        allowedMenus: true,
        autoPunchOutCount: true,
        departmentId: true,
        dateOfBirth: true,
        joiningDate: true,
        department: true,
        phoneNumber: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        emergencyContactRelation: true,
        minOfficeDays: true,
        workMode: true,
        departments: {
          select: {
            departmentId: true,
            isPrimary: true,
            isLeader: true,
            department: {
              select: {
                id: true,
                name: true,
                parentDepartmentId: true,
                teamLeaderId: true
              }
            }
          }
        },
        ledDepartments: {
          select: {
            id: true,
            name: true,
            parentDepartmentId: true,
            teamLeaderId: true
          }
        },
        location: {
          select: { id: true, name: true, lat: true, lng: true, radiusMeters: true, isRemote: true }
        },
        additionalLocations: {
          select: { id: true, name: true, lat: true, lng: true, radiusMeters: true, isRemote: true }
        },
      }
    }),
    processAutoPunchOuts(userId)
  ]);

  if (!user) return { success: false, error: "User profile not found." };

  const incompleteFields = [];
  if (!user.phoneNumber?.trim()) incompleteFields.push("Phone Number");
  if (!user.dateOfBirth) incompleteFields.push("Date of Birth");
  if (!user.emergencyContactName?.trim()) incompleteFields.push("Emergency Contact Name");
  if (!user.emergencyContactPhone?.trim()) incompleteFields.push("Emergency Contact Phone");
  if (!user.emergencyContactRelation?.trim()) incompleteFields.push("Emergency Contact Relation");

  const isProfileIncomplete = incompleteFields.length > 0;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const { start, end } = getTodayRange();
  const { start: today, end: tomorrow } = getTodayRange();
  const startOfThisMonth = new Date(currentYear, currentMonth - 1, 1);
  const endOfThisMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
  const startOfThisYear = new Date(currentYear, 0, 1);

  const directDeptIds = new Set<string>();
  if (user.departmentId) directDeptIds.add(user.departmentId);
  user.departments?.forEach((ud: any) => {
    if (ud.departmentId) directDeptIds.add(ud.departmentId);
  });
  user.ledDepartments?.forEach((ld: any) => {
    if (ld.id) directDeptIds.add(ld.id);
  });

  // Run all independent queries concurrently in parallel
  const [
    rawBalances,
    todaysLog,
    leaveRequests,
    onLeave,
    relatedDepts,
    allEmps,
    currentMonthAutoPunchOuts,
    holidaysRes,
    announcementsRes,
    notificationsRes,
    policies,
    todos,
    completedOfficeDaysCount,
    deptLateStats
  ] = await Promise.all([
    ensureBalance(userId, currentMonth, currentYear).catch(() => null),
    prisma.attendance.findFirst({
      where: { userId, date: { gte: start, lte: end } }
    }),
    prisma.leaveRequest.findMany({
      where: { userId, endDate: { gte: startOfThisYear } },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: today },
        endDate: { gte: today },
        user: {
          id: { not: userId },
          status: "ACTIVE",
          OR: [
            { departmentId: user.departmentId },
            { managerId: userId },
          ]
        }
      },
      include: {
        user: {
          include: {
            department: true,
            manager: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 10
    }),
    directDeptIds.size > 0 ? prisma.department.findMany({
      where: {
        OR: [
          { id: { in: Array.from(directDeptIds) } },
          { parentDepartmentId: { in: Array.from(directDeptIds) } },
          { subDepartments: { some: { id: { in: Array.from(directDeptIds) } } } }
        ]
      },
      include: {
        parentDepartment: { select: { id: true, name: true } },
        subDepartments: { select: { id: true, name: true } },
        members: {
          where: {
            status: "ACTIVE"
          },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            designation: true,
            departmentId: true,
            status: true,
            attendances: {
              where: { date: { gte: today, lte: tomorrow } },
              take: 1
            },
            leaveRequests: {
              where: {
                status: "APPROVED",
                startDate: { lte: today },
                endDate: { gte: today }
              },
              take: 1
            }
          }
        },
        userDepartments: {
          where: {
            user: {
              status: "ACTIVE"
            }
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                designation: true,
                departmentId: true,
                status: true,
                attendances: {
                  where: { date: { gte: today, lte: tomorrow } },
                  take: 1
                },
                leaveRequests: {
                  where: {
                    status: "APPROVED",
                    startDate: { lte: today },
                    endDate: { gte: today }
                  },
                  take: 1
                }
              }
            }
          }
        }
      },
      orderBy: { name: "asc" }
    }) : Promise.resolve([]),
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        ...(user.tenantId ? { tenantId: user.tenantId } : {}),
        NOT: [
          { email: { in: [appConfig.devAdminEmail, "dev@sigma.com"] } },
          { roleDefinition: { code: "SYSTEM_ADMIN" } }
        ]
      },
      select: { name: true, dateOfBirth: true, joiningDate: true }
    }),
    prisma.attendance.count({
      where: {
        userId,
        date: { gte: startOfThisMonth, lte: endOfThisMonth },
        isAutoPunchOut: true
      }
    }),
    getUpcomingHolidays(10),
    getAnnouncements(user.departmentId || undefined),
    getNotifications(20),
    prisma.policy.findMany({ take: 5, orderBy: { order: 'asc' } }),
    prisma.todo.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    }),
    user.workMode === "HYBRID" ? prisma.attendance.count({
      where: {
        userId,
        date: { gte: getWeekRange().start, lte: getWeekRange().end },
        isOutsideOffice: false
      }
    }) : Promise.resolve(0),
    // Lightweight targeted selection for department late patterns
    prisma.attendance.findMany({
      where: {
        date: { gte: startOfThisMonth, lte: endOfThisMonth },
        user: { role: { not: "ADMIN" } }
      },
      select: {
        isLate: true,
        user: { select: { department: { select: { name: true } } } }
      }
    })
  ]);

  const deptLateMap = new Map<string, { name: string; totalPunches: number; latePunches: number }>();
  deptLateStats.forEach((record) => {
    const deptName = record.user?.department?.name || "Unassigned";
    const stats = deptLateMap.get(deptName) || { name: deptName, totalPunches: 0, latePunches: 0 };
    stats.totalPunches += 1;
    if (record.isLate) {
      stats.latePunches += 1;
    }
    deptLateMap.set(deptName, stats);
  });
  const departmentLatePatterns = Array.from(deptLateMap.values()).map(d => ({
    name: d.name,
    lateRate: d.totalPunches > 0 ? Math.round((d.latePunches / d.totalPunches) * 100) : 0,
    total: d.totalPunches,
    late: d.latePunches,
  })).sort((a, b) => b.lateRate - a.lateRate);

  const balances = rawBalances || {
    remainingFull: 0,
    semiAnnualRemaining: 0,
    casualTaken: 0,
    medicalTaken: 0,
    semiAnnualTaken: 0,
    unpaidTaken: 0
  };

  let sessionStatus: "PENDING" | "PUNCHED_IN" | "PUNCHED_OUT" = "PENDING";
  if (todaysLog) {
    sessionStatus = todaysLog.punchOut ? "PUNCHED_OUT" : "PUNCHED_IN";
  }

  const approvedThisYear = leaveRequests.filter(
    (r) => r.status === "APPROVED" && new Date(r.startDate).getFullYear() === currentYear
  );

  const casualTaken = approvedThisYear
    .filter((r) => r.category === "MONTHLY_POLICY_1" && r.leaveType === "CASUAL" && r.duration !== "SHORT")
    .reduce((acc, r) => acc + getDaysDifference(new Date(r.startDate), new Date(r.endDate)) * (r.duration === "HALF" ? 0.5 : 1), 0);

  const medicalTaken = approvedThisYear
    .filter((r) => r.category === "MONTHLY_POLICY_1" && r.leaveType === "MEDICAL" && r.duration !== "SHORT")
    .reduce((acc, r) => acc + getDaysDifference(new Date(r.startDate), new Date(r.endDate)) * (r.duration === "HALF" ? 0.5 : 1), 0);

  const semiAnnualTaken = approvedThisYear
    .filter((r) => r.category === "SEMI_ANNUAL_POLICY_2")
    .reduce((acc, r) => acc + getDaysDifference(new Date(r.startDate), new Date(r.endDate)), 0);

  const approvalRate = leaveRequests.length > 0
    ? Math.round((leaveRequests.filter((r) => r.status === "APPROVED").length / leaveRequests.length) * 100)
    : 100;

  const pendingCount = leaveRequests.filter(r => r.status === "PENDING").length;

  const teamOnLeave = onLeave
    .slice(0, 5)
    .map((l) => ({
      id: l.user.id,
      name: l.user.name || "Unknown",
      role: l.user.department?.name || "Team Member",
      avatarUrl: (l.user as any).avatarUrl || null,
      startDate: l.startDate,
      endDate: l.endDate,
      duration: l.duration,
      halfDayType: l.halfDayType,
      leaveType: l.duration === "SHORT" ? "Short Leave" : (l.leaveType || (l.category === "UNPAID" ? "Unpaid" : "Paid"))
    }));

  const teamPresenceGroups = (relatedDepts as any[]).map(dept => {
    const isDirect = directDeptIds.has(dept.id);
    const isLed = dept.teamLeaderId === userId;
    const isSubDept = Boolean(dept.parentDepartmentId && directDeptIds.has(dept.parentDepartmentId));
    const isParentDept = dept.subDepartments && dept.subDepartments.some((s: any) => directDeptIds.has(s.id));

    let roleBadge = "Department";
    if (isLed) roleBadge = "Led by You";
    else if (dept.id === user.departmentId) roleBadge = "Primary";
    else if (isDirect) roleBadge = "Assigned";
    else if (isSubDept) roleBadge = `Sub-Dept of ${dept.parentDepartment?.name || "Parent"}`;
    else if (isParentDept) roleBadge = "Parent Department";

    // Collect & deduplicate members (strictly active users, hiding inactive and resigned employees)
    const memberMap = new Map<string, any>();
    dept.members?.forEach((m: any) => {
      if (!m.status || m.status === "ACTIVE") {
        memberMap.set(m.id, m);
      }
    });
    dept.userDepartments?.forEach((ud: any) => {
      if (ud.user && (!ud.user.status || ud.user.status === "ACTIVE")) {
        memberMap.set(ud.user.id, ud.user);
      }
    });

    // Always ensure current user (Self) is present in their direct/led departments (if active)
    if ((isDirect || isLed) && !memberMap.has(userId) && (!user.status || user.status === "ACTIVE")) {
      memberMap.set(userId, {
        id: user.id,
        name: user.name || "You",
        avatarUrl: (user as any).avatarUrl || null,
        designation: (user as any).designation || "Member",
        status: user.status || "ACTIVE",
        attendances: todaysLog ? [todaysLog] : [],
        leaveRequests: []
      });
    }

    const members = Array.from(memberMap.values()).map((m: any) => {
      let status: "active" | "outside" | "leave" | "offline" = "offline";
      if (m.leaveRequests && m.leaveRequests.length > 0) {
        status = "leave";
      } else if (m.attendances && m.attendances.length > 0) {
        const att = m.attendances[0];
        status = att.punchOut ? "offline" : att.isOutsideOffice ? "outside" : "active";
      }

      return {
        id: m.id,
        name: m.id === userId ? (m.name ? `${m.name} (You)` : "You") : (m.name || "Teammate"),
        avatarUrl: m.avatarUrl || null,
        designation: m.designation || "Member",
        status,
        isSelf: m.id === userId,
        isLeader: m.id === dept.teamLeaderId,
        departmentName: dept.name
      };
    });

    // Sort: Self first, then Team Leader, then alphabetically by name
    members.sort((a, b) => {
      if (a.isSelf) return -1;
      if (b.isSelf) return 1;
      if (a.isLeader) return -1;
      if (b.isLeader) return 1;
      return a.name.localeCompare(b.name);
    });

    return {
      departmentId: dept.id,
      departmentName: dept.name,
      roleBadge,
      isDirect,
      isLed,
      members
    };
  });

  // Flattened deduplicated list for backwards compatibility
  const allPresenceMembersMap = new Map<string, any>();
  teamPresenceGroups.forEach(g => {
    g.members.forEach(m => {
      if (!allPresenceMembersMap.has(m.id)) {
        allPresenceMembersMap.set(m.id, m);
      }
    });
  });
  const teamAvailability = Array.from(allPresenceMembersMap.values());

  const now = new Date();
  const upcomingBirthdays = allEmps
    .filter(e => e.dateOfBirth)
    .map(e => {
      const dob = new Date(e.dateOfBirth!);
      let bday = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
      if (bday < now) bday = new Date(now.getFullYear() + 1, dob.getMonth(), dob.getDate());
      return { name: e.name, date: bday };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);

  const upcomingAnniversaries = allEmps
    .filter(e => e.joiningDate)
    .map(e => {
      const jd = new Date(e.joiningDate!);
      let anniv = new Date(now.getFullYear(), jd.getMonth(), jd.getDate());
      if (anniv < now) anniv = new Date(now.getFullYear() + 1, jd.getMonth(), jd.getDate());
      const years = anniv.getFullYear() - jd.getFullYear();
      return { name: e.name, date: anniv, years };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);

  // Office locations for geo map
  const officeLocations: { name: string; lat: number; lng: number; radiusMeters: number }[] = [];
  if (user?.location && !user.location.isRemote && user.location.lat != null && user.location.lng != null) {
    officeLocations.push({
      name: user.location.name,
      lat: user.location.lat,
      lng: user.location.lng,
      radiusMeters: user.location.radiusMeters,
    });
  }
  if ((user as any)?.additionalLocations) {
    (user as any).additionalLocations.forEach((loc: any) => {
      if (!loc.isRemote && loc.lat != null && loc.lng != null) {
        officeLocations.push({
          name: loc.name,
          lat: loc.lat,
          lng: loc.lng,
          radiusMeters: loc.radiusMeters,
        });
      }
    });
  }

  // Fallback to system locations if employee has no specific locations assigned
  if (officeLocations.length === 0 && user?.workMode !== "REMOTE") {
    const defaultLocs = await prisma.location.findMany({
      where: { isRemote: false, lat: { not: null }, lng: { not: null } }
    });
    defaultLocs.forEach(loc => {
      officeLocations.push({
        name: loc.name,
        lat: loc.lat!,
        lng: loc.lng!,
        radiusMeters: loc.radiusMeters,
      });
    });
  }

  const officeLocation = officeLocations[0] || null;

  return {
    success: true,
    data: {
      userName: user?.name || "Employee",
      userRole: user?.role || "EMPLOYEE",
      userAllowedMenus: user?.allowedMenus || [],
      sessionStatus,
      punchInTime: todaysLog?.punchIn ? todaysLog.punchIn : null,
      autoPunchOutCount: currentMonthAutoPunchOuts,
      officeLocation,
      officeLocations,
      balances: {
        casualTaken,
        medicalTaken,
        semiAnnualTaken,
        casualRemaining: Number(balances.remainingFull || 0),
        earnedRemaining: Number(balances.semiAnnualRemaining || 0),
        casualYearlyTaken: casualTaken,
        sickYearlyTaken: medicalTaken,
        earnedYearlyTaken: semiAnnualTaken,
        casualYearlyTotal: 12,
        sickYearlyTotal: 12,
        earnedYearlyTotal: 3, // Per cycle
      },
      stats: {
        approvalRate,
        pendingCount,
        upcomingBirthdays,
        upcomingAnniversaries
      },
      leaveRequests,
      teamOnLeave: teamOnLeave,
      holidays: holidaysRes.data || [],
      announcements: announcementsRes.data || [],
      notifications: notificationsRes.data || [],
      policies,
      isProfileIncomplete,
      incompleteFields,
      departmentLatePatterns,
      hybridStats: user.workMode === "HYBRID" ? {
        minOfficeDays: user.minOfficeDays,
        completedOfficeDays: completedOfficeDaysCount
      } : null,
      teamAvailability,
      teamPresenceGroups,
      todos
    }
  };
}

