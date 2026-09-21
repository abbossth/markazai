import type { AttendanceValue } from "./attendance";

/**
 * TIZIM YECHIMI QOIDASI (bitta joyda):
 *  - dars kuni davomat belgilangan bo'lsa yechiladi: "keldi" va "sababsiz kelmadi";
 *  - "sababli" va belgilanmagan (bo'sh) darslar yechilmaydi.
 */
export function isChargeable(status: AttendanceValue | null | undefined): boolean {
  return status === "PRESENT" || status === "ABSENT";
}

/**
 * Oylik narxning `index`-darsi (0 dan) ulushi, oyda jami `count` ta dars bo'lganda.
 * Kumulyativ yaxlitlash: barcha darslar yig'indisi HAR DOIM oylik narxga teng chiqadi
 * (oddiy `round(price/count) * count` bilan so'm yo'qolib ketmaydi).
 */
export function lessonAmount(monthlyPrice: number, index: number, count: number): number {
  if (count <= 0 || index < 0 || index >= count || monthlyPrice <= 0) return 0;
  return Math.round((monthlyPrice * (index + 1)) / count) - Math.round((monthlyPrice * index) / count);
}

type DiscountLike = { amount: number; fromDate: Date; toDate: Date | null };

/** Berilgan sanada amal qilayotgan chegirmalar yig'indisi (guruh narxidan oshib ketmaydi — `effectivePrice` chegaralaydi). */
export function activeDiscountTotal(discounts: DiscountLike[], date: Date): number {
  const t = date.getTime();
  return discounts.reduce((sum, d) => (d.fromDate.getTime() <= t && (!d.toDate || d.toDate.getTime() >= t) ? sum + d.amount : sum), 0);
}

export function effectivePrice(groupPrice: number, discountTotal: number): number {
  return Math.max(0, groupPrice - discountTotal);
}

type ChargeInput = {
  groupPrice: number;
  discounts: DiscountLike[];
  /** Guruhning shu oydagi barcha dars kunlari ("YYYY-MM-DD"), tartiblangan. */
  monthLessons: string[];
  /** Yechilayotgan dars kuni ("YYYY-MM-DD"). */
  date: string;
  status: AttendanceValue | null | undefined;
};

/**
 * Bitta dars uchun kutilayotgan yechim (musbat son; 0 — yechilmaydi).
 * Chegirma dars kunida amal qilayotgan bo'yicha hisoblanadi.
 */
export function expectedLessonCharge({ groupPrice, discounts, monthLessons, date, status }: ChargeInput): number {
  if (!isChargeable(status)) return 0;
  const index = monthLessons.indexOf(date);
  if (index === -1) return 0;
  const price = effectivePrice(groupPrice, activeDiscountTotal(discounts, new Date(`${date}T00:00:00.000Z`)));
  return lessonAmount(price, index, monthLessons.length);
}

/** Talaba balansi = to'lovlar yig'indisi (SYSTEM — manfiy, MANUAL — musbat). */
export function balanceOf(payments: { amount: number }[]): number {
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

/** Moliyaviy ko'rsatkichlar. Foyda = tushum − xarajat (yechib olish foydaga ta'sir qilmaydi). */
export function financeTotals({ revenue, expenses, withdrawals }: { revenue: number; expenses: number; withdrawals: number }) {
  return { revenue, expenses, withdrawals, profit: revenue - expenses, cashOnHand: revenue - expenses - withdrawals };
}
