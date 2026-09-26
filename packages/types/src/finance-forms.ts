import { z } from "zod";
import { optText, requiredDate } from "./common";
import { optUuid } from "./common";

export const PAYMENT_METHODS = ["CASH", "CARD", "TRANSFER", "PAYME", "CLICK", "UZUM"] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

/** So'm — butun musbat son (1 mlrd dan oshmaydi: bazadagi Int chegarasidan xavfsiz). */
const money = z.number("required").int("invalid").min(1, "invalid").max(1_000_000_000, "invalid");

export const paymentSchema = z.object({
  studentId: z.uuid("required"),
  groupId: optUuid,
  amount: money,
  method: z.enum(PAYMENT_METHODS),
  date: requiredDate,
  description: optText(300),
});
export type PaymentInput = z.input<typeof paymentSchema>;

export const expenseSchema = z.object({
  category: z.string().trim().min(1, "required").max(60),
  amount: money,
  date: requiredDate,
  description: optText(300),
});
export type ExpenseInput = z.input<typeof expenseSchema>;

export const withdrawalSchema = z.object({
  amount: money,
  date: requiredDate,
  note: optText(300),
});
export type WithdrawalInput = z.input<typeof withdrawalSchema>;

type Day = { date: string; revenue: number; expenses: number };

/**
 * [from, to] oralig'idagi har bir kun uchun tushum/xarajat qatori (ma'lumot yo'q kunlar 0 bilan to'ldiriladi),
 * shunda diagramma uzilib qolmaydi. Sanalar "YYYY-MM-DD".
 */
export function buildDailyTrend(from: string, to: string, revenue: Map<string, number>, expenses: Map<string, number>): Day[] {
  const out: Day[] = [];
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  for (let t = new Date(`${from}T00:00:00.000Z`).getTime(); t <= end; t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    out.push({ date, revenue: revenue.get(date) ?? 0, expenses: expenses.get(date) ?? 0 });
  }
  return out;
}

type Month = { key: string; revenue: number };

/**
 * `from`–`to` (har biri "YYYY-MM-DD") oralig'idagi har bir OY uchun tushum yig'indisi (ma'lumot yo'q oylar 0
 * bilan to'ldiriladi). `revenueByDate` — kunlik summalar xaritasi ("YYYY-MM-DD" → summa); shu yerda oyga
 * yig'iladi. Kalit — "YYYY-MM" (dashboard'dagi bir yillik to'lovlar trendi uchun).
 */
export function buildMonthlyTrend(from: string, to: string, revenueByDate: Map<string, number>): Month[] {
  const byMonth = new Map<string, number>();
  for (const [date, amount] of revenueByDate) {
    const key = date.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + amount);
  }

  const out: Month[] = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const [toY, toM] = to.slice(0, 7).split("-").map(Number);
  while (y < toY || (y === toY && m <= toM)) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push({ key, revenue: byMonth.get(key) ?? 0 });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}
