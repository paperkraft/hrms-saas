"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getAdminReportsData } from "./monthly"
export async function getMonthlyChampions() {
  const session = await getServerSession(authOptions);
  if (!session) return { success: false };

  try {
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    const [currentReports, previousReports] = await Promise.all([
      getAdminReportsData(undefined, undefined, true),
      getAdminReportsData(prevMonth, prevYear, true)
    ]);

    if (!currentReports.success || !previousReports.success) return { success: false };

    const extractChampions = (data: any) => {
      const { employeePerformance, tlPerformance, teamPerformance } = data;

      const employeeCandidates = employeePerformance.filter((emp: any) => emp.overallScore > 0 && !emp.isProbation);
      const employeeOfTheMonth = employeeCandidates.length > 0 ? [...employeeCandidates].sort((a: any, b: any) => {
        if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
        if (b.quality !== a.quality) return b.quality - a.quality;
        if (b.timeliness !== a.timeliness) return b.timeliness - a.timeliness;
        if (b.productivity !== a.productivity) return b.productivity - a.productivity;
        return b.discipline - a.discipline;
      })[0] : null;

      const tlCandidates = tlPerformance.filter((tl: any) => tl.overallScore !== null && tl.overallScore > 0);
      const tlOfTheMonth = tlCandidates.length > 0 ? [...tlCandidates].sort((a: any, b: any) => {
        if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
        if (b.deptPunctuality !== a.deptPunctuality) return b.deptPunctuality - a.deptPunctuality;
        return a.avgDelayDays - b.avgDelayDays;
      })[0] : null;

      const teamCandidates = teamPerformance?.filter((team: any) => team.averageScore !== null && team.averageScore > 0) || [];
      const teamOfTheMonth = teamCandidates.length > 0 ? [...teamCandidates].sort((a: any, b: any) => {
        if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
        if (b.quality !== a.quality) return b.quality - a.quality;
        return b.productivity - a.productivity;
      })[0] : null;

      return { employeeOfTheMonth, tlOfTheMonth, teamOfTheMonth };
    };

    const currentChampions = extractChampions(currentReports.data);
    const previousChampions = extractChampions(previousReports.data);

    return {
      success: true,
      data: {
        liveEmployee: currentChampions.employeeOfTheMonth,
        liveTl: currentChampions.tlOfTheMonth,
        liveTeam: currentChampions.teamOfTheMonth,
        prevEmployee: previousChampions.employeeOfTheMonth,
        prevTl: previousChampions.tlOfTheMonth,
        prevTeam: previousChampions.teamOfTheMonth
      }
    };
  } catch (error) {
    console.error("Error getting monthly champions:", error);
    return { success: false };
  }
}
