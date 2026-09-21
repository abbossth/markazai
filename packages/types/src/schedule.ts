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
  /** Dam olish (bayram) kunlari "YYYY-MM-DD" — bu kunlarda dars bo'lmaydi. */
  holidays?: Iterable<string>;
};

/**
 * Berilgan oy (month: 1–12) ichidagi dars kunlari ("YYYY-MM-DD"), guruhning boshlanish/tugash
 * sanalari bilan chegaralangan.
 */
export function lessonDatesInMonth(group: ScheduleInput, year: number, month: number): string[] {
  const weekdays = new Set(weekdaysOf(group.days, group.customDays));
  const holidays = new Set(group.holidays ?? []);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const out: string[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d < group.startDate) continue;
    if (group.endDate && d > group.endDate) break;
    if (weekdays.has(isoWeekday(d)) && !holidays.has(toISODate(d))) out.push(toISODate(d));
  }
  return out;
}

/** [from, to] oralig'idagi (ikkala chegara kiradi) barcha dars kunlari, guruh chegaralari bilan. */
export function lessonDatesBetween(group: ScheduleInput, from: Date, to: Date): string[] {
  const out: string[] = [];
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth() + 1;
  const last = to.getUTCFullYear() * 12 + to.getUTCMonth();
  const fromIso = toISODate(from);
  const toIso = toISODate(to);
  while (y * 12 + (m - 1) <= last) {
    for (const d of lessonDatesInMonth(group, y, m)) if (d >= fromIso && d <= toIso) out.push(d);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

type OverlapInput = ScheduleInput & { startTime: string; durationMinutes: number };

/**
 * Ikki guruh jadvali to'qnashadimi: umumiy hafta kuni + vaqt oralig'i kesishishi + sana oralig'i kesishishi.
 * (Bir xona yoki bir o'qituvchi bir vaqtda ikki joyda bo'lolmaydi.)
 */
export function schedulesOverlap(a: OverlapInput, b: OverlapInput): boolean {
  const aDays = new Set(weekdaysOf(a.days, a.customDays));
  if (!weekdaysOf(b.days, b.customDays).some((d) => aDays.has(d))) return false;

  const aStart = timeToMinutes(a.startTime);
  const bStart = timeToMinutes(b.startTime);
  if (!(aStart < bStart + b.durationMinutes && bStart < aStart + a.durationMinutes)) return false;

  const far = Number.POSITIVE_INFINITY;
  const aEnd = a.endDate?.getTime() ?? far;
  const bEnd = b.endDate?.getTime() ?? far;
  return a.startDate.getTime() <= bEnd && b.startDate.getTime() <= aEnd;
}
