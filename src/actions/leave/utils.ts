import { getDaysDifference } from "@/lib/utils";

export const getCycleKey = (m: number, y: number, sM: number) => {
  const rel = (m - sM + 12) % 12;
  const h = rel < 6 ? 'H1' : 'H2';
  const sy = (m < sM && (sM + 5) % 12 >= m) ? y - 1 : y;
  return sy + '-' + h;
};

export function getCycleRange(month: number, year: number, startMonth: number = 4) {
  const relativeMonth = (month - startMonth + 12) % 12;
  const isH1 = relativeMonth < 6;

  const cycleStartMonth = isH1 ? startMonth : ((startMonth + 6) % 12 || 12);
  const cycleEndMonth = isH1 ? ((startMonth + 5) % 12 || 12) : ((startMonth + 11) % 12 || 12);

  const cycleStartedLastYear = month < cycleStartMonth && cycleEndMonth >= month;
  const cycleSpansToNextYear = cycleEndMonth < cycleStartMonth;

  let startYear = year;
  if (cycleStartedLastYear) startYear = year - 1;

  let endYear = startYear;
  if (cycleSpansToNextYear) endYear = startYear + 1;

  return {
    start: new Date(startYear, cycleStartMonth - 1, 1),
    end: new Date(endYear, cycleEndMonth, 0, 23, 59, 59)
  };
}

export const CASUAL_ACCRUAL = 2.0;
export const SICK_ACCRUAL_SEMI = 3.0;
export const MAX_CARRY_FORWARD = 1.0;
export const MAX_TOTAL_CASUAL = 3.0;

export function round(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function splitLeaveIntoMonths(
  start: Date, 
  end: Date, 
  holidays?: Set<string> | (Date | string)[]
) {
  const parts: { month: number; year: number; days: number }[] = [];
  let current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const final = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (current <= final) {
    const m = current.getMonth();
    const y = current.getFullYear();
    const monthStart = new Date(y, m, 1);
    const nextMonthStart = new Date(y, m + 1, 1);

    const partStart = current > monthStart ? current : monthStart;
    const partEnd = final < nextMonthStart ? final : new Date(y, m + 1, 0);

    parts.push({
      month: m + 1,
      year: y,
      days: getDaysDifference(partStart, partEnd, holidays),
    });

    current = nextMonthStart;
  }
  return parts;
}
