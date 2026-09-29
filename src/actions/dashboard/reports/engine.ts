import { TaskStatus, Priority } from "@prisma/client";

export interface TaskForEngine {
  id: string;
  status: TaskStatus;
  priority: Priority;
  plannedDuration: number | null;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  actualEnd: Date | null;
  submittedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  subTlRating?: number | null;
  tlRating: number | null;
  adminRating: number | null;
  comments: { content: string; userId: string; createdAt: Date }[];
  activityLogs: { action: string; details: string | null; createdAt: Date }[];
}

export interface AttendanceForEngine {
  date: Date;
  punchIn: Date;
  isLate: boolean;
  isLateSpecialCase: boolean;
}

export interface EmployeeForEngine {
  id: string;
  departmentId: string | null;
  joiningDate?: Date | null;
  department?: {
    officeStartTime?: string | null;
  } | null;
}

export interface EngineConfig {
  deptAvgDelivered: number;
  isYearly: boolean;
  historicalAverageRating: number | null;
  defaultOfficeStartTime: string;
}

export interface PerformanceResult {
  totalTasks: number;
  productivity: number;
  timeliness: number;
  quality: number;
  discipline: number;
  score: number;
  grade: string;
  confidence: "high" | "medium" | "low";
  isProbation: boolean;
  // Fairness flags
  isQualityDefaulted: boolean;
  historicalQualityUsed: number | null;
  deadlineCoverageRatio: number;
  // Raw stats for frontend mapping
  deliveredWeight: number;
  dueWeight: number;
  avgRating: number;
}

export function getTaskWeight(t: TaskForEngine): number {
  let baseWeight = 1;
  if (t.plannedDuration) {
    baseWeight = t.plannedDuration;
  } else if (t.plannedStart && t.plannedEnd) {
    const diffDays = (new Date(t.plannedEnd).getTime() - new Date(t.plannedStart).getTime()) / (1000 * 60 * 60 * 24);
    baseWeight = diffDays > 0 ? diffDays : 1;
  }

  let priorityMultiplier = 1.0;
  if (t.priority === "URGENT" || t.priority === "HIGH") priorityMultiplier = 1.5;
  else if (t.priority === "LOW") priorityMultiplier = 0.75;

  return baseWeight * priorityMultiplier;
}

export function calculatePerformance(
  emp: EmployeeForEngine,
  userTasks: TaskForEngine[],
  userAttendance: AttendanceForEngine[],
  config: EngineConfig,
  now = new Date()
): PerformanceResult {
  const totalTasks = userTasks.length;

  // 1. Productivity
  let dueWeight = 0;
  let deliveredWeight = 0;

  userTasks.forEach(task => {
    const weight = getTaskWeight(task);
    const isSubmitted = task.status === "COMPLETED" || task.status === "IN_REVIEW";

    let isDue = false;
    if (isSubmitted) {
      isDue = true;
    } else if (task.plannedEnd) {
      const plannedEndDate = new Date(task.plannedEnd);
      plannedEndDate.setHours(23, 59, 59, 999);
      if (now.getTime() > plannedEndDate.getTime()) {
        isDue = true;
      }
    }

    if (isDue) {
      dueWeight += weight;
      if (isSubmitted) {
        deliveredWeight += weight;
      }
    }
  });

  const baselineFloor = config.isYearly ? 5 : 5; // Unified safety floor
  const baseline = Math.max(config.deptAvgDelivered, baselineFloor);
  const comparisonTarget = Math.max(dueWeight, baseline);
  const productivityRatio = comparisonTarget > 0 ? Math.round((deliveredWeight / comparisonTarget) * 100) : (totalTasks > 0 ? 100 : 0);
  const productivity = Math.min(100, productivityRatio);

  // 2. Timeliness & Deadline Coverage
  let submittedWithDeadlineWeight = 0;
  let onTimeWeight = 0;
  let tasksWithDeadlineCount = 0;

  userTasks.forEach(task => {
    if (task.plannedEnd) tasksWithDeadlineCount++;

    const weight = getTaskWeight(task);
    const isSubmitted = task.status === "COMPLETED" || task.status === "IN_REVIEW";

    if (isSubmitted && task.plannedEnd) {
      submittedWithDeadlineWeight += weight;
      let submissionDate: Date;
      if (task.submittedAt) {
        submissionDate = new Date(task.submittedAt);
      } else if (task.actualEnd) {
        submissionDate = new Date(task.actualEnd);
      } else {
        submissionDate = new Date(task.updatedAt || task.createdAt);
      }
      const plannedEndDate = new Date(task.plannedEnd);
      plannedEndDate.setHours(23, 59, 59, 999);

      if (submissionDate.getTime() <= plannedEndDate.getTime()) {
        onTimeWeight += weight;
      }
    } else if (isSubmitted && !task.plannedEnd) {
      submittedWithDeadlineWeight += weight;
      onTimeWeight += weight;
    } else if (!isSubmitted && task.plannedEnd) {
      // Penalize overdue unsubmitted tasks
      const plannedEndDate = new Date(task.plannedEnd);
      plannedEndDate.setHours(23, 59, 59, 999);
      if (now.getTime() > plannedEndDate.getTime()) {
        submittedWithDeadlineWeight += weight;
      }
    }
  });

  const deadlineCoverageRatio = totalTasks > 0 ? Math.round((tasksWithDeadlineCount / totalTasks) * 100) : 100;

  // Yearly used a hard 0 fallback, Monthly used 100. Unifying to the fairer Monthly fallback logic:
  const timelinessRatio = submittedWithDeadlineWeight > 0 ? Math.round((onTimeWeight / submittedWithDeadlineWeight) * 100) : (totalTasks > 0 ? 100 : 0);
  const timeliness = Math.min(100, timelinessRatio);

  // 3. Quality
  let totalRatingSum = 0;
  let ratingWeightSum = 0;
  let submittedTasksWeight = 0;
  let tasksWithRejectionsWeight = 0;

  userTasks.forEach(t => {
    const weight = getTaskWeight(t);
    const isSubmitted = t.status === "COMPLETED" || t.status === "IN_REVIEW";
    if (isSubmitted) {
      submittedTasksWeight += weight;
      const hasRejection = t.comments.some(c => c.content.includes("❌ REJECTED"));
      if (hasRejection) tasksWithRejectionsWeight += weight;
    }

    const ratings = [t.subTlRating, t.tlRating, t.adminRating].filter(r => r !== null && r !== undefined) as number[];
    if (ratings.length > 0) {
      const taskRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      totalRatingSum += taskRating * weight;
      ratingWeightSum += weight;
    }
  });

  let isQualityDefaulted = false;
  let historicalQualityUsed: number | null = null;
  let ratingComponent = 60;

  if (ratingWeightSum > 0) {
    ratingComponent = (totalRatingSum / ratingWeightSum / 5) * 100;
  } else if (submittedTasksWeight > 0) {
    // If they have submitted tasks but NO ratings, fall back to historical average or 60
    isQualityDefaulted = true;
    if (config.historicalAverageRating !== null) {
      ratingComponent = config.historicalAverageRating;
      historicalQualityUsed = config.historicalAverageRating;
    } else {
      ratingComponent = 60;
    }
  }

  const acceptanceRate = submittedTasksWeight > 0
    ? Math.round(((submittedTasksWeight - tasksWithRejectionsWeight) / submittedTasksWeight) * 100)
    : (ratingWeightSum > 0 ? 100 : ratingComponent); // Fallback to ratingComponent instead of hard 60

  const quality = Math.min(100, Math.round((ratingComponent * 0.85) + (acceptanceRate * 0.15)));

  // 4. Discipline (with late severity weighting)
  const totalPresentDays = userAttendance.length;
  let weightedLateDays = 0;

  userAttendance.forEach(r => {
    if (r.isLate && !r.isLateSpecialCase) {
      const officeStartTimeStr = emp.department?.officeStartTime || config.defaultOfficeStartTime || "09:30";
      const [hours, mins] = officeStartTimeStr.split(":").map(Number);
      
      const expectedIn = new Date(r.date);
      expectedIn.setHours(hours, mins, 0, 0);
      
      const lateMinutes = (r.punchIn.getTime() - expectedIn.getTime()) / 60000;
      
      if (lateMinutes > 60) weightedLateDays += 1;
      else if (lateMinutes > 30) weightedLateDays += 0.75;
      else if (lateMinutes > 15) weightedLateDays += 0.5;
      else weightedLateDays += 0.25; // 1-15 mins late
    }
  });

  const discipline = totalPresentDays > 0 ? Math.round(((totalPresentDays - weightedLateDays) / totalPresentDays) * 100) : 0;

  // Final Score
  const score = Math.round(
    (productivity * 0.30) +
    (timeliness * 0.25) +
    (quality * 0.25) +
    (discipline * 0.20)
  );

  const confidence: "high" | "medium" | "low" = totalTasks >= 5 ? "high" : totalTasks >= 3 ? "medium" : "low";
  
  let grade = "Poor";
  if (score >= 90) grade = "Excellent";
  else if (score >= 80) grade = "Very Good";
  else if (score >= 70) grade = "Good";
  else if (score >= 50) grade = "Satisfactory";
  else if (score >= 35) grade = "Needs Improvement";

  let isProbation = false;
  if (emp.joiningDate) {
    const probationEndDate = new Date(emp.joiningDate);
    probationEndDate.setDate(probationEndDate.getDate() + 90);
    if (now < probationEndDate) {
      isProbation = true;
    }
  }

  const avgRating = ratingWeightSum > 0 ? parseFloat((totalRatingSum / ratingWeightSum).toFixed(1)) : 0;

  return {
    totalTasks,
    productivity,
    timeliness,
    quality,
    discipline,
    score,
    grade,
    confidence,
    isProbation,
    isQualityDefaulted,
    historicalQualityUsed,
    deadlineCoverageRatio,
    deliveredWeight,
    dueWeight,
    avgRating
  };
}
