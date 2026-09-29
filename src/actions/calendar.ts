"use server";

import prisma from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { appConfig } from "@/lib/app-config";


export async function getCalendarEvents(month?: number, year?: number) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return { success: false, error: "Unauthorized" };

    const now = new Date();
    const targetMonth = month !== undefined ? month : now.getMonth();
    const targetYear = year !== undefined ? year : now.getFullYear();

    const start = startOfMonth(new Date(targetYear, targetMonth));
    const end = endOfMonth(new Date(targetYear, targetMonth));

    // For holidays, we fetch for the entire year to support frontend navigation without refetching
    const yearStart = new Date(targetYear, 0, 1);
    const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59);

    const currentUserRole = session.user.role;
    const currentUserId = session.user.id;

    console.log(`[Calendar] Fetching for User: ${currentUserId}, Role: ${currentUserRole}`);

    // Fetch Public Holidays (Global for the current target year)
    const holidays = await prisma.publicHoliday.findMany({
      where: {
        date: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
    });

    const nonDevUserFilter = {
      status: "ACTIVE" as const,
      NOT: [
        { email: { in: [appConfig.devAdminEmail, "dev@sigma.com"] } },
        { roleDefinition: { code: "SYSTEM_ADMIN" } }
      ]
    };

    // Fetch Birthdays
    const birthdayEmployees = await prisma.user.findMany({
      where: {
        dateOfBirth: { not: null },
        ...nonDevUserFilter
      },
      select: {
        id: true,
        name: true,
        dateOfBirth: true
      }
    });

    const birthdays = birthdayEmployees.map(emp => {
      const dob = new Date(emp.dateOfBirth!);
      // Adjust year to the target year so it appears on the calendar
      const eventDate = new Date(targetYear, dob.getMonth(), dob.getDate());
      return {
        id: `bday-${emp.id}`,
        title: `${emp.name}'s Birthday`,
        date: eventDate,
        originalDate: emp.dateOfBirth,
        type: "BIRTHDAY"
      };
    });

    // Fetch Anniversaries
    const anniversaryEmployees = await prisma.user.findMany({
      where: {
        joiningDate: { not: null },
        ...nonDevUserFilter
      },
      select: {
        id: true,
        name: true,
        joiningDate: true
      }
    });

    const anniversaries = anniversaryEmployees.map(emp => {
      const joiningDate = new Date(emp.joiningDate!);
      // Adjust year to the target year so it appears on the calendar
      const eventDate = new Date(targetYear, joiningDate.getMonth(), joiningDate.getDate());
      
      // Calculate years of service
      const years = targetYear - joiningDate.getFullYear();
      
      // Only show if they've completed at least 1 year
      if (years <= 0) return null;

      return {
        id: `anniv-${emp.id}`,
        title: `${emp.name}'s ${years}${getOrdinal(years)} Anniversary`,
        date: eventDate,
        originalDate: emp.joiningDate,
        empName: emp.name,
        type: "ANNIVERSARY"
      };
    }).filter((a): a is any => a !== null);

    console.log(`[Calendar] Found ${birthdays.length} birthdays and ${anniversaries.length} anniversaries`);

    // Fetch Announcements
    const announcements = await prisma.announcement.findMany({
      where: {
        tenantId: session.user.tenantId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });

    return {
      success: true,
      data: {
        holidays: holidays.map(h => ({
          id: h.id,
          title: h.name,
          date: h.date,
          type: "HOLIDAY"
        })),
        birthdays,
        anniversaries,
        announcements: announcements.map(a => ({
          id: a.id,
          title: a.title,
          date: a.createdAt,
          type: "ANNOUNCEMENT"
        }))
      }
    };
  } catch (error) {
    console.error("Failed to fetch calendar events:", error);
    return { success: false, error: "Failed to load calendar" };
  }
}

function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
