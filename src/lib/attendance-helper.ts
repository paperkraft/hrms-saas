/**
 * Returns strict start (00:00:00) and end (23:59:59) for the current day
 * to safely wrap Prisma queries without cross-day leakage.
 */
export function getTodayRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  // Create UTC dates for the start and end of the local calendar day
  // This ensures that when Prisma/Postgres saves to a @db.Date field, 
  // it captures the intended calendar day regardless of the server's local timezone.
  const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

  return { start, end };
}

export function getWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0 (Sun) to 6 (Sat)
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { start: monday, end: sunday };
}

export function formatDateKey(date: Date) {
  return date.toISOString().split('T')[0];
}