/**
 * Hisobotlar uchun sof hisob-kitoblar (DB'siz): foizlar, reyting o'rinlari, guruhlash.
 * Server so'rovlari (`reports/queries.ts`) xom sonlarni yig'adi, ma'no shu yerda.
 */

export const REPORT_KEYS = ["rating", "attendance", "conversion", "leads", "churn", "logs", "coins"] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export const LOG_KEYS = ["calls", "sms", "workly"] as const;
export type LogKey = (typeof LOG_KEYS)[number];

export const CONVERSION_GROUPINGS = ["source", "course", "assignee"] as const;
export type ConversionGrouping = (typeof CONVERSION_GROUPINGS)[number];

/** Foiz (0–100, bir o'nlik xona). Maxraj 0 bo'lsa — null ("—" ko'rsatiladi). */
export function percent(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((part / total) * 1000) / 10;
}

/**
 * Davomat foizi: kelgan / (kelgan + kelmagan). Sababli (EXCUSED) darslar hisobga olinmaydi —
 * talaba ularda ayblanmaydi va dars puli ham yechilmaydi (billing bilan bir xil qoida).
 */
export function attendancePercent(present: number, absent: number): number | null {
  return percent(present, present + absent);
}

/** O'rtacha ball (bir o'nlik xona); ballar yo'q bo'lsa — null. */
export function averageScore(sum: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.round((sum / count) * 10) / 10;
}

export type RatingInput = { id: string; avgScore: number; attendancePct: number | null };

/**
 * Reyting o'rinlari: o'rtacha ball kamayish tartibida, teng bo'lsa — davomat foizi yuqorisi oldinda.
 * Teng natijalar bir xil o'rin oladi (1, 2, 2, 4 emas — 1, 2, 2, 3: "zich" o'rin).
 * Natija kirish tartibida emas, o'rin bo'yicha tartiblangan.
 */
export function rankByRating<T extends RatingInput>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => b.avgScore - a.avgScore || (b.attendancePct ?? -1) - (a.attendancePct ?? -1) || a.id.localeCompare(b.id));
  let rank = 0;
  let prev: RatingInput | null = null;
  return sorted.map((r) => {
    if (!prev || prev.avgScore !== r.avgScore || (prev.attendancePct ?? -1) !== (r.attendancePct ?? -1)) rank += 1;
    prev = r;
    return { ...r, rank };
  });
}

export type ConversionLead = { key: string | null; converted: boolean; paid: boolean; daysToConvert: number | null };
export type ConversionRow = { key: string | null; leads: number; converted: number; paid: number; rate: number | null; paidRate: number | null };

/** Lidlarni kalit (manba/kurs/xodim) bo'yicha guruhlab, konversiyani hisoblaydi. Eng ko'p lidli qator birinchi. */
export function groupConversion(leads: ConversionLead[]): ConversionRow[] {
  const map = new Map<string | null, { leads: number; converted: number; paid: number }>();
  for (const l of leads) {
    const g = map.get(l.key) ?? { leads: 0, converted: 0, paid: 0 };
    g.leads += 1;
    if (l.converted) g.converted += 1;
    if (l.converted && l.paid) g.paid += 1;
    map.set(l.key, g);
  }
  return [...map.entries()]
    .map(([key, g]) => ({ key, ...g, rate: percent(g.converted, g.leads), paidRate: percent(g.paid, g.converted) }))
    .sort((a, b) => b.leads - a.leads || (a.key ?? "").localeCompare(b.key ?? ""));
}

/** Jami konversiya ko'rsatkichlari va lidning talabaga aylanishigacha o'rtacha kun. */
export function conversionSummary(leads: ConversionLead[]) {
  const converted = leads.filter((l) => l.converted);
  const days = converted.flatMap((l) => (l.daysToConvert === null ? [] : [l.daysToConvert]));
  return {
    leads: leads.length,
    converted: converted.length,
    paid: converted.filter((l) => l.paid).length,
    rate: percent(converted.length, leads.length),
    avgDaysToConvert: days.length ? Math.round((days.reduce((s, d) => s + d, 0) / days.length) * 10) / 10 : null,
  };
}

/** Ikki "YYYY-MM-DD" sana orasidagi kunlar (kamida 0). */
export function daysBetween(from: string, to: string): number {
  const ms = new Date(`${to}T00:00:00.000Z`).getTime() - new Date(`${from}T00:00:00.000Z`).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}
