'use client';

import React, { useState, useMemo } from "react";
import {
    Table,
    TableHeader,
    TableBody,
    TableCell,
    TableHead,
    TableRow
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ExportButton } from "@/components/ui/export-button";

interface DayDetail {
    date: Date;
    dateStr: string;
    dayNum: number;
    dayName: string;
    punchIn: Date | null;
    punchOut: Date | null;
    isLate: boolean;
    isLateSpecialCase?: boolean;
    isHalfDay?: boolean;
    isEarlyLogoff: boolean;
    isOutsideOffice: boolean;
    totalHours: number;
    isLeave?: boolean;
    leaveDetails?: any;
    overtimeHours?: number;
}

interface LedgerRow {
    userId: string;
    name: string;
    email: string;
    designation: string;
    department: string;
    avatarUrl?: string | null;
    totalDays: number;
    lateDays: number;
    earlyLogoffDays: number;
    allowanceText?: string;
    allowanceFromDate?: string;
    allowanceToDate?: string;
    dayDetails: DayDetail[];
}

export function AttendanceLedgerTable({
    ledgerData,
    monthName,
    year,
    totalDaysInMonth,
    month
}: {
    ledgerData: LedgerRow[];
    monthName: string;
    year: number;
    totalDaysInMonth: number;
    month?: number;
}) {
    const [searchTerm, setSearchTerm] = useState("");

    const filteredData = useMemo(() => {
        if (!searchTerm) return ledgerData;
        const term = searchTerm.toLowerCase();
        return ledgerData.filter(row =>
            row.name.toLowerCase().includes(term) ||
            row.email.toLowerCase().includes(term) ||
            row.department.toLowerCase().includes(term)
        );
    }, [ledgerData, searchTerm]);

    const formatTime = (date: Date | null) => {
        if (!date) return "--";
        return format(new Date(date), "h:mm a");
    };

    const formatTimeString = (timeStr?: string | null) => {
        if (!timeStr) return "--";
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return format(date, "h:mm a");
    };

    const exportColumns = useMemo(() => {
        const cols: any[] = [
            { header: "Employee", key: "name" },
            { header: "Late", key: "lateDays" },
            { header: "Allowance", key: "allowance" }
        ];
        for (let i = 1; i <= totalDaysInMonth; i++) {
            cols.push({ header: i.toString(), key: `day_${i}` });
        }
        return cols;
    }, [totalDaysInMonth]);

    const exportRows = useMemo(() => {
        return filteredData.map(row => {
            const allowance = row.allowanceFromDate && row.allowanceToDate
                ? `${row.allowanceFromDate} - ${row.allowanceToDate}`
                : row.allowanceText ? "Allowance" : "--";

            const exportRow: any = {
                name: row.name,
                lateDays: row.lateDays,
                allowance: allowance
            };

            row.dayDetails.forEach(day => {
                const isHalfOrShortLeave = day.isLeave && (day.leaveDetails?.duration === 'HALF' || day.leaveDetails?.duration === 'SHORT');
                let leaveText = '';
                if (day.isLeave) {
                    if (day.leaveDetails?.duration === 'HALF') {
                        leaveText = day.leaveDetails.halfDayType === 'FIRST_HALF' ? '1st H/L' : day.leaveDetails.halfDayType === 'SECOND_HALF' ? '2nd H/L' : 'H/L';
                    } else if (day.leaveDetails?.duration === 'SHORT') {
                        leaveText = 'S/L';
                    } else {
                        leaveText = 'L';
                    }
                }

                if (day.isLeave && !isHalfOrShortLeave) {
                    exportRow[`day_${day.dayNum}`] = leaveText;
                } else if (!day.punchIn) {
                    exportRow[`day_${day.dayNum}`] = leaveText ? leaveText : "--";
                } else {
                    let text = formatTime(day.punchIn);
                    if (day.punchOut) text += ` - ${formatTime(day.punchOut)}`;
                    if (day.isLate) text += " (LATE)";
                    if (day.isEarlyLogoff) text += " (EARLY)";
                    if (day.overtimeHours && day.overtimeHours > 0) text += ` (+${day.overtimeHours}h OT)`;
                    exportRow[`day_${day.dayNum}`] = leaveText ? `${text} [${leaveText}]` : text;
                }
            });

            return exportRow;
        });
    }, [filteredData]);

    return (
        <div className="space-y-0">
            {/* Search Bar */}
            <div className="px-4 py-3 flex items-center justify-between gap-4 bg-muted/20 border-b border-border/70">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                    <Input
                        placeholder="Search employee name, email, department..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-8 border-border/70 focus:ring-primary/20 transition-all rounded-md text-xs bg-background"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded-md transition-colors"
                        >
                            <X className="size-3 text-muted-foreground/50" />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className="hidden sm:inline text-xs font-semibold text-muted-foreground px-2 py-0.5 rounded-md border border-border/60 bg-background">
                        {filteredData.length} Employees · {monthName} {year}
                    </span>
                    <ExportButton
                        filename={`attendance-ledger-${monthName.toLowerCase()}-${year}`}
                        title={`Attendance Ledger — ${monthName} ${year}`}
                        subtitle={`${filteredData.length} employees · Generated on ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`}
                        columns={exportColumns}
                        rows={exportRows}
                        label="Export Ledger"
                        pdfFormat="a1"
                        pdfFontSize={6}
                        pdfCellPadding={3}
                    />
                </div>
            </div>

            <Table className="border-collapse" containerClassName="max-h-[calc(100vh-250px)]">
                <TableHeader className="sticky top-0 z-30 shadow-xs [&_tr]:border-b-0 bg-white">
                    {/* Main Header with Employee Info */}
                    <TableRow className="bg-white">
                        <TableHead className="p-3 text-[10px] font-bold text-foreground border-r md:sticky md:left-0 md:z-40 bg-white">
                            Employee
                        </TableHead>
                        <TableHead className="p-3 text-[10px] font-bold text-foreground text-center border-r bg-white">
                            Late
                        </TableHead>
                        <TableHead className="p-3 text-[10px] font-bold text-foreground text-center border-r bg-white">
                            Allowance
                        </TableHead>

                        {/* Date Columns */}
                        {Array.from({ length: totalDaysInMonth }).map((_, i) => (
                            <TableHead
                                key={i}
                                className="p-3 text-[9px] font-bold text-foreground/60 text-center border-r min-w-15 bg-white"
                            >
                                <div>{i + 1}</div>
                            </TableHead>
                        ))}
                    </TableRow>

                    {/* Day Name Header */}
                    <TableRow className="bg-white hover:bg-white border-b">
                        <TableHead className="py-2 px-5 text-[8px] font-bold text-muted-foreground/50 uppercase border-r md:sticky md:left-0 md:z-40 bg-white">
                            ---
                        </TableHead>
                        <TableHead className="p-3 text-[8px] font-bold text-muted-foreground/50 uppercase border-r text-center bg-white">
                            ---
                        </TableHead>
                        <TableHead className="p-3 text-[8px] font-bold text-muted-foreground/50 uppercase border-r text-center bg-white">
                            ---
                        </TableHead>
                        {Array.from({ length: totalDaysInMonth }).map((_, i) => {
                            const date = new Date(year, (month || new Date().getMonth() + 1) - 1, i + 1);
                            const dayName = format(date, 'EEE').substring(0, 1);
                            const isWeekend = format(date, 'EEE') === 'Sun';

                            return (
                                <TableHead
                                    key={i}
                                    className={cn(
                                        "p-3 text-[8px] font-bold text-center border-r min-w-15 bg-white",
                                        isWeekend ? "text-rose-500 font-bold" : "text-foreground/60"
                                    )}
                                >
                                    {dayName}
                                </TableHead>
                            );
                        })}
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {filteredData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={3 + totalDaysInMonth} className="py-20 text-center">
                                <div className="flex flex-col items-center gap-2 opacity-20">
                                    <Search className="size-8" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        No matches found
                                    </p>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredData.map((row, rowIdx) => (
                            <TableRow
                                key={row.userId}
                                className="hover:bg-muted transition-colors border-b last:border-0 group"
                            >
                                {/* Employee Name */}
                                <TableCell className="py-3 px-5 border-r md:sticky md:left-0 md:bg-card md:group-hover:bg-muted md:z-10 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="size-8 rounded-full shrink-0">
                                            {row.avatarUrl && (
                                                <AvatarImage src={row.avatarUrl} alt={row.name} className="object-cover rounded-full" />
                                            )}
                                            <AvatarFallback className="bg-muted text-muted-foreground font-bold text-[9px] group-hover:bg-primary/10 group-hover:text-primary transition-colors flex items-center justify-center size-full rounded-full">
                                                {getInitials(row.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-bold text-[11px] text-foreground truncate max-w-35 leading-tight" title={row.name}>
                                                {row.name}
                                            </span>
                                            {row.department && (
                                                <span className="text-[9px] text-muted-foreground truncate">
                                                    {row.department}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>

                                {/* Late Days Count */}
                                <TableCell className="py-3 px-3 text-center border-r border-border/40">
                                    {row.lateDays > 0 ? (
                                        <div className="inline-flex h-5 px-2 items-center justify-center rounded-md bg-rose-500/10 text-rose-600 text-[9px] font-bold border border-rose-500/20">
                                            {row.lateDays}
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground/60 text-[9px] font-bold">--</span>
                                    )}
                                </TableCell>

                                {/* Allowance/Adjustment */}
                                <TableCell className="py-3 px-3 text-center border-r border-border/40">
                                    {row.allowanceFromDate && row.allowanceToDate ? (
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="inline-flex h-5 px-2 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 text-[8px] font-bold border border-emerald-500/20 whitespace-nowrap">
                                                {row.allowanceFromDate} - {row.allowanceToDate}
                                            </div>
                                        </div>
                                    ) : row.allowanceText ? (
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="inline-flex h-5 px-2 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 text-[8px] font-bold border border-emerald-500/20 whitespace-nowrap">
                                                Allowance
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground/60 text-[9px] font-bold">--</span>
                                    )}
                                </TableCell>

                                {/* Day Columns with In/Out Times */}
                                {row.dayDetails.map((day, dayIdx) => {
                                    const isWeekend = day.dayName === 'Sat' || day.dayName === 'Sun';
                                    const isLateOrEarly = day.isLate || day.isEarlyLogoff;
                                    const isSpecialCase = day.isLateSpecialCase;
                                    const hasNoData = !day.punchIn;
                                    const isLeave = day.isLeave;
                                    const isUnpaidLeave = isLeave && day.leaveDetails?.category === 'UNPAID';
                                    const leaveName = day.leaveDetails?.leaveType || (day.leaveDetails?.category === 'SEMI_ANNUAL_POLICY_2' ? 'SICK' : day.leaveDetails?.category === 'UNPAID' ? 'UNPAID' : '');

                                    let cellTitle = 'No punch';
                                    if (isLeave) {
                                        if (day.leaveDetails?.duration === 'HALF') {
                                            const halfStr = day.leaveDetails.halfDayType === 'FIRST_HALF' ? '1st Half' : day.leaveDetails.halfDayType === 'SECOND_HALF' ? '2nd Half' : '';
                                            cellTitle = `Half Day (HL)${leaveName ? `: (${leaveName})` : ''} ${halfStr ? `(${halfStr})` : ''}`.trim();
                                        } else if (day.leaveDetails?.duration === 'SHORT') {
                                            cellTitle = `Short Leave${leaveName ? `: (${leaveName})` : ''}`;
                                            if (day.leaveDetails?.startTime && day.leaveDetails?.endTime) {
                                                cellTitle += ` | Time: ${formatTimeString(day.leaveDetails.startTime)} - ${formatTimeString(day.leaveDetails.endTime)}`;
                                            }
                                        } else {
                                            cellTitle = `Full Day${leaveName ? `: (${leaveName})` : ''}`;
                                        }
                                    } else if (day.punchIn) {
                                        cellTitle = `IN: ${format(new Date(day.punchIn), 'h:mm a')} OUT: ${format(new Date(day.punchOut || day.punchIn), 'h:mm a')}${day.isHalfDay && !isLeave ? ' (HL - Technical Half Day)' : day.isLate ? (day.isLateSpecialCase ? ' (LATE WAIVED)' : ' (LATE)') : ''}${day.isEarlyLogoff ? ' (EARLY)' : ''}`;
                                    }

                                    return (
                                        <TableCell
                                            key={dayIdx}
                                            className={cn(
                                                "py-2 px-2 text-[8px] border-r min-w-15 text-center font-mono transition-colors",
                                                isWeekend && "bg-muted/5",
                                                day.isHalfDay && !isLeave && "bg-purple-50 dark:bg-purple-950/20 border-purple-200/40",
                                                isLateOrEarly && !isSpecialCase && !day.isHalfDay && "bg-red-50 dark:bg-red-950/20",
                                                isSpecialCase && "bg-emerald-50 dark:bg-emerald-950/20",
                                                isLeave && !isUnpaidLeave && "bg-blue-50 dark:bg-blue-950/20",
                                                isUnpaidLeave && "bg-rose-100 dark:bg-rose-950/40",
                                                !isLeave && hasNoData && "bg-muted/2 text-muted-foreground/20"
                                            )}
                                            title={cellTitle}
                                        >
                                            <div className="flex flex-col items-center gap-0.5">
                                                {isLeave ? (
                                                    <span className={cn("font-bold text-[9px]", isUnpaidLeave ? "text-rose-600 dark:text-rose-400" : "text-blue-600 dark:text-blue-400")}>
                                                        {day.leaveDetails?.duration === 'HALF' ? 'HL' : day.leaveDetails?.duration === 'SHORT' ? 'S/L' : 'L'}
                                                    </span>
                                                ) : day.isHalfDay ? (
                                                    <span className="font-bold text-[9px] text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1 rounded-xs">
                                                        HL
                                                    </span>
                                                ) : null}
                                                {(!isLeave || (day.leaveDetails?.duration === 'HALF' || day.leaveDetails?.duration === 'SHORT')) && (
                                                    day.punchIn ? (
                                                        <>
                                                            <span
                                                                className={cn(
                                                                    "font-bold",
                                                                    day.isHalfDay && !isLeave && "text-purple-600 dark:text-purple-400 font-bold",
                                                                    (!day.isHalfDay || isLeave) && day.isLate && !day.isLateSpecialCase && "text-red-600 font-bold",
                                                                    day.isLateSpecialCase && "text-emerald-600 font-bold",
                                                                    day.isEarlyLogoff && "text-amber-600 font-bold"
                                                                )}
                                                            >
                                                                {formatTime(day.punchIn)}{day.isLateSpecialCase && '*'}
                                                            </span>
                                                            {day.punchOut && (
                                                                <span className="text-muted-foreground">
                                                                    {formatTime(day.punchOut)}
                                                                </span>
                                                            )}
                                                            {(day.overtimeHours && day.overtimeHours > 0) ? (
                                                                <span className="text-[7px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 border border-emerald-500/20 bg-emerald-500/10 px-1 rounded-sm">
                                                                    +{day.overtimeHours}h OT
                                                                </span>
                                                            ) : null}
                                                        </>
                                                    ) : (!isLeave || day.leaveDetails?.duration === 'HALF' || day.leaveDetails?.duration === 'SHORT') ? (
                                                        <span className="text-muted-foreground/30 font-bold">--</span>
                                                    ) : null
                                                )}
                                            </div>
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            {/* Legend */}
            <div className="px-5 py-3 bg-muted/5 border border-border/40 rounded-sm flex flex-wrap items-center gap-4 text-[9px]">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/40" />
                    <span className="font-bold text-muted-foreground">Late Arrival</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-blue-500/20 border border-blue-500/40" />
                    <span className="font-bold text-muted-foreground">Leave Taken</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-rose-500/20 border border-rose-500/40" />
                    <span className="font-bold text-muted-foreground">Unpaid Leave</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <span className="text-[6px] text-emerald-600 font-bold">+</span>
                    </div>
                    <span className="font-bold text-muted-foreground">Overtime (OT)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-muted/30" />
                    <span className="font-bold text-muted-foreground">No Punch Record</span>
                </div>
            </div>
        </div >
    );
}
