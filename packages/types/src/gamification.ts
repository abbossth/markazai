import { z } from "zod";
import { optUuid } from "./common";

export const MAX_COIN_AWARD = 1000;

/** Qo'lda coin berish/olish: musbat — berish, manfiy — ayirish; nolga ruxsat yo'q. Sabab majburiy (kim, nima uchun — hisobdorlik). */
export const coinAwardSchema = z.object({
  amount: z
    .number("required")
    .int("invalid")
    .min(-MAX_COIN_AWARD, "invalid")
    .max(MAX_COIN_AWARD, "invalid")
    .refine((v) => v !== 0, { message: "invalid" }),
  reason: z.string().trim().min(1, "required").max(200),
  groupId: optUuid,
});
export type CoinAwardInput = z.input<typeof coinAwardSchema>;

/** Davomat uchun avtomatik coin: faqat "keldi" darsi beriladi ("kelmadi" ham, "sababli" ham — 0). */
export function attendanceCoins(status: "PRESENT" | "ABSENT" | "EXCUSED" | null | undefined, perLesson: number): number {
  if (status !== "PRESENT") return 0;
  return Math.max(0, Math.trunc(perLesson));
}

/** Coin reytingi o'rinlari: ko'p coin yuqorida, teng bo'lsa bir xil o'rin ("zich" tartib). */
export function rankByCoins<T extends { id: string; coins: number }>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => b.coins - a.coins || a.id.localeCompare(b.id));
  let rank = 0;
  let prev: number | null = null;
  return sorted.map((r) => {
    if (prev === null || r.coins !== prev) rank += 1;
    prev = r.coins;
    return { ...r, rank };
  });
}
