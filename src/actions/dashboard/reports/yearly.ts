"use server"

import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { calculatePerformance, TaskForEngine, AttendanceForEngine, EmployeeForEngine, EngineConfig } from "./engine"
import { hasMenuAccess } from "@/lib/permissions"
import { getPayrollEligibleUserWhere } from "@/lib/payroll-helper"

export async function getAdminYearlyReportsData(reqYear?: number) {
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

  const today = new Date();
  const currentYear = reqYear || today.getFullYear();

  const startOfThisYear = new Date(Date.UTC(currentYear, 0, 1, 0, 0, 0, 0));
  const endOfThisYear = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));

  // 1. Fetch Attendance Records for the entire year
  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      date: {
        gte: startOfThisYear,
        lte: endOfThisYear,
      },
      user: {
        role: {
          notIn: ["SYSTEM_ADMIN", "ADMIN"]
        }
      }
    },
  });

  // 2. Fetch Active Users Count (Synchronized with Admin Dashboard)
  const totalEmployees = await prisma.user.count({
    where: getPayrollEligibleUserWhere(),
  });

  // 3. Fetch all tasks created in the selected year
  const tasksForPerformance = await prisma.task.findMany({
    where: {
      OR: [
        {
          plannedEnd: {
            gte: startOfThisYear,
            lte: endOfThisYear
          }
        },
        {
          plannedEnd: null,
          createdAt: {
            gte: startOfThisYear,
            lte: endOfThisYear
          }
        }
      ]
    },
    include: {
      activityLogs: {
        where: {
          action: "UPDATE_TASK",
          details: "Changed status to In Review"
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

  // Fetch eligible active workforce employees dynamically for performance evaluations
  const employees = await prisma.user.findMany({
    where: getPayrollEligibleUserWhere({
      status: "ACTIVE"
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
          status: true
        }
      }
    }
  });

  // Helper function to map score to grade
  function getPerformanceGrade(score: number): string {
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Very Good";
    if (score >= 70) return "Good";
    if (score >= 50) return "Satisfactory";
    return "Needs Improvement";
  }

  // Pre-group tasks by userId for fast lookup
  const tasksByUserIdMap = new Map<string, TaskForEngine[]>();
  tasksForPerformance.forEach(t => {
    if (t.assignedToId) {
      if (!tasksByUserIdMap.has(t.assignedToId)) tasksByUserIdMap.set(t.assignedToId, []);
      tasksByUserIdMap.get(t.assignedToId)!.push(t as unknown as TaskForEngine);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4-PILLAR FAIR PERFORMANCE SYSTEM (YEARLY)
  // Same pillars as monthly: Productivity (30%) | Timeliness (25%) | Quality (25%) | Discipline (20%)
  // ═══════════════════════════════════════════════════════════════════════════
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

  const attendanceByUserIdMap = new Map<string, AttendanceForEngine[]>();
  attendanceRecords.forEach(r => {
    if (!attendanceByUserIdMap.has(r.userId)) attendanceByUserIdMap.set(r.userId, []);
    attendanceByUserIdMap.get(r.userId)!.push(r as unknown as AttendanceForEngine);
  });

  // --- PRE-CALCULATE DEPARTMENT DELIVERED AVERAGES ---
  const departmentDeliveredStats: Record<string, { total: number; count: number }> = {};

  employees.forEach(emp => {
    const userTasks = tasksByUserIdMap.get(emp.id) || [];
    const userAttendance = attendanceByUserIdMap.get(emp.id) || [];
    const config: EngineConfig = {
      deptAvgDelivered: 0,
      isYearly: true,
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
      isYearly: true,
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

  // Fetch TL review tasks for the entire year
  const tlReviewTasksYearly = await prisma.task.findMany({
    where: {
      OR: [
        { status: "IN_REVIEW" },
        {
          updatedAt: {
            gte: startOfThisYear,
            lte: endOfThisYear
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
    .filter(dept => dept.teamLeader !== null && (!dept.teamLeader.status || dept.teamLeader.status === "ACTIVE"))
    .map(dept => {
      const tl = dept.teamLeader!;
      // Find all tasks belonging to this department, EXCLUDING tasks assigned to the TL themselves
      const deptTasks = tlReviewTasksYearly.filter(
        t => (t.departmentId === dept.id || (!t.departmentId && t.assignedTo?.departmentId === dept.id)) &&
          t.assignedToId !== tl.id
      );

      const pendingReviews = deptTasks.filter(t =>
        t.status === "IN_REVIEW" &&
        !t.tlApproved &&
        (!t.reviewerId || t.reviewerId === tl.id) &&
        !(t.reviewer?.role === "ADMIN" || t.reviewer?.role === "SYSTEM_ADMIN")
      );

      const completedReviews = deptTasks.filter(t => {
        const reviewComments = t.comments?.filter((c: any) => c.userId === tl.id && (c.content.includes("✅ APPROVED") || c.content.includes("❌ REJECTED")));
        if (reviewComments && reviewComments.length > 0) {
          const latestComment = reviewComments.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
          const commentDate = new Date(latestComment.createdAt);
          return commentDate >= startOfThisYear && commentDate <= endOfThisYear;
        }
        if (t.tlApproved) {
          const reviewDate = t.actualEnd ? new Date(t.actualEnd) : new Date(t.updatedAt);
          return reviewDate >= startOfThisYear && reviewDate <= endOfThisYear;
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

      // Calculate Department Punctuality (filtered strictly by selected calendar year)
      const deptMembers = employees.filter(emp => emp.departmentId === dept.id);
      let sumPunctuality = 0;
      let membersCount = 0;

      deptMembers.forEach(member => {
        const memberAttendance = attendanceRecords.filter(r => r.userId === member.id);
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

  // Sort TL performance by leadershipScore (overallScore) descending,
  // falling back to ascending by joiningDate
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

  // Calculate Team Performance (Yearly)
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
      employeePerformance,
      tlPerformance,
      teamPerformance
    }
  };
}

