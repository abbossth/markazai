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

/** Vaqt bilan (mahalliy vaqt zonasida): "21.09.2026 15:30" */
export function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
