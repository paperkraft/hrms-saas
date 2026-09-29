"use server"

import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { subDays, startOfDay, format, startOfMonth, endOfMonth } from "date-fns"
import { calculatePerformance, TaskForEngine, AttendanceForEngine, EmployeeForEngine, EngineConfig } from "./engine"
import { hasMenuAccess } from "@/lib/permissions"
import { getPayrollEligibleUserWhere } from "@/lib/payroll-helper"

export async function getAdminReportsData(reqMonth?: number, reqYear?: number, bypassAuth: boolean = false) {
  if (!bypassAuth) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const isPermitted = hasMenuAccess(
      session.user,
      "/dashboard/admin",
      "/dashboard/admin/reports",
      "/dashboard/accountant",
      "/dashboard/accountant/location-logs",
      "/dashboard/attendance"
    );

    if (!isPermitted) {
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

      if (!hasMenuAccess(freshUser, "/dashboard/admin", "/dashboard/admin/reports", "/dashboard/accountant", "/dashboard/accountant/location-logs", "/dashboard/attendance")) {
        throw new Error("Unauthorized");
      }
    }
  }

  const today = new Date();
  const currentYear = reqYear || today.getFullYear();
  const currentMonth = reqMonth || (today.getMonth() + 1);
  const isCurrentMonth = currentYear === today.getFullYear() && currentMonth === (today.getMonth() + 1);

  const targetDate = new Date(currentYear, currentMonth - 1, 1);
  const startOfThisMonth = startOfMonth(targetDate);
  const endOfThisMonth = endOfMonth(targetDate);

  const referenceDate = isCurrentMonth ? today : endOfThisMonth;
  const fourteenDaysAgo = subDays(startOfDay(referenceDate), 14);
  const thirtyDaysAgo = subDays(startOfDay(referenceDate), 30);

  // 1. Fetch Attendance Records for the last 30 days
  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      date: {
        gte: thirtyDaysAgo,
        lte: referenceDate,
      },
      user: {
        role: {
          not: "ADMIN"
        }
      }
    },
    include: {
      user: {
        select: {
          name: true,
          workMode: true,
          location: {
            select: {
              id: true,
              name: true,
              isRemote: true,
            },
          },
          department: { select: { id: true, name: true } },
        },
      },
    },
  });

  // 2. Fetch Active Users Count (Synchronized with Admin Dashboard)
  const totalEmployees = await prisma.user.count({
    where: getPayrollEligibleUserWhere(),
  });

  // 3. Daily Attendance Trends (Last 30 days)
  const dailyTrendsMap = new Map<string, { dateStr: string; present: number; late: number; outsideOffice: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = subDays(referenceDate, i);
    const key = format(d, "yyyy-MM-dd");
    dailyTrendsMap.set(key, {
      dateStr: format(d, "dd MMM"),
      present: 0,
      late: 0,
      outsideOffice: 0,
    });
  }

  attendanceRecords.forEach((record) => {
    const key = format(record.date, "yyyy-MM-dd");
    if (dailyTrendsMap.has(key)) {
      const stats = dailyTrendsMap.get(key)!;
      stats.present += 1;
      if (record.isLate) {
        stats.late += 1;
      }
      const isRemoteUser = record.user?.workMode === "REMOTE" || record.user?.location?.isRemote === true;
      if (record.isOutsideOffice && !isRemoteUser) {
        stats.outsideOffice += 1;
      }
    }
  });
  const dailyTrends = Array.from(dailyTrendsMap.values());

  // 4. Late Punch Analysis by Department
  const deptLateMap = new Map<string, { name: string; totalPunches: number; latePunches: number }>();
  attendanceRecords.forEach((record) => {
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

  // 5. Leave Request status & categories (this month)
  const leaveRequests = await prisma.leaveRequest.findMany({
    where: {
      startDate: {
        gte: startOfThisMonth,
        lte: endOfThisMonth,
      },
    },
    select: {
      category: true,
      status: true,
      duration: true,
    },
  });

  const leaveCategoryDistribution = [
    { name: "Monthly Policy", value: leaveRequests.filter(l => l.category === "MONTHLY_POLICY_1" && l.status === "APPROVED").length },
    { name: "Semi-Annual Policy", value: leaveRequests.filter(l => l.category === "SEMI_ANNUAL_POLICY_2" && l.status === "APPROVED").length },
    { name: "Unpaid Leaves", value: leaveRequests.filter(l => l.category === "UNPAID" && l.status === "APPROVED").length },
  ].filter(c => c.value > 0);

  const leaveRequestStatusCounts = {
    pending: leaveRequests.filter(l => l.status === "PENDING").length,
    approved: leaveRequests.filter(l => l.status === "APPROVED").length,
    rejected: leaveRequests.filter(l => l.status === "REJECTED").length,
  };

  // 6. Project & Task Health Metrics
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      startDate: true,
      endDate: true,
      tasks: {
        select: {
          id: true,
          status: true,
          plannedEnd: true,
          tlRating: true,
          adminRating: true,
        },
      },
    },
    orderBy: [
      { status: 'asc' },
      { updatedAt: 'desc' }
    ]
  });

  const now = new Date();

  const projectCompletionStats = projects.map(p => {
    const total = p.tasks.length;
    const completed = p.tasks.filter(t => t.status === "COMPLETED").length;
    const inProgress = p.tasks.filter(t => t.status === "IN_PROGRESS").length;
    const inReview = p.tasks.filter(t => t.status === "IN_REVIEW").length;
    const todo = p.tasks.filter(t => t.status === "TODO").length;
    const onHold = p.tasks.filter(t => t.status === "ON_HOLD").length;
    const overdue = p.tasks.filter(t => t.status !== "COMPLETED" && t.plannedEnd && new Date(t.plannedEnd) < now).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    let health: "COMPLETED" | "ON_TRACK" | "AT_RISK" | "DELAYED" | "ON_HOLD" | "NO_TASKS" = "ON_TRACK";
    if (p.status === "COMPLETED" || (total > 0 && completed === total)) {
      health = "COMPLETED";
    } else if (p.status === "ON_HOLD") {
      health = "ON_HOLD";
    } else if (total === 0) {
      health = "NO_TASKS";
    } else if (p.endDate && new Date(p.endDate) < now && rate < 100) {
      health = "DELAYED";
    } else if (overdue > 0 || (p.endDate && (new Date(p.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24) <= 7 && rate < 60)) {
      health = "AT_RISK";
    } else {
      health = "ON_TRACK";
    }

    return {
      id: p.id,
      name: p.name,
      client: p.code || "Internal",
      status: p.status,
      timeLimit: p.endDate ? p.endDate.toISOString() : null,
      dateOfWorkOrder: p.startDate ? p.startDate.toISOString() : null,
      projectCoordinateName: null,
      total,
      completed,
      inProgress,
      inReview,
      todo,
      onHold,
      overdue,
      rate,
      health,
    };
  });

  const taskCountsGroup = await prisma.task.groupBy({
    by: ['status'],
    _count: { _all: true }
  });
  const taskCountMap: Record<string, number> = {};
  let tasksCount = 0;
  taskCountsGroup.forEach(g => {
    taskCountMap[g.status] = g._count._all;
    tasksCount += g._count._all;
  });
  const completedTasksCount = taskCountMap["COMPLETED"] || 0;
  const inProgressTasksCount = taskCountMap["IN_PROGRESS"] || 0;
  const inReviewTasksCount = taskCountMap["IN_REVIEW"] || 0;
  const todoTasksCount = taskCountMap["TODO"] || 0;

  // Calculate Average Performance Rating (1-5 stars)
  const tasksWithRatings = await prisma.task.findMany({
    where: {
      OR: [
        { subTlRating: { not: null } },
        { tlRating: { not: null } },
        { adminRating: { not: null } },
      ],
    },
    select: {
      subTlRating: true,
      tlRating: true,
      adminRating: true,
    },
  });

  let totalStars = 0;
  let ratingsCount = 0;
  tasksWithRatings.forEach(t => {
    if (t.subTlRating) {
      totalStars += t.subTlRating;
      ratingsCount++;
    }
    if (t.tlRating) {
      totalStars += t.tlRating;
      ratingsCount++;
    }
    if (t.adminRating) {
      totalStars += t.adminRating;
      ratingsCount++;
    }
  });
  const averagePerformanceRating = ratingsCount > 0 ? parseFloat((totalStars / ratingsCount).toFixed(1)) : 0;

  // Aggregate general summaries
  const summaries = {
    totalEmployees,
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.status === "ACTIVE").length,
    averagePerformanceRating,
    attendanceRateToday: totalEmployees > 0
      ? Math.round((attendanceRecords.filter(r => format(r.date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")).length / totalEmployees) * 100)
      : 0,
    totalLatePunches30Days: attendanceRecords.filter(r => r.isLate).length,
    outsideOfficePunches30Days: attendanceRecords.filter(r => {
      const isRemoteUser = r.user?.workMode === "REMOTE" || r.user?.location?.isRemote === true;
      return r.isOutsideOffice && !isRemoteUser;
    }).length,
  };

  // Helper function to map score to grade
  function getPerformanceGrade(score: number): string {
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Very Good";
    if (score >= 70) return "Good";
    if (score >= 50) return "Satisfactory";
    return "Needs Improvement";
  }

  // Fetch tasks with assignee and activity logs for submission tracking (filtered by current calendar month)
  const tasksForPerformance = await prisma.task.findMany({
    where: {
      OR: [
        {
          plannedEnd: {
            gte: startOfThisMonth,
            lte: endOfThisMonth
          }
        },
        {
          plannedEnd: null,
          createdAt: {
            gte: startOfThisMonth,
            lte: endOfThisMonth
          }
        }
      ]
    },
    include: {
      activityLogs: {
        where: {
          action: "UPDATE_TASK",
          OR: [
            { details: "Changed status to In Review" },
            { details: "Changed status to Completed" }
          ]
        },
        orderBy: {
          createdAt: "desc"
        }
      },
      assignedTo: {
        select: {
          id: true,
          departmentId: true
        }
      },
      comments: {
        select: { content: true, userId: true, createdAt: true }
      }
    }
  });

  // Fetch eligible workforce employees dynamically for performance evaluation rankings
  // (Includes backdated personnel who were active or present during the evaluated month, while excluding inactive/resigned users with no attendance)
  const employees = await prisma.user.findMany({
    where: getPayrollEligibleUserWhere(undefined, {
      includePastPersonnel: true,
      dateRange: {
        start: startOfThisMonth,
        end: endOfThisMonth
      }
    }),
    include: {
      department: true
    }
  });

  // Fetch departments with their team leaders
  const depts = await prisma.department.findMany({
    include: {
      teamLeader: {
        select: {
          id: true,
          name: true,
          role: true,
          email: true,
          avatarUrl: true,
          joiningDate: true,
          resignationDate: true,
          status: true
        }
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4-PILLAR FAIR PERFORMANCE SYSTEM
  // Pillars: Productivity (30%) | Timeliness (25%) | Quality (25%) | Discipline (20%)
  // ═══════════════════════════════════════════════════════════════════════════
  // Fetch historical averages for all users across the DB
  const historicalRatedTasks = await prisma.task.findMany({
    where: {
      status: { in: ["COMPLETED", "IN_REVIEW"] },
      OR: [
        { subTlRating: { not: null } },
        { tlRating: { not: null } },
        { adminRating: { not: null } }
      ]
    },
    select: { assignedToId: true, subTlRating: true, tlRating: true, adminRating: true }
  });

  const historicalAverages: Record<string, number> = {};
  const historicalSums: Record<string, { total: number, count: number }> = {};
  historicalRatedTasks.forEach(t => {
    if (t.assignedToId) {
      const userRatings = [t.subTlRating, t.tlRating, t.adminRating].filter(r => r !== null && r !== undefined) as number[];
      if (userRatings.length > 0) {
        const r = userRatings.reduce((sum, val) => sum + val, 0) / userRatings.length;
        if (!historicalSums[t.assignedToId]) historicalSums[t.assignedToId] = { total: 0, count: 0 };
        historicalSums[t.assignedToId].total += r;
        historicalSums[t.assignedToId].count += 1;
      }
    }
  });
  Object.keys(historicalSums).forEach(userId => {
    historicalAverages[userId] = (historicalSums[userId].total / historicalSums[userId].count / 5) * 100;
  });

  // Pre-group tasks and attendance by userId for O(1) lookup
  const tasksByUserIdMap = new Map<string, TaskForEngine[]>();
  tasksForPerformance.forEach(t => {
    if (t.assignedToId) {
      if (!tasksByUserIdMap.has(t.assignedToId)) tasksByUserIdMap.set(t.assignedToId, []);
      tasksByUserIdMap.get(t.assignedToId)!.push(t as unknown as TaskForEngine);
    }
  });

  const attendanceByUserIdMap = new Map<string, AttendanceForEngine[]>();
  attendanceRecords.forEach(r => {
    if (new Date(r.date) >= startOfThisMonth) {
      if (!attendanceByUserIdMap.has(r.userId)) attendanceByUserIdMap.set(r.userId, []);
      attendanceByUserIdMap.get(r.userId)!.push(r as unknown as AttendanceForEngine);
    }
  });

  // --- PRE-CALCULATE DEPARTMENT DELIVERED AVERAGES ---
  const departmentDeliveredStats: Record<string, { total: number; count: number }> = {};

  employees.forEach(emp => {
    const userTasks = tasksByUserIdMap.get(emp.id) || [];
    const userAttendance = attendanceByUserIdMap.get(emp.id) || [];
    const config: EngineConfig = {
      deptAvgDelivered: 0,
      isYearly: false,
      historicalAverageRating: historicalAverages[emp.id] ?? null,
      defaultOfficeStartTime: "09:30"
    };
    const perf = calculatePerformance(emp as unknown as EmployeeForEngine, userTasks, userAttendance, config, today);
    const deptId = emp.departmentId || "unassigned";
    if (!departmentDeliveredStats[deptId]) departmentDeliveredStats[deptId] = { total: 0, count: 0 };
    departmentDeliveredStats[deptId].total += perf.deliveredWeight;
    departmentDeliveredStats[deptId].count += 1;
  });

  const employeePerformance = employees.map(emp => {
    const userTasks = tasksByUserIdMap.get(emp.id) || [];
    const userAttendance = attendanceByUserIdMap.get(emp.id) || [];

    const deptId = emp.departmentId || "unassigned";
    const deptStats = departmentDeliveredStats[deptId];
    const deptAvgDelivered = (deptStats && deptStats.count > 0) ? (deptStats.total / deptStats.count) : 0;

    const config: EngineConfig = {
      deptAvgDelivered,
      isYearly: false,
      historicalAverageRating: historicalAverages[emp.id] ?? null,
      defaultOfficeStartTime: "09:30"
    };

    const perf = calculatePerformance(emp as unknown as EmployeeForEngine, userTasks, userAttendance, config, today);

    return {
      id: emp.id,
      name: emp.name || emp.email,
      email: emp.email,
      avatarUrl: emp.avatarUrl,
      joiningDate: emp.joiningDate,
      department: emp.department?.name || "Unassigned",
      ...perf,
      overallScore: perf.score, // alias for frontend
    };
  });

  // Sort: overallScore desc → quality → timeliness → productivity → discipline → joiningDate asc
  employeePerformance.sort((a, b) => {
    if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
    if (b.quality !== a.quality) return b.quality - a.quality;
    if (b.timeliness !== a.timeliness) return b.timeliness - a.timeliness;
    if (b.productivity !== a.productivity) return b.productivity - a.productivity;
    if (b.discipline !== a.discipline) return b.discipline - a.discipline;

    const dateA = a.joiningDate ? new Date(a.joiningDate).getTime() : Infinity;
    const dateB = b.joiningDate ? new Date(b.joiningDate).getTime() : Infinity;
    return dateA - dateB;
  });

  // Calculate metrics for each Team Leader
  const tlReviewTasks = await prisma.task.findMany({
    where: {
      OR: [
        { status: "IN_REVIEW" },
        {
          updatedAt: {
            gte: startOfThisMonth,
            lte: endOfThisMonth
          }
        }
      ]
    },
    include: {
      comments: { select: { content: true, userId: true, createdAt: true } },
      assignedTo: { select: { id: true, departmentId: true } },
      reviewer: { select: { role: true } }
    }
  });

  const tlPerformance = depts
    .filter(dept => {
      if (!dept.teamLeader) return false;
      if (!dept.teamLeader.status || dept.teamLeader.status === "ACTIVE") return true;
      if (!isCurrentMonth) {
        const joinedBeforeOrInMonth = !dept.teamLeader.joiningDate || new Date(dept.teamLeader.joiningDate) <= endOfThisMonth;
        const activeInMonth = !dept.teamLeader.resignationDate || new Date(dept.teamLeader.resignationDate) >= startOfThisMonth;
        return joinedBeforeOrInMonth && activeInMonth;
      }
      return false;
    })
    .map(dept => {
      const tl = dept.teamLeader!;
      // Find all tasks belonging to this department, EXCLUDING tasks assigned to the TL themselves
      const deptTasks = tlReviewTasks.filter(
        t => (t.departmentId === dept.id || (!t.departmentId && t.assignedTo?.departmentId === dept.id)) &&
          t.assignedToId !== tl.id
      );

      const pendingReviews = deptTasks.filter(t =>
        t.status === "IN_REVIEW" &&
        !t.tlApproved &&
        (!t.reviewerId || t.reviewerId === tl.id) &&
        !(t.reviewer?.role === "ADMIN")
      );

      const completedReviews = deptTasks.filter(t => {
        const reviewComments = t.comments?.filter((c: any) => c.userId === tl.id && (c.content.includes("✅ APPROVED") || c.content.includes("❌ REJECTED")));
        if (reviewComments && reviewComments.length > 0) {
          const latestComment = reviewComments.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
          const commentDate = new Date(latestComment.createdAt);
          return commentDate >= startOfThisMonth && commentDate <= endOfThisMonth;
        }
        if (t.tlApproved) {
          const reviewDate = t.actualEnd ? new Date(t.actualEnd) : new Date(t.updatedAt);
          return reviewDate >= startOfThisMonth && reviewDate <= endOfThisMonth;
        }
        return false;
      });

      const totalReviewsDue = pendingReviews.length + completedReviews.length;

      const now = new Date();
      const REVIEW_SLA_DAYS = 2; // Industry standard 48 hours

      const getSubmissionDate = (t: any) => {
        if (t.submittedAt) return new Date(t.submittedAt);
        if (t.actualEnd) return new Date(t.actualEnd);
        return new Date(t.updatedAt);
      };

      const overdueReviews = pendingReviews.filter(t => {
        const submissionDate = getSubmissionDate(t);
        const reviewDeadline = new Date(submissionDate.getTime() + REVIEW_SLA_DAYS * 24 * 60 * 60 * 1000);
        return reviewDeadline < now;
      });

      let totalDelayDays = 0;
      let totalLateReviews = 0;

      // Penalize currently pending (unreviewed) tasks that missed the SLA
      pendingReviews.forEach(t => {
        const submissionDate = getSubmissionDate(t);
        const reviewDeadline = new Date(submissionDate.getTime() + REVIEW_SLA_DAYS * 24 * 60 * 60 * 1000);
        if (reviewDeadline < now) {
          totalLateReviews++;
          const diffDays = (now.getTime() - reviewDeadline.getTime()) / (1000 * 60 * 60 * 24);
          totalDelayDays += Math.max(0, diffDays);
        }
      });

      // Penalize tasks that were reviewed late (after the SLA)
      completedReviews.forEach(t => {
        let reviewDate = t.actualEnd ? new Date(t.actualEnd) : new Date(t.updatedAt);
        const reviewComments = t.comments?.filter((c: any) => c.userId === tl.id && (c.content.includes("✅ APPROVED") || c.content.includes("❌ REJECTED")));
        if (reviewComments && reviewComments.length > 0) {
          reviewComments.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          reviewDate = new Date(reviewComments[0].createdAt);
        }

        const submissionDate = getSubmissionDate(t);
        const reviewDeadline = new Date(submissionDate.getTime() + REVIEW_SLA_DAYS * 24 * 60 * 60 * 1000);

        if (reviewDeadline < reviewDate) {
          totalLateReviews++;
          const diffDays = (reviewDate.getTime() - reviewDeadline.getTime()) / (1000 * 60 * 60 * 24);
          totalDelayDays += Math.max(0, diffDays);
        }
      });

      const avgDelayDays = totalLateReviews > 0 ? parseFloat((totalDelayDays / totalLateReviews).toFixed(1)) : 0;

      let bayesianOTRR = null;
      if (totalReviewsDue > 0) {
        // Continuous Efficiency Score: Start at 100%, deduct 15 points per day of average delay across ALL tasks
        const avgDelayAcrossAllTasks = totalDelayDays / totalReviewsDue;
        bayesianOTRR = Math.max(0, Math.round(100 - (avgDelayAcrossAllTasks * 15)));
      }

      // Calculate Department Punctuality (filtered strictly by current calendar month)
      const deptMembers = employees.filter(emp => emp.departmentId === dept.id);
      let sumPunctuality = 0;
      let membersCount = 0;

      deptMembers.forEach(member => {
        const memberAttendance = attendanceRecords.filter(r => r.userId === member.id && new Date(r.date) >= startOfThisMonth);
        const totalP = memberAttendance.length;
        const lateP = memberAttendance.filter(r => r.isLate && !r.isLateSpecialCase).length;
        const punct = totalP > 0 ? Math.round(((totalP - lateP) / totalP) * 100) : 0;
        sumPunctuality += punct;
        membersCount++;
      });
      const deptPunctuality = membersCount > 0 ? Math.round(sumPunctuality / membersCount) : 0;

      // --- 3. Leadership Score ---
      let leadershipScore = null;
      if (bayesianOTRR !== null) {
        leadershipScore = Math.round((bayesianOTRR * 0.7) + (deptPunctuality * 0.3));
      }

      return {
        tlId: tl.id,
        tlName: tl.name || tl.email,
        avatarUrl: tl.avatarUrl,
        joiningDate: tl.joiningDate,
        department: dept.name,
        pendingReviews: pendingReviews.length,
        overdueReviews: overdueReviews.length,
        avgDelayDays,
        bayesianOTRR,
        deptPunctuality,
        overallScore: leadershipScore, // Expose leadership score
        totalTasks: totalReviewsDue // Total reviews volume
      };
    });

  tlPerformance.sort((a, b) => {
    const scoreA = a.overallScore ?? -1;
    const scoreB = b.overallScore ?? -1;
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    const dateA = a.joiningDate ? new Date(a.joiningDate).getTime() : Infinity;
    const dateB = b.joiningDate ? new Date(b.joiningDate).getTime() : Infinity;
    return dateA - dateB;
  });

  // Calculate Team Performance (Option A)
  const teamPerformance = depts.map(dept => {
    const deptEmployees = employeePerformance.filter(emp => emp.department === dept.name && emp.totalTasks > 0);
    const validScores = deptEmployees.map(e => e.overallScore);
    const averageScore = validScores.length > 0
      ? Math.round(validScores.reduce((sum, score) => sum + score, 0) / validScores.length)
      : null;

    const avgProductivity = validScores.length > 0 ? Math.round(deptEmployees.reduce((sum, e) => sum + e.productivity, 0) / validScores.length) : 0;
    const avgTimeliness = validScores.length > 0 ? Math.round(deptEmployees.reduce((sum, e) => sum + e.timeliness, 0) / validScores.length) : 0;
    const avgQuality = validScores.length > 0 ? Math.round(deptEmployees.reduce((sum, e) => sum + e.quality, 0) / validScores.length) : 0;
    const avgDiscipline = validScores.length > 0 ? Math.round(deptEmployees.reduce((sum, e) => sum + e.discipline, 0) / validScores.length) : 0;

    return {
      department: dept.name,
      averageScore,
      productivity: avgProductivity,
      timeliness: avgTimeliness,
      quality: avgQuality,
      discipline: avgDiscipline,
      memberCount: deptEmployees.length
    };
  });

  teamPerformance.sort((a, b) => {
    if (a.averageScore === null) return 1;
    if (b.averageScore === null) return -1;
    return b.averageScore - a.averageScore;
  });

  return {
    success: true,
    data: {
      summaries,
      dailyTrends,
      departmentLatePatterns,
      leaveCategoryDistribution,
      leaveRequestStatusCounts,
      projectCompletionStats,
      taskStatusCounts: {
        todo: todoTasksCount,
        inProgress: inProgressTasksCount,
        inReview: inReviewTasksCount,
        completed: completedTasksCount,
        total: tasksCount,
      },
      employeePerformance,
      tlPerformance,
      teamPerformance
    }
  };
}

