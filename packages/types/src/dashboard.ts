import type { DaysPattern } from "./schedule";

export const WIDGET_SIZES = ["S", "M", "L", "XL"] as const;
export type WidgetSize = (typeof WIDGET_SIZES)[number];

/** Vidjet ko'rinishi uchun qaysi modulga ruxsat kerak. */
export type WidgetRequirement = "students" | "groups" | "leads" | "finance";

export type WidgetDef = {
  id: string;
  kind: "metric" | "chart" | "schedule";
  requires: WidgetRequirement;
  sizes: readonly WidgetSize[];
  defaultSize: WidgetSize;
};

const ALL_SIZES = WIDGET_SIZES;

/** Tartib — dashboard'ning sukut bo'yicha tartibi (metrikalar promptdagi ro'yxat bo'yicha, keyin diagramma va jadval). */
export const WIDGETS = [
  { id: "activeStudents", kind: "metric", requires: "students", sizes: ALL_SIZES, defaultSize: "S" },
  { id: "groups", kind: "metric", requires: "groups", sizes: ALL_SIZES, defaultSize: "S" },
  { id: "debtors", kind: "metric", requires: "finance", sizes: ALL_SIZES, defaultSize: "S" },
  { id: "activeLeads", kind: "metric", requires: "leads", sizes: ALL_SIZES, defaultSize: "S" },
  { id: "trial", kind: "metric", requires: "students", sizes: ALL_SIZES, defaultSize: "S" },
  { id: "paidThisMonth", kind: "metric", requires: "finance", sizes: ALL_SIZES, defaultSize: "S" },
  { id: "leftActiveGroup", kind: "metric", requires: "students", sizes: ALL_SIZES, defaultSize: "S" },
  { id: "trialOverdue", kind: "metric", requires: "students", sizes: ALL_SIZES, defaultSize: "S" },
  { id: "centerLoad", kind: "metric", requires: "groups", sizes: ALL_SIZES, defaultSize: "S" },
  { id: "paymentsChart", kind: "chart", requires: "finance", sizes: ["M", "L", "XL"], defaultSize: "XL" },
  { id: "schedule", kind: "schedule", requires: "groups", sizes: ["L", "XL"], defaultSize: "XL" },
] as const satisfies readonly WidgetDef[];

export type WidgetId = (typeof WIDGETS)[number]["id"];
export type LayoutItem = { id: WidgetId; size: WidgetSize };

const BY_ID = new Map<string, WidgetDef>(WIDGETS.map((w) => [w.id, w]));
export const widgetDef = (id: string) => BY_ID.get(id);

/** Foydalanuvchiga ruxsat etilgan vidjetlar uchun sukut bo'yicha tartib. */
export function defaultLayout(allowed: ReadonlySet<string>): LayoutItem[] {
  return WIDGETS.filter((w) => allowed.has(w.id)).map((w) => ({ id: w.id, size: w.defaultSize }));
}

/**
 * Saqlangan (ishonib bo'lmaydigan) tartibni tozalaydi: noma'lum, takroriy va ruxsat etilmagan vidjetlarni tashlaydi,
 * noto'g'ri o'lchamni sukut bo'yicha o'lchamga almashtiradi. Hammasi yaroqsiz bo'lsa — sukut bo'yicha tartib.
 * Foydalanuvchi olib tashlagan vidjetlar qayta qo'shilmaydi (ular "Vidjet qo'shish" orqali qaytariladi).
 */
export function sanitizeLayout(raw: unknown, allowed: ReadonlySet<string>): LayoutItem[] {
  if (!Array.isArray(raw)) return defaultLayout(allowed);
  const seen = new Set<string>();
  const out: LayoutItem[] = [];
  for (const item of raw.slice(0, 50)) {
    if (!item || typeof item !== "object") continue;
    const { id, size } = item as { id?: unknown; size?: unknown };
    if (typeof id !== "string" || seen.has(id) || !allowed.has(id)) continue;
    const def = BY_ID.get(id);
    if (!def) continue;
    seen.add(id);
    out.push({ id: def.id as WidgetId, size: def.sizes.includes(size as WidgetSize) ? (size as WidgetSize) : def.defaultSize });
  }
  return out;
}

/** Dars jadvali tablari: Toq / Juft / Boshqa (har kuni, dam olish kunlari va qo'lda tanlangan kunlar "Boshqa"ga tushadi). */
export type TimetableTab = "ODD" | "EVEN" | "OTHER";
export const TIMETABLE_TABS: readonly TimetableTab[] = ["ODD", "EVEN", "OTHER"];
export const timetableTab = (days: DaysPattern): TimetableTab => (days === "ODD" ? "ODD" : days === "EVEN" ? "EVEN" : "OTHER");

/** Tugashigacha qolgan kunlar (bugun ham hisobga olinadi); tugash sanasi yo'q bo'lsa null, o'tib ketgan bo'lsa 0. */
export function daysLeft(endDate: string | null, today: string): number | null {
  if (!endDate) return null;
  const diff = Math.round((new Date(`${endDate}T00:00:00.000Z`).getTime() - new Date(`${today}T00:00:00.000Z`).getTime()) / 86_400_000);
  return Math.max(0, diff);
}

/** Markaz yuklamasi: o'quvchilar / xona sig'imi (foiz, butun son). Sig'im 0 bo'lsa null. */
export function loadPercent(students: number, capacity: number): number | null {
  return capacity > 0 ? Math.round((students / capacity) * 100) : null;
}

export const TRIAL_DAYS = 7;

/** Sinov muddati o'tganmi: guruhga qo'shilganiga `trialDays` kundan ko'p bo'lgan. */
export function isTrialOverdue(joinedAt: string, today: string, trialDays = TRIAL_DAYS): boolean {
  const days = Math.floor((new Date(`${today}T00:00:00.000Z`).getTime() - new Date(`${joinedAt}T00:00:00.000Z`).getTime()) / 86_400_000);
  return days > trialDays;
}

/** Jadval uchun vaqt oralig'i: boshlanish + davomiylik → "HH:mm–HH:mm". */
export function timeRange(start: string, minutes: number): string {
  const total = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)) + minutes;
  return `${start}–${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
