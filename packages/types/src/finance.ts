export type MonthlyBalanceStatus = "none" | "paid" | "partial" | "debt";

/**
 * Bir guruh uchun bir oylik holat.
 * charged — shu oyda yechilgan summa (musbat son), paid — shu oyda to'langan summa.
 */
export function monthlyBalanceStatus(charged: number, paid: number): MonthlyBalanceStatus {
  if (charged <= 0) return "none";
  if (paid >= charged) return "paid";
  if (paid > 0) return "partial";
  return "debt";
}

type PaymentLike = { amount: number; type: "SYSTEM" | "MANUAL"; date: Date; groupId: string | null };

/**
 * To'lovlarni (groupId, "YYYY-MM") bo'yicha guruhlaydi.
 * SYSTEM yozuvlar manfiy (yechilgan), MANUAL yozuvlar musbat (to'langan) bo'ladi.
 */
export function summarizeByGroupMonth(payments: PaymentLike[]) {
  const map = new Map<string, { groupId: string; month: string; charged: number; paid: number }>();
  for (const p of payments) {
    if (!p.groupId) continue;
    const month = p.date.toISOString().slice(0, 7);
    const key = `${p.groupId}:${month}`;
    const row = map.get(key) ?? { groupId: p.groupId, month, charged: 0, paid: 0 };
    if (p.type === "SYSTEM") row.charged += Math.abs(p.amount);
    else row.paid += p.amount;
    map.set(key, row);
  }
  return [...map.values()].map((r) => ({ ...r, status: monthlyBalanceStatus(r.charged, r.paid) }));
}
