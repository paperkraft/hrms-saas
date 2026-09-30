"use server"

import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { format } from "date-fns"
import { hasMenuAccess } from "@/lib/permissions"
import { getPayrollEligibleUserWhere } from "@/lib/payroll-helper"

export async function getAttendanceLedgerData(reqMonth?: number, reqYear?: number) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasMenuAccess(session.user, "/dashboard/accountant", "/dashboard/admin")) {
        throw new Error(`Unauthorized access for role: ${session?.user?.role || 'UNKNOWN'}`);
    }

    const now = new Date();
    let currentYear = reqYear || now.getUTCFullYear();
    let currentMonth = reqMonth || now.getUTCMonth() + 1;

    // Get the date range for the entire month
    const startOfRange = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0, 0));
    const endOfRange = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999));

    const tenantId = session.user.tenantId;

    // Get all eligible employees dynamically (including past personnel who worked in this period)
    const users = await prisma.user.findMany({
        where: getPayrollEligibleUserWhere(
            {
                ...(tenantId ? { tenantId } : {}),
                createdAt: { lte: endOfRange }
            },
            { includePastPersonnel: true, dateRange: { start: startOfRange, end: endOfRange } }
        ),
        select: {
            id: true,
            name: true,
            email: true,
            designation: true,
            avatarUrl: true,
            department: { select: { id: true, name: true } }
        },
        orderBy: { name: 'asc' }
    });

    // Get all attendances for the month
    const attendances = await prisma.attendance.findMany({
        where: {
            ...(tenantId ? { user: { tenantId } } : {}),
            date: { gte: startOfRange, lte: endOfRange }
        },
        select: {
            userId: true,
            date: true,
            punchIn: true,
            punchOut: true,
            isLate: true,
            isEarlyLogoff: true,
            isOutsideOffice: true,
            isLateSpecialCase: true,
            isHalfDay: true
        },
        orderBy: [{ userId: 'asc' }, { date: 'asc' }]
    });

    // Get all allowances for the month
    const allowances = await prisma.allowance.findMany({
        where: {
            ...(tenantId ? { tenantId } : {}),
            date: { gte: startOfRange, lte: endOfRange },
        },
        select: {
            userId: true,
            type: true,
            description: true,
            date: true,
            amount: true,
        }
    });

    // Get all approved leaves for the month
    const leaves = await prisma.leaveRequest.findMany({
        where: {
            ...(tenantId ? { tenantId } : {}),
            status: "APPROVED",
            OR: [
                { startDate: { gte: startOfRange, lte: endOfRange } },
                { endDate: { gte: startOfRange, lte: endOfRange } },
                { startDate: { lte: startOfRange }, endDate: { gte: endOfRange } }
            ]
        },
        select: {
            userId: true,
            startDate: true,
            endDate: true,
            duration: true,
            category: true,
            leaveType: true,
            halfDayType: true,
            startTime: true,
            endTime: true
        }
    });

    // Get approved overtime requests for the month
    const overtimes = await prisma.overtimeRequest.findMany({
        where: {
            ...(tenantId ? { tenantId } : {}),
            status: "APPROVED",
            date: { gte: startOfRange, lte: endOfRange }
        },
        select: {
            userId: true,
            date: true,
            hours: true
        }
    });

    // Group attendances by user
    const attendanceByUser: Record<string, any[]> = {};
    attendances.forEach(att => {
        if (!attendanceByUser[att.userId]) {
            attendanceByUser[att.userId] = [];
        }
        attendanceByUser[att.userId].push(att);
    });

    // Group allowances by user
    const allowanceByUser: Record<string, any> = {};
    allowances.forEach(allw => {
        if (!allowanceByUser[allw.userId]) {
            allowanceByUser[allw.userId] = allw;
        }
    });

    // Group leaves by user
    const leaveByUser: Record<string, any[]> = {};
    leaves.forEach(leave => {
        if (!leaveByUser[leave.userId]) {
            leaveByUser[leave.userId] = [];
        }
        leaveByUser[leave.userId].push(leave);
    });

    // Group overtimes by user
    const overtimeByUser: Record<string, any[]> = {};
    overtimes.forEach(ot => {
        if (!overtimeByUser[ot.userId]) {
            overtimeByUser[ot.userId] = [];
        }
        overtimeByUser[ot.userId].push(ot);
    });

    // Get system config for shift info
    const config = tenantId ? await prisma.systemConfig.findUnique({ where: { tenantId } }) : null;

    // Build the ledger data
    const ledgerData = users.map(user => {
        const userAttendances = attendanceByUser[user.id] || [];

        // Create a day-by-day breakdown
        const dayDetails: Record<string, any> = {};

        // Initialize all days with no punch data
        for (let day = 1; day <= 31; day++) {
            const date = new Date(Date.UTC(currentYear, currentMonth - 1, day));
            if (date.getUTCMonth() !== currentMonth - 1) break; // Stop if we've moved to next month

            const dateStr = format(date, 'yyyy-MM-dd');
            dayDetails[dateStr] = {
                date,
                dateStr,
                dayNum: day,
                dayName: format(date, 'EEE'),
                punchIn: null,
                punchOut: null,
                isLate: false,
                isLateSpecialCase: false,
                isHalfDay: false,
                isEarlyLogoff: false,
                isOutsideOffice: false,
                totalHours: 0,
                isLeave: false,
                leaveDetails: null,
                overtimeHours: 0
            };
        }

        // Fill in actual attendance data
        userAttendances.forEach(att => {
            const dateStr = format(new Date(att.date), 'yyyy-MM-dd');
            if (dayDetails[dateStr]) {
                const punchIn = new Date(att.punchIn);
                const punchOut = att.punchOut ? new Date(att.punchOut) : null;

                dayDetails[dateStr].punchIn = punchIn;
                dayDetails[dateStr].punchOut = punchOut;
                dayDetails[dateStr].isLate = att.isLate;
                dayDetails[dateStr].isLateSpecialCase = att.isLateSpecialCase;
                dayDetails[dateStr].isHalfDay = att.isHalfDay;
                dayDetails[dateStr].isEarlyLogoff = att.isEarlyLogoff;
                dayDetails[dateStr].isOutsideOffice = att.isOutsideOffice;

                if (punchIn && punchOut) {
                    const hours = (punchOut.getTime() - punchIn.getTime()) / (1000 * 60 * 60);
                    dayDetails[dateStr].totalHours = parseFloat(hours.toFixed(2));
                }
            }
        });

        // Fill in leave data
        const userLeaves = leaveByUser[user.id] || [];
        userLeaves.forEach(leave => {
            // Need to set hours to 0 to be safe, but date is in UTC or local.
            // Prisma returns Dates. Let's just iterate days.
            let currentDate = new Date(leave.startDate);
            const endDate = new Date(leave.endDate);
            
            while (currentDate <= endDate) {
                if (currentDate.getDay() !== 0) { // Exclude Sunday
                    const dateStr = format(currentDate, 'yyyy-MM-dd');
                    if (dayDetails[dateStr]) {
                        dayDetails[dateStr].isLeave = true;
                        dayDetails[dateStr].leaveDetails = leave;

                        // Approved leave (FULL, HALF, or SHORT) must not be penalized as an unexcused technical half-day
                        if (leave.duration === "FULL" || leave.duration === "HALF" || leave.duration === "SHORT") {
                            dayDetails[dateStr].isHalfDay = false;
                        }
                    }
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
        });

        // Fill in overtime data
        const userOvertimes = overtimeByUser[user.id] || [];
        userOvertimes.forEach(ot => {
            const dateStr = format(new Date(ot.date), 'yyyy-MM-dd');
            if (dayDetails[dateStr]) {
                dayDetails[dateStr].overtimeHours += ot.hours;
            }
        });

        // Calculate summary stats considering technical half days (0.5d)
        const totalDays = Object.values(dayDetails).reduce((acc, d) => {
            if (!d.punchIn) return acc;
            if (d.isHalfDay && !d.isLeave) return acc + 0.5;
            return acc + 1.0;
        }, 0);
        const lateDays = Object.values(dayDetails).filter(d => d.isLate && !d.isLateSpecialCase).length;
        const earlyLogoffDays = Object.values(dayDetails).filter(d => d.isEarlyLogoff).length;

        // Get allowance info for this user
        const userAllowance = allowanceByUser[user.id];
        let allowanceText = '';
        let allowanceFromDate = '';
        let allowanceToDate = '';
        if (userAllowance) {
            allowanceText = userAllowance.type || 'Allowance';
            allowanceFromDate = format(new Date(userAllowance.date), 'MMM dd');
            allowanceToDate = format(new Date(userAllowance.date), 'MMM dd');
        }

        return {
            userId: user.id,
            name: user.name || user.email,
            email: user.email,
            designation: user.designation,
            avatarUrl: user.avatarUrl || null,
            department: user.department?.name || 'N/A',
            totalDays,
            lateDays,
            earlyLogoffDays,
            allowanceText,
            allowanceFromDate,
            allowanceToDate,
            dayDetails: Object.values(dayDetails).sort((a, b) => a.dayNum - b.dayNum)
        };
    });

    const monthName = new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' });

    return {
        success: true,
        data: {
            ledgerData,
            stats: {
                totalEmployees: users.length,
                currentMonth,
                currentYear,
                monthName,
                totalDaysInMonth: new Date(currentYear, currentMonth, 0).getDate()
            }
        }
    };
}
