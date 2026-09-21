import { describe, expect, it } from "vitest";
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
