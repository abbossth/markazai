import { describe, expect, it } from "vitest";
import { buildDailyTrend, buildMonthlyTrend, expenseSchema, paymentSchema, withdrawalSchema } from "./finance-forms";
import { activeDiscountTotal, balanceOf, effectivePrice, expectedLessonCharge, financeTotals, isChargeable, lessonAmount } from "./billing";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("isChargeable", () => {
  it("keldi va sababsiz kelmadi yechiladi; sababli va bo'sh yechilmaydi", () => {
    expect(isChargeable("PRESENT")).toBe(true);
    expect(isChargeable("ABSENT")).toBe(true);
    expect(isChargeable("EXCUSED")).toBe(false);
    expect(isChargeable(null)).toBe(false);
    expect(isChargeable(undefined)).toBe(false);
  });
});

describe("lessonAmount (kumulyativ yaxlitlash)", () => {
  it("barcha darslar yig'indisi aniq oylik narxga teng — qoldiq yo'qolmaydi", () => {
    for (const [price, count] of [[450_000, 13], [700_000, 12], [350_000, 7], [400_001, 9], [100, 3], [1, 5]] as const) {
      const total = Array.from({ length: count }, (_, i) => lessonAmount(price, i, count)).reduce((a, b) => a + b, 0);
      expect(total).toBe(price);
    }
  });
  it("teng bo'linadigan narxda hamma dars bir xil", () => {
    expect(Array.from({ length: 12 }, (_, i) => lessonAmount(600_000, i, 12))).toEqual(Array(12).fill(50_000));
  });
  it("noto'g'ri kirishlarda 0", () => {
    expect(lessonAmount(450_000, 0, 0)).toBe(0);
    expect(lessonAmount(450_000, -1, 12)).toBe(0);
    expect(lessonAmount(450_000, 12, 12)).toBe(0);
    expect(lessonAmount(0, 0, 12)).toBe(0);
  });
});

describe("chegirma", () => {
  const discounts = [
    { amount: 50_000, fromDate: d("2026-09-01"), toDate: d("2026-09-30") },
    { amount: 20_000, fromDate: d("2026-09-15"), toDate: null },
  ];
  it("sana oralig'iga qarab amal qiladi (chegaralar kiradi)", () => {
    expect(activeDiscountTotal(discounts, d("2026-08-31"))).toBe(0);
    expect(activeDiscountTotal(discounts, d("2026-09-01"))).toBe(50_000);
    expect(activeDiscountTotal(discounts, d("2026-09-15"))).toBe(70_000);
    expect(activeDiscountTotal(discounts, d("2026-09-30"))).toBe(70_000);
    expect(activeDiscountTotal(discounts, d("2026-10-01"))).toBe(20_000);
  });
  it("narx manfiy bo'lib ketmaydi", () => {
    expect(effectivePrice(450_000, 50_000)).toBe(400_000);
    expect(effectivePrice(100_000, 250_000)).toBe(0);
  });
});

describe("expectedLessonCharge", () => {
  const monthLessons = ["2026-09-02", "2026-09-04", "2026-09-07", "2026-09-09"]; // 4 ta dars
  const base = { groupPrice: 400_000, discounts: [], monthLessons };

  it("kelgan talaba: oylik narxning dars ulushi", () => {
    expect(expectedLessonCharge({ ...base, date: "2026-09-02", status: "PRESENT" })).toBe(100_000);
  });
  it("sababsiz kelmagan ham to'laydi", () => {
    expect(expectedLessonCharge({ ...base, date: "2026-09-04", status: "ABSENT" })).toBe(100_000);
  });
  it("sababli va belgilanmagan dars uchun yechilmaydi", () => {
    expect(expectedLessonCharge({ ...base, date: "2026-09-04", status: "EXCUSED" })).toBe(0);
    expect(expectedLessonCharge({ ...base, date: "2026-09-04", status: null })).toBe(0);
  });
  it("dars kuni bo'lmagan sana uchun 0", () => {
    expect(expectedLessonCharge({ ...base, date: "2026-09-03", status: "PRESENT" })).toBe(0);
  });
  it("chegirma dars kunida amal qilsa, ulush kamayadi", () => {
    const discounts = [{ amount: 40_000, fromDate: d("2026-09-05"), toDate: null }];
    expect(expectedLessonCharge({ ...base, discounts, date: "2026-09-04", status: "PRESENT" })).toBe(100_000); // hali amal qilmaydi
    expect(expectedLessonCharge({ ...base, discounts, date: "2026-09-07", status: "PRESENT" })).toBe(90_000); // 360k/4
  });
  it("oy oxiridagi barcha darslarga kelgan talaba aniq oylik narxni to'laydi", () => {
    const total = monthLessons.reduce((s, date) => s + expectedLessonCharge({ ...base, groupPrice: 450_001, date, status: "PRESENT" }), 0);
    expect(total).toBe(450_001);
  });
});

describe("balanceOf / financeTotals", () => {
  it("balans — tizim (manfiy) va qo'lda (musbat) to'lovlar yig'indisi", () => {
    expect(balanceOf([{ amount: -100_000 }, { amount: -100_000 }, { amount: 150_000 }])).toBe(-50_000);
    expect(balanceOf([])).toBe(0);
  });
  it("foyda = tushum − xarajat; yechib olish faqat kassa qoldig'iga ta'sir qiladi", () => {
    expect(financeTotals({ revenue: 10_000_000, expenses: 4_000_000, withdrawals: 3_000_000 })).toEqual({
      revenue: 10_000_000,
      expenses: 4_000_000,
      withdrawals: 3_000_000,
      profit: 6_000_000,
      cashOnHand: 3_000_000,
    });
  });
});

describe("buildDailyTrend", () => {
  it("bo'sh kunlarni 0 bilan to'ldiradi va chegaralarni o'z ichiga oladi", () => {
    const rows = buildDailyTrend("2026-09-01", "2026-09-04", new Map([["2026-09-02", 500]]), new Map([["2026-09-04", 200]]));
    expect(rows).toEqual([
      { date: "2026-09-01", revenue: 0, expenses: 0 },
      { date: "2026-09-02", revenue: 500, expenses: 0 },
      { date: "2026-09-03", revenue: 0, expenses: 0 },
      { date: "2026-09-04", revenue: 0, expenses: 200 },
    ]);
  });
  it("oy almashishini to'g'ri hal qiladi", () => {
    expect(buildDailyTrend("2026-09-29", "2026-10-02", new Map(), new Map()).map((r) => r.date)).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });
});

describe("buildMonthlyTrend", () => {
  it("har bir oy uchun kunlik summalarni yig'adi, ma'lumot yo'q oylarni 0 bilan to'ldiradi", () => {
    const revenue = new Map([
      ["2026-07-05", 100],
      ["2026-07-20", 50],
      ["2026-09-01", 200],
    ]);
    expect(buildMonthlyTrend("2026-07-01", "2026-09-26", revenue)).toEqual([
      { key: "2026-07", revenue: 150 },
      { key: "2026-08", revenue: 0 },
      { key: "2026-09", revenue: 200 },
    ]);
  });
  it("yil almashishini to'g'ri hal qiladi", () => {
    expect(buildMonthlyTrend("2025-11-15", "2026-01-05", new Map()).map((r) => r.key)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});

describe("moliyaviy forma sxemalari", () => {
  const student = "00000000-0000-4000-8000-000000000001";
  it("to'lov summasi musbat butun son bo'lishi kerak", () => {
    const ok = { studentId: student, amount: 450_000, method: "CASH", date: "2026-09-21" };
    expect(paymentSchema.safeParse(ok).success).toBe(true);
    for (const amount of [0, -5, 1.5, 2_000_000_000]) expect(paymentSchema.safeParse({ ...ok, amount }).success).toBe(false);
  });
  it("noma'lum to'lov usuli rad etiladi", () => {
    expect(paymentSchema.safeParse({ studentId: student, amount: 1000, method: "BITCOIN", date: "2026-09-21" }).success).toBe(false);
  });
  it("xarajat turi majburiy; yechib olishda faqat summa va sana", () => {
    expect(expenseSchema.safeParse({ category: " ", amount: 1000, date: "2026-09-21" }).success).toBe(false);
    expect(expenseSchema.safeParse({ category: "Ijara", amount: 1000, date: "2026-09-21" }).success).toBe(true);
    expect(withdrawalSchema.safeParse({ amount: 1000, date: "2026-09-21" }).success).toBe(true);
  });
});
