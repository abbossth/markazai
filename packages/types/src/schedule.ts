export const DAYS_PATTERNS = ["ODD", "EVEN", "EVERY_DAY", "WEEKEND", "OTHER"] as const;
export type DaysPattern = (typeof DAYS_PATTERNS)[number];

/** ISO hafta kunlari: 1 = Dushanba ... 7 = Yakshanba. */
export function weekdaysOf(pattern: DaysPattern, customDays: number[] = []): number[] {
  switch (pattern) {
    case "ODD":
      return [1, 3, 5];
    case "EVEN":
      return [2, 4, 6];
    case "EVERY_DAY":
      return [1, 2, 3, 4, 5, 6];
    case "WEEKEND":
      return [6, 7];
    case "OTHER":
      return [...new Set(customDays)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  }
}

/** Sanalar UTC yarim tunida (Prisma @db.Date shunday qaytaradi) — vaqt zonasi siljishi bo'lmaydi. */
export function isoWeekday(date: Date): number {
  return date.getUTCDay() === 0 ? 7 : date.getUTCDay();
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function fromISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

type ScheduleInput = {
  days: DaysPattern;
  customDays?: number[];
  startDate: Date;
  endDate?: Date | null;
};

/**
 * Berilgan oy (month: 1–12) ichidagi dars kunlari ("YYYY-MM-DD"), guruhning boshlanish/tugash
 * sanalari bilan chegaralangan.
 */
export function lessonDatesInMonth(group: ScheduleInput, year: number, month: number): string[] {
  const weekdays = new Set(weekdaysOf(group.days, group.customDays));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const out: string[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d < group.startDate) continue;
    if (group.endDate && d > group.endDate) break;
    if (weekdays.has(isoWeekday(d))) out.push(toISODate(d));
  }
  return out;
}
