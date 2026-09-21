import { describe, expect, it } from "vitest";
import { attendanceCoins, coinAwardSchema, rankByCoins } from "./gamification";

describe("attendanceCoins", () => {
  it("faqat 'keldi' uchun beriladi", () => {
    expect(attendanceCoins("PRESENT", 2)).toBe(2);
    expect(attendanceCoins("ABSENT", 2)).toBe(0);
    expect(attendanceCoins("EXCUSED", 2)).toBe(0);
    expect(attendanceCoins(null, 2)).toBe(0);
    expect(attendanceCoins(undefined, 2)).toBe(0);
  });
  it("manfiy yoki kasr qiymat xavfsiz: manfiy 0 ga, kasr butunga", () => {
    expect(attendanceCoins("PRESENT", -5)).toBe(0);
    expect(attendanceCoins("PRESENT", 2.9)).toBe(2);
  });
});

describe("coinAwardSchema", () => {
  const ok = { amount: 5, reason: "Faol qatnashdi" };
  it("to'g'ri kirish", () => {
    expect(coinAwardSchema.safeParse(ok).success).toBe(true);
    expect(coinAwardSchema.safeParse({ ...ok, amount: -3 }).success).toBe(true);
  });
  it("nol, kasr va chegaradan tashqari qiymat rad etiladi", () => {
    expect(coinAwardSchema.safeParse({ ...ok, amount: 0 }).success).toBe(false);
    expect(coinAwardSchema.safeParse({ ...ok, amount: 1.5 }).success).toBe(false);
    expect(coinAwardSchema.safeParse({ ...ok, amount: 1001 }).success).toBe(false);
    expect(coinAwardSchema.safeParse({ ...ok, amount: -1001 }).success).toBe(false);
  });
  it("sabab majburiy", () => {
    expect(coinAwardSchema.safeParse({ ...ok, reason: "  " }).success).toBe(false);
  });
});

describe("rankByCoins", () => {
  it("ko'p coin yuqorida, teng bo'lsa bir xil o'rin", () => {
    const r = rankByCoins([
      { id: "a", coins: 10 },
      { id: "b", coins: 30 },
      { id: "c", coins: 10 },
      { id: "d", coins: 5 },
    ]);
    expect(r.map((x) => [x.id, x.rank])).toEqual([["b", 1], ["a", 2], ["c", 2], ["d", 3]]);
  });
  it("bo'sh", () => {
    expect(rankByCoins([])).toEqual([]);
  });
});
