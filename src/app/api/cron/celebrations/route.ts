import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendCelebrationEmail } from "@/lib/mail";
import { cleanupOldNotifications } from "@/lib/cleanup-notifications";
import { appConfig } from "@/lib/app-config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const secret = searchParams.get("secret") || searchParams.get("key");

    // Optional basic protection (allowing bypass in development or with query param)
    const expectedSecret = process.env.CRON_SECRET || "sigma_cron_secret_2026";
    if (process.env.NODE_ENV === "production" && secret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Automatically purge previous days' celebrations, expired announcements, and old reminders
    const cleanupStats = await cleanupOldNotifications();

    // Parse target date (default to local time)
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 });
    }

    const targetMonth = targetDate.getMonth() + 1; // 1-indexed (Jan is 1)
    const targetDay = targetDate.getDate();

    console.log(`[CelebrationsCron] Running audit for date: ${targetDate.toDateString()} (Month: ${targetMonth}, Day: ${targetDay})`);

    // Fetch all users with dateOfBirth or joiningDate populated
    const users = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: { not: "SYSTEM_ADMIN" },
        NOT: [
          { role: "SYSTEM_ADMIN" },
          { email: { in: [appConfig.devAdminEmail, "dev@sigma.com"] } },
          { roleDefinition: { code: "SYSTEM_ADMIN" } }
        ]
      },
      include: {
        department: { select: { name: true } },
      },
    });

    const birthdayWishlist: any[] = [];
    const anniversaryWishlist: any[] = [];

    // Filter users manually to prevent DB dialect inconsistencies
    for (const user of users) {
      // 1. Check Birthdays
      if (user.dateOfBirth) {
        const dob = new Date(user.dateOfBirth);
        const dobMonth = dob.getMonth() + 1;
        const dobDay = dob.getDate();

        if (dobMonth === targetMonth && dobDay === targetDay) {
          birthdayWishlist.push(user);
        }
      }

      // 2. Check Work Anniversaries
      if (user.joiningDate) {
        const jd = new Date(user.joiningDate);
        const jdMonth = jd.getMonth() + 1;
        const jdDay = jd.getDate();

        if (jdMonth === targetMonth && jdDay === targetDay) {
          // Prevent claiming anniversary on their very first day of work (same year)
          const yearsDiff = targetDate.getFullYear() - jd.getFullYear();
          if (yearsDiff > 0) {
            anniversaryWishlist.push({ user, years: yearsDiff });
          }
        }
      }
    }

    console.log(`[CelebrationsCron] Found ${birthdayWishlist.length} Birthdays and ${anniversaryWishlist.length} Anniversaries.`);

    // Fetch list of ALL other users to create in-app broadcast alerts
    const allActiveUsers = await prisma.user.findMany({
      select: { id: true, email: true },
    });

    // ── PROCESS BIRTHDAYS ──
    for (const employee of birthdayWishlist) {
      const email = employee.email;
      const name = employee.name || "Colleague";

      // A. Send Direct Wishes Email (tenant-branded)
      await sendCelebrationEmail({
        tenantId: employee.tenantId,
        employeeName: name,
        type: "BIRTHDAY",
        toEmail: email,
      });

      // B. Create Direct Personal In-App Notification
      await prisma.notification.create({
        data: {
          tenantId: employee.tenantId,
          userId: employee.id,
          title: "🎂 Happy Birthday! 🎉",
          message: `Happy Birthday, ${name}! The entire team wishes you a wonderful year ahead filled with joy and success! 💖`,
          type: "SUCCESS",
          link: "/dashboard/profile",
        },
      });

      // C. Broadcast in-app alerts to team members within the SAME tenant only
      const peers = await prisma.user.findMany({
        where: {
          tenantId: employee.tenantId,
          status: "ACTIVE",
          id: { not: employee.id },
        },
        select: { id: true },
      });

      if (peers.length > 0) {
        await prisma.notification.createMany({
          data: peers.map((p) => ({
            tenantId: employee.tenantId,
            userId: p.id,
            title: "🎂 Birthday Alert!",
            message: `Today is ${name}'s birthday! Let's take a moment to drop a wish and celebrate! ✨`,
            type: "INFO",
            link: null,
          })),
        });
      }
    }

    // ── PROCESS WORK ANNIVERSARIES ──
    for (const item of anniversaryWishlist) {
      const { user: employee, years } = item;
      const email = employee.email;
      const name = employee.name || "Colleague";

      // A. Send Direct Anniversary Email (tenant-branded)
      await sendCelebrationEmail({
        tenantId: employee.tenantId,
        employeeName: name,
        type: "ANNIVERSARY",
        yearsCount: years,
        toEmail: email,
      });

      // B. Create Direct Personal In-App Notification
      await prisma.notification.create({
        data: {
          tenantId: employee.tenantId,
          userId: employee.id,
          title: `🎉 Happy ${years} Year Work Anniversary! 🌟`,
          message: `Congratulations on completing ${years} year${years > 1 ? "s" : ""}, ${name}! Thank you for your incredible hard work, loyalty, and dedication! 🥂`,
          type: "SUCCESS",
          link: "/dashboard/profile",
        },
      });

      // C. Broadcast in-app alerts to team members within the SAME tenant only
      const peers = await prisma.user.findMany({
        where: {
          tenantId: employee.tenantId,
          status: "ACTIVE",
          id: { not: employee.id },
        },
        select: { id: true },
      });

      if (peers.length > 0) {
        const ordinals = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
        const yearStr = years < ordinals.length ? ordinals[years] : `${years}th`;

        await prisma.notification.createMany({
          data: peers.map((p) => ({
            tenantId: employee.tenantId,
            userId: p.id,
            title: "🎉 Work Anniversary Alert!",
            message: `${name} is celebrating their ${yearStr} Work Anniversary today! Let's congratulate them! 🌟`,
            type: "INFO",
            link: null,
          })),
        });
      }
    }

    return NextResponse.json({
      success: true,
      auditedDate: targetDate.toDateString(),
      birthdaysProcessed: birthdayWishlist.map((u) => u.name),
      anniversariesProcessed: anniversaryWishlist.map((a) => `${a.user.name} (${a.years} yr)`),
    });
  } catch (error: any) {
    console.error("[CelebrationsCron] Process failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
