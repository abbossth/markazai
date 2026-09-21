import { isoWeekday, toISODate } from "./schedule";

export const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isPeriod = (v: string | undefined | null): v is string => !!v && PERIOD_RE.test(v);

/** "2026-09" → oyning birinchi va oxirgi kuni (UTC). */
export function periodBounds(period: string) {
  const [y, m] = period.split("-").map(Number) as [number, number];
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 0)) };
}

export function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** Oy ichidagi ish kunlari ("YYYY-MM-DD"): ISO hafta kuni `workDays` ro'yxatida bo'lganlar. */
export function scheduledWorkDays(workDays: number[], period: string): string[] {
  const set = new Set(workDays);
  const { from, to } = periodBounds(period);
  const out: string[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += 86_400_000) {
    const d = new Date(t);
    if (set.has(isoWeekday(d))) out.push(toISODate(d));
  }
  return out;
}

export type FixedBreakdown = { base: number; extraIncome: number; total: number };

/**
 * Belgilangan oylik model: kunlik stavka = oylik / oydagi ish kunlari soni.
 *  - asosiy maosh = keldi kunlari × stavka (keldi ish kunlaridan ko'p bo'lolmaydi);
 *  - qo'shimcha tushum = ish jadvalidan tashqari ("qo'shimcha") kunlar × stavka.
 * Ish kunlari bo'lmasa (jadval to'ldirilmagan) stavka aniqlanmaydi — 0.
 */
export function fixedSalaryBreakdown({ fixedSalary, scheduledCount, came, extra }: { fixedSalary: number; scheduledCount: number; came: number; extra: number }): FixedBreakdown {
  if (scheduledCount <= 0 || fixedSalary <= 0) return { base: 0, extraIncome: 0, total: 0 };
  const base = Math.round((fixedSalary * Math.min(Math.max(came, 0), scheduledCount)) / scheduledCount);
  const extraIncome = Math.round((fixedSalary * Math.max(extra, 0)) / scheduledCount);
  return { base, extraIncome, total: base + extraIncome };
}

/** Foiz modeli: o'qituvchi guruhlariga davrda kelgan (qo'lda kiritilgan) to'lovlar yig'indisining `percent`% i. */
export function percentSalary(paymentsTotal: number, percent: number): number {
  if (paymentsTotal <= 0 || percent <= 0) return 0;
  return Math.round((paymentsTotal * Math.min(percent, 100)) / 100);
}

export type PayrollInput = {
  salaryType: "PERCENT" | "FIXED";
  percent: number | null;
  fixedSalary: number | null;
  workDays: number[];
  period: string;
  /** Guruhlariga davrda kelgan to'lovlar yig'indisi (PERCENT uchun). */
  paymentsTotal: number;
  /** Davomat (FIXED uchun). */
  came: number;
  extra: number;
};

export type Payroll = {
  method: "PERCENT" | "FIXED";
  fullWorkDays: number;
  came: number;
  extra: number;
  /** PERCENT: foiz summasi; FIXED: asosiy maosh. */
  base: number;
  extraIncome: number;
  total: number;
};

/** Bitta o'qituvchining davr uchun ish haqi (ikkala model). */
export function calculatePayroll(i: PayrollInput): Payroll {
  if (i.salaryType === "PERCENT") {
    const amount = percentSalary(i.paymentsTotal, i.percent ?? 0);
    return { method: "PERCENT", fullWorkDays: 0, came: 0, extra: 0, base: amount, extraIncome: 0, total: amount };
  }
  const fullWorkDays = scheduledWorkDays(i.workDays, i.period).length;
  const f = fixedSalaryBreakdown({ fixedSalary: i.fixedSalary ?? 0, scheduledCount: fullWorkDays, came: i.came, extra: i.extra });
  return { method: "FIXED", fullWorkDays, came: i.came, extra: i.extra, base: f.base, extraIncome: f.extraIncome, total: f.total };
}
