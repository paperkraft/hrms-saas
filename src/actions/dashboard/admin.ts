"use server"

import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWeekRange } from "@/lib/attendance-helper"
import { getUpcomingHolidays } from "../holiday"
import { getAllAnnouncementsForAdmin } from "../announcement"
import { getNotifications } from "../notification"
import { getDaysDifference } from "@/lib/utils"
import { hasMenuAccess } from "@/lib/permissions"
import { appConfig } from "@/lib/app-config"
import { getPayrollEligibleUserWhere } from "@/lib/payroll-helper"

// --- Admin Dashboard Stats ---
export interface LocationStat {
  id: string;
  name: string;
  totalEmployees: number;
  presentCount: number;
  attendanceRate: number;
  isRemote: boolean;
}

export async function getAdminDashboardStats(reqDate?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const isPermitted = hasMenuAccess(
    session.user,
    "/dashboard/admin",
    "/dashboard/accountant/location-logs",
    "/dashboard/accountant",
    "/dashboard/admin/reports",
    "/dashboard/attendance",
    "/dashboard/leaves/manage"
  );

  if (!isPermitted) {
    // Fresh DB lookup fallback in case session JWT has not yet refreshed
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        role: true,
        allowedMenus: true,
        roleDefinition: {
          select: { code: true, allowedMenus: true }
        }
      }
    });

    const combinedMenus = Array.from(new Set([
      ...(dbUser?.allowedMenus || []),
      ...(dbUser?.roleDefinition?.allowedMenus || [])
    ]));

    const freshUser = {
      role: dbUser?.roleDefinition?.code || dbUser?.role,
      allowedMenus: combinedMenus
    };

    if (!hasMenuAccess(freshUser, "/dashboard/admin", "/dashboard/accountant/location-logs", "/dashboard/accountant", "/dashboard/admin/reports", "/dashboard/attendance", "/dashboard/leaves/manage")) {
      throw new Error("Unauthorized");
    }
  }

  let now: Date;
  if (reqDate) {
    const [y, m, d] = reqDate.split('-').map(Number);
    now = new Date(Date.UTC(y, m - 1, d));
  } else {
    now = new Date();
  }
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();
  const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
  const endOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59));

  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  const { start: weekStart, end: weekEnd } = getWeekRange();

  // Run all independent queries concurrently in parallel
  const [
    allPendingRequests,
    staff,
    todayAttendance,
    todayLeaves,
    weeklyOfficeAttendances,
    rawLocations,
    todos,
    holidaysRes,
    announcementsRes,
    notificationsRes,
    policies,
    milestoneUsers
  ] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { status: "PENDING" },
      include: { user: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.user.findMany({
      where: getPayrollEligibleUserWhere(),
      include: {
        department: true,
        roleDefinition: true,
        location: true,
        manager: { select: { name: true } },
        departments: { include: { department: true } },
        leaveRequests: {
          where: {
            status: "APPROVED",
            startDate: { gte: startOfMonth, lte: endOfMonth }
          }
        }
      }
    }),
    prisma.attendance.findMany({
      where: { date: { gte: startOfDay, lte: endOfDay } }
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: startOfDay },
        endDate: { gte: startOfDay }
      },
      include: {
        user: {
          include: {
            department: true,
            roleDefinition: true,
            location: true,
            manager: { select: { name: true } },
            departments: { include: { department: true } },
          }
        }
      }
    }),
    prisma.attendance.findMany({
      where: {
        date: { gte: weekStart, lte: weekEnd },
        isOutsideOffice: false
      },
      select: { userId: true }
    }),
    prisma.location.findMany({
      include: {
        users: {
          where: getPayrollEligibleUserWhere(),
          select: { id: true }
        }
      }
    }),
    prisma.todo.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    getUpcomingHolidays(10),
    getAllAnnouncementsForAdmin(),
    getNotifications(20),
    prisma.policy.findMany({
      where: session.user.tenantId
        ? {
            OR: [{ tenantId: session.user.tenantId }, { tenantId: null }],
          }
        : undefined,
      take: 5,
      orderBy: { order: "asc" },
    }),
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        ...(session.user.tenantId ? { tenantId: session.user.tenantId } : {}),
        NOT: [
          { email: { in: [appConfig.devAdminEmail, "dev@sigma.com"] } },
          { roleDefinition: { code: "SYSTEM_ADMIN" } }
        ]
      },
      select: { name: true, dateOfBirth: true, joiningDate: true }
    })
  ]);

  const totalEmployees = staff.length;

  const presentIds = new Set(todayAttendance.map(a => a.userId));
  const onLeaveIds = new Set(todayLeaves.map(l => l.userId));

  const presentEmployees = staff.filter(s => presentIds.has(s.id));
  const absentEmployees = staff.filter(s => !presentIds.has(s.id) && !onLeaveIds.has(s.id));

  const attendanceRate = staff.length > 0 ? Math.round((presentEmployees.length / staff.length) * 100) : 100;

  const officeDaysCountMap: Record<string, number> = {};
  weeklyOfficeAttendances.forEach(a => {
    officeDaysCountMap[a.userId] = (officeDaysCountMap[a.userId] || 0) + 1;
  });

  const locationStats: LocationStat[] = rawLocations.map(loc => {
    const total = loc.users.length;
    if (total === 0) return null;
    const presentCount = loc.users.filter(m => presentIds.has(m.id)).length;
    return {
      id: loc.id,
      name: loc.name,
      totalEmployees: total,
      presentCount,
      attendanceRate: Math.round((presentCount / total) * 100),
      isRemote: loc.isRemote
    };
  }).filter((l): l is LocationStat => l !== null)
    .sort((a, b) => b.attendanceRate - a.attendanceRate);

  const monthlyLeaveSummary = staff.map(s => {
    let totalDays = 0;
    s.leaveRequests.forEach(req => {
      if (req.duration !== "SHORT") {
        const diff = getDaysDifference(req.startDate, req.endDate);
        totalDays += req.duration === "HALF" ? diff * 0.5 : diff;
      }
    });
    return { id: s.id, name: s.name || s.email, avatarUrl: (s as any).avatarUrl || null, totalDays };
  }).sort((a, b) => b.totalDays - a.totalDays);

  // Event Calculations
  const upcomingBirthdays = milestoneUsers
    .filter(e => e.dateOfBirth)
    .map(e => {
      const dob = new Date(e.dateOfBirth!);
      let bday = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
      if (bday < now) bday = new Date(now.getFullYear() + 1, dob.getMonth(), dob.getDate());
      return { name: e.name, date: bday };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);

  const upcomingAnniversaries = milestoneUsers
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

  const todayAttendanceMap = new Map(todayAttendance.map(a => [a.userId, a]));
  const todayLeavesMap = new Map(todayLeaves.map(l => [l.userId, l]));

  return {
    success: true,
    data: {
      totalEmployees,
      userRole: session.user.role,
      pendingCount: allPendingRequests.length,
      attendanceRate,
      date: reqDate || null,
      presentEmployees: presentEmployees.map(e => {
        const log = todayAttendanceMap.get(e.id);
        const leave = todayLeavesMap.get(e.id);
        let totalHours = 0;
        if (log?.punchIn) {
          const end = log.punchOut ? new Date(log.punchOut) : new Date();
          totalHours = (end.getTime() - new Date(log.punchIn).getTime()) / (1000 * 60 * 60);
        }
        return {
          id: e.id,
          name: e.name || e.email,
          email: e.email,
          designation: e.designation,
          avatarUrl: (e as any).avatarUrl || null,
          phoneNumber: e.phoneNumber,
          joiningDate: e.joiningDate,
          dateOfBirth: e.dateOfBirth,
          emergencyContactName: e.emergencyContactName,
          emergencyContactPhone: e.emergencyContactPhone,
          emergencyContactRelation: e.emergencyContactRelation,
          bloodGroup: e.bloodGroup,
          department: e.department?.name || "Team Member",
          status: e.status || "ACTIVE",
          employmentStatus: e.status || "ACTIVE",
          role: e.role,
          roleDefinition: (e as any).roleDefinition,
          location: (e as any).location,
          manager: (e as any).manager,
          departments: (e as any).departments,
          punchIn: log?.punchIn,
          punchOut: log?.punchOut,
          isLate: log?.isLate || false,
          isHalfDay: log?.isHalfDay || false,
          isOutsideOffice: log?.isOutsideOffice || false,
          totalHours: totalHours > 0 ? Number(totalHours.toFixed(1)) : undefined,
          punchInLat: log?.punchInLat,
          punchInLng: log?.punchInLng,
          punchOutLat: log?.punchOutLat,
          punchOutLng: log?.punchOutLng,
          workMode: e.workMode,
          hybridStats: e.workMode === "HYBRID" ? {
            minOfficeDays: (e as any).minOfficeDays,
            completedOfficeDays: officeDaysCountMap[e.id] || 0
          } : null,
          partialLeave: leave ? {
            duration: leave.duration,
            halfDayType: leave.halfDayType,
            startTime: leave.startTime,
            endTime: leave.endTime
          } : null
        };
      }),
      absentEmployees: absentEmployees.map(e => ({
        id: e.id,
        name: e.name || e.email,
        email: e.email,
        designation: e.designation,
        avatarUrl: (e as any).avatarUrl || null,
        phoneNumber: e.phoneNumber,
        joiningDate: e.joiningDate,
        dateOfBirth: e.dateOfBirth,
        emergencyContactName: e.emergencyContactName,
        emergencyContactPhone: e.emergencyContactPhone,
        emergencyContactRelation: e.emergencyContactRelation,
        bloodGroup: e.bloodGroup,
        department: e.department?.name || "Team Member",
        status: e.status || "ACTIVE",
        employmentStatus: e.status || "ACTIVE",
        role: e.role,
        roleDefinition: (e as any).roleDefinition,
        location: (e as any).location,
        manager: (e as any).manager,
        departments: (e as any).departments,
        workMode: e.workMode,
        hybridStats: e.workMode === "HYBRID" ? {
          minOfficeDays: (e as any).minOfficeDays,
          completedOfficeDays: officeDaysCountMap[e.id] || 0
        } : null
      })),
      onLeaveEmployees: (() => {
        const map = new Map<string, any>();
        todayLeaves.forEach(l => {
          if (!map.has(l.user.id)) {
            map.set(l.user.id, {
              id: l.user.id,
              name: l.user.name || l.user.email,
              email: l.user.email,
              designation: l.user.designation,
              avatarUrl: (l.user as any).avatarUrl || null,
              phoneNumber: l.user.phoneNumber,
              joiningDate: l.user.joiningDate,
              dateOfBirth: l.user.dateOfBirth,
              emergencyContactName: l.user.emergencyContactName,
              emergencyContactPhone: l.user.emergencyContactPhone,
              emergencyContactRelation: l.user.emergencyContactRelation,
              bloodGroup: l.user.bloodGroup,
              department: l.user.department?.name || "Team Member",
              status: l.user.status || "ACTIVE",
              employmentStatus: l.user.status || "ACTIVE",
              role: l.user.role,
              roleDefinition: (l.user as any).roleDefinition,
              location: (l.user as any).location,
              manager: (l.user as any).manager,
              departments: (l.user as any).departments,
              leaveType: l.duration === "SHORT" ? "Short Leave" : (l.leaveType || (l.category === "UNPAID" ? "Unpaid" : "Paid")),
              duration: l.duration,
              halfDayType: l.halfDayType,
              startTime: l.startTime,
              endTime: l.endTime,
              startDate: l.startDate,
              endDate: l.endDate,
              workMode: l.user.workMode,
              hybridStats: l.user.workMode === "HYBRID" ? {
                minOfficeDays: (l.user as any).minOfficeDays,
                completedOfficeDays: officeDaysCountMap[l.user.id] || 0
              } : null
            });
          }
        });
        return Array.from(map.values());
      })(),
      monthlyLeaveSummary,
      holidays: holidaysRes.data || [],
      upcomingBirthdays,
      upcomingAnniversaries,
      teamOnLeave: todayLeaves.map(l => ({
        id: l.user.id,
        name: l.user.name || "Unknown",
        role: l.user.department?.name || "Team Member",
        avatarUrl: (l.user as any).avatarUrl || null,
        startDate: l.startDate,
        endDate: l.endDate,
        duration: l.duration,
        halfDayType: l.halfDayType,
        leaveType: l.category === "UNPAID" ? "Unpaid" : "Paid"
      })),
      announcements: announcementsRes.data || [],
      notifications: notificationsRes.data || [],
      policies,
      allPendingRequests: allPendingRequests.map((req: any) => ({
        id: req.id,
        employeeName: req.user.name || req.user.email,
        role: req.user.role,
        startDate: new Date(req.startDate).toISOString().split('T')[0],
        endDate: new Date(req.endDate).toISOString().split('T')[0],
        duration: req.duration,
        halfDayType: req.halfDayType,
        category: req.category,
        reason: req.reason || "No reason provided",
      })),
      locationStats,
      todos,
    }
  };
}

