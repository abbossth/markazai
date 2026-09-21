import { describe, expect, it } from "vitest";
import { monthlyBalanceStatus, summarizeByGroupMonth } from "./finance";

describe("monthlyBalanceStatus", () => {
  it("yechim bo'lmasa — none", () => expect(monthlyBalanceStatus(0, 100_000)).toBe("none"));
  it("to'liq to'langan (aniq va ortiqcha) — paid", () => {
    expect(monthlyBalanceStatus(450_000, 450_000)).toBe("paid");
    expect(monthlyBalanceStatus(450_000, 500_000)).toBe("paid");
  });
  it("qisman — partial", () => expect(monthlyBalanceStatus(450_000, 200_000)).toBe("partial"));
  it("to'lov yo'q — debt", () => expect(monthlyBalanceStatus(450_000, 0)).toBe("debt"));
});

describe("summarizeByGroupMonth", () => {
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  it("tizim yechimi va qo'lda to'lovni oy/guruh bo'yicha yig'adi", () => {
    const rows = summarizeByGroupMonth([
      { groupId: "g1", type: "SYSTEM", amount: -450_000, date: d("2026-09-02") },
      { groupId: "g1", type: "MANUAL", amount: 200_000, date: d("2026-09-05") },
      { groupId: "g1", type: "MANUAL", amount: 250_000, date: d("2026-09-20") },
      { groupId: "g1", type: "SYSTEM", amount: -450_000, date: d("2026-08-02") },
    ]);
    const sep = rows.find((r) => r.month === "2026-09");
    const aug = rows.find((r) => r.month === "2026-08");
    expect(sep).toMatchObject({ charged: 450_000, paid: 450_000, status: "paid" });
    expect(aug).toMatchObject({ charged: 450_000, paid: 0, status: "debt" });
  });

  it("guruhsiz to'lovlar hisobga olinmaydi", () => {
    expect(summarizeByGroupMonth([{ groupId: null, type: "MANUAL", amount: 100_000, date: d("2026-09-01") }])).toEqual([]);
  });
});
