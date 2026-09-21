import { toISODate } from "@markazai/types";
import type { Prisma, PrismaClient } from "./generated/client";

type Db = PrismaClient | Prisma.TransactionClient;

/** Tashkilotning dam olish kunlari ("YYYY-MM-DD"), ixtiyoriy [from, to] oralig'ida. */
export async function loadHolidayDates(db: Db, organizationId: string, range?: { from: Date; to: Date }): Promise<string[]> {
  const rows = await db.holiday.findMany({ where: { organizationId, ...(range && { date: { gte: range.from, lte: range.to } }) }, select: { date: true }, orderBy: { date: "asc" } });
  return rows.map((r) => toISODate(r.date));
}

/** Bitta oy uchun (year, month 1–12). */
export function loadMonthHolidays(db: Db, organizationId: string, year: number, month: number) {
  return loadHolidayDates(db, organizationId, { from: new Date(Date.UTC(year, month - 1, 1)), to: new Date(Date.UTC(year, month, 0)) });
}
