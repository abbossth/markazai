import { toCenterParts } from "@markazai/types";

/** 450000 → "450 000" */
export function formatMoney(amount: number) {
  return new Intl.NumberFormat("ru-RU").format(amount).replace(/ | /g, " ");
}

/** "998901234567" → "+998 90 123 45 67" */
export function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length !== 12) return phone.startsWith("+") ? phone : `+${phone}`;
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
}

/** Date → "21.09.2026" (UTC bo'yicha — @db.Date qiymatlari uchun) */
export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

/** Vaqt bilan, markaz vaqt zonasida (server va brauzerda bir xil): "21.09.2026 15:30" */
export function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const { date: iso, time } = toCenterParts(d);
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)} ${time}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Qisqa ko'rinish (o'q yorlig'i uchun): 1 250 000 → "1.3 mln". */
export function formatCompact(amount: number, units: { million: string; thousand: string }) {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")} ${units.million}`;
  if (abs >= 1_000) return `${Math.round(amount / 1_000)} ${units.thousand}`;
  return String(amount);
}
