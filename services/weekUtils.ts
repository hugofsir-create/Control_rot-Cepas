// Week calculation utilities for Weekly Logistics Reports

export interface WeekPeriod {
  year: number;
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  label: string;
  isCurrent: boolean;
}

/**
 * Returns the ISO week number and year for a given date.
 */
export function getISOWeekDetails(d: Date): { year: number; weekNumber: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: date.getUTCFullYear(), weekNumber: weekNo };
}

/**
 * Returns the start (Monday 00:00:00.000) and end (Sunday 23:59:59.999) of the ISO week.
 */
export function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  // Monday is 1, Sunday is 0
  const diffToMonday = day === 0 ? -6 : 1 - day;
  
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

export function formatDateShort(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

export function formatDateFull(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function getWeekPeriod(date: Date): WeekPeriod {
  const { year, weekNumber } = getISOWeekDetails(date);
  const { start, end } = getWeekRange(date);
  
  const now = new Date();
  const currentWeek = getISOWeekDetails(now);
  const isCurrent = year === currentWeek.year && weekNumber === currentWeek.weekNumber;

  return {
    year,
    weekNumber,
    startDate: start,
    endDate: end,
    label: `Semana ${weekNumber} (${formatDateShort(start)} - ${formatDateShort(end)})`,
    isCurrent
  };
}

/**
 * Returns a list of periods for selection (covering current week, past weeks, and future weeks)
 */
export function generateAvailableWeeks(referenceDates: (Date | string)[] = [], countPast = 8, countFuture = 2): WeekPeriod[] {
  const weeksMap = new Map<string, WeekPeriod>();
  const now = new Date();

  // Add surrounding weeks
  for (let offset = -countPast; offset <= countFuture; offset++) {
    const d = new Date(now);
    d.setDate(now.getDate() + (offset * 7));
    const period = getWeekPeriod(d);
    const key = `${period.year}-W${period.weekNumber}`;
    if (!weeksMap.has(key)) {
      weeksMap.set(key, period);
    }
  }

  // Add weeks from any reference dates (e.g. pallets created or remitted)
  referenceDates.forEach(ref => {
    if (!ref) return;
    const d = new Date(ref);
    if (!isNaN(d.getTime())) {
      const period = getWeekPeriod(d);
      const key = `${period.year}-W${period.weekNumber}`;
      if (!weeksMap.has(key)) {
        weeksMap.set(key, period);
      }
    }
  });

  return Array.from(weeksMap.values()).sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
}
