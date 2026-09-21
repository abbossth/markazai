/**
 * Markaz vaqt zonasi: O'zbekiston (UTC+5, yozgi vaqtsiz). Server UTC'da ishlasa ham,
 * eslatma muddati va ko'rsatiladigan vaqt bir xil bo'lishi uchun qat'iy ofset ishlatiladi.
 */
export const CENTER_UTC_OFFSET_HOURS = 5;
const OFFSET_MS = CENTER_UTC_OFFSET_HOURS * 3_600_000;

/** "2026-09-21" + "15:30" (markaz vaqti) → UTC Date */
export function fromCenterTime(date: string, time: string): Date {
  return new Date(new Date(`${date}T${time}:00.000Z`).getTime() - OFFSET_MS);
}

/** UTC Date → markaz vaqti bo'yicha { date: "YYYY-MM-DD", time: "HH:mm" } */
export function toCenterParts(d: Date): { date: string; time: string } {
  const iso = new Date(d.getTime() + OFFSET_MS).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** Markaz vaqti bo'yicha shu kunning boshlanishi/oxiri (UTC Date sifatida). */
export function centerDayRange(date: string): { start: Date; end: Date } {
  const start = fromCenterTime(date, "00:00");
  return { start, end: new Date(start.getTime() + 86_400_000 - 1) };
}
