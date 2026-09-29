import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDaysDifference(
  start: Date | string, 
  end: Date | string,
  holidays?: Set<string> | (Date | string)[]
) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  // Set time to midnight for consistent calculation
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  const holidaySet = holidays instanceof Set 
    ? holidays 
    : new Set(
        Array.isArray(holidays) 
          ? holidays.map(h => typeof h === "string" ? (h.includes("T") ? h.split("T")[0] : h) : formatDateKey(h)) 
          : []
      );

  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const isSunday = current.getDay() === 0; // 0 is Sunday
    const dateKey = formatDateKey(current);
    const isHoliday = holidaySet.has(dateKey);

    if (!isSunday && !isHoliday) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

export function calculateConsecutiveEndDate(
  start: Date | string,
  targetWorkingDays: number = 3,
  holidays?: Set<string> | (Date | string)[]
): string {
  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);

  const holidaySet = holidays instanceof Set 
    ? holidays 
    : new Set(
        Array.isArray(holidays) 
          ? holidays.map(h => typeof h === "string" ? (h.includes("T") ? h.split("T")[0] : h) : formatDateKey(h)) 
          : []
      );

  let count = 0;
  const current = new Date(startDate);

  while (count < targetWorkingDays) {
    const isSunday = current.getDay() === 0;
    const dateKey = formatDateKey(current);
    const isHoliday = holidaySet.has(dateKey);

    if (!isSunday && !isHoliday) {
      count++;
      if (count === targetWorkingDays) {
        break;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return formatDateKey(current);
}

export function getLeavePeriodBreakdown(
  start: Date | string,
  end: Date | string,
  holidays?: Array<{ date: Date | string; name: string }> | Set<string> | (Date | string)[]
) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  const holidayMap = new Map<string, string>();
  if (Array.isArray(holidays)) {
    for (const h of holidays) {
      if (typeof h === "object" && h !== null && "date" in h && "name" in h) {
        const key = typeof h.date === "string" ? (h.date.includes("T") ? h.date.split("T")[0] : h.date) : formatDateKey(h.date);
        holidayMap.set(key, h.name);
      } else {
        const key = typeof h === "string" ? (h.includes("T") ? h.split("T")[0] : h) : formatDateKey(h as Date);
        holidayMap.set(key, "Public Holiday");
      }
    }
  } else if (holidays instanceof Set) {
    for (const k of holidays) {
      holidayMap.set(k, "Public Holiday");
    }
  }

  let workingDays = 0;
  let sundaysCount = 0;
  const holidaysFound: { date: string; name: string }[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const isSunday = current.getDay() === 0;
    const dateKey = formatDateKey(current);
    const holidayName = holidayMap.get(dateKey);

    if (isSunday) {
      sundaysCount++;
    } else if (holidayName) {
      holidaysFound.push({ date: dateKey, name: holidayName });
    } else {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  const totalCalendarDays = workingDays + sundaysCount + holidaysFound.length;

  return {
    workingDays,
    sundaysCount,
    holidaysFound,
    totalCalendarDays,
  };
}

export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<\/?(p|div|li|br|h[1-6]|blockquote|pre)[^>]*>/gi, ' ')
    .replace(/<[^>]*>?/gm, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
