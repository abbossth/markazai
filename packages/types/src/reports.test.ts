import { describe, expect, it } from "vitest";
import { attendancePercent, averageScore, conversionSummary, daysBetween, groupConversion, percent, rankByRating, type ConversionLead } from "./reports";

describe("percent", () => {
  it("bir o'nlik xonagacha yaxlitlaydi", () => {
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(2, 3)).toBe(66.7);
    expect(percent(5, 5)).toBe(100);
  });
  it("maxraj 0 bo'lsa null", () => {
    expect(percent(0, 0)).toBeNull();
    expect(percent(3, 0)).toBeNull();
  });
});

describe("attendancePercent", () => {
  it("sababli darslar hisobga olinmaydi (faqat kelgan/kelmagan)", () => {
    expect(attendancePercent(8, 2)).toBe(80);
  });
  it("hech qanday dars belgilanmagan bo'lsa null", () => {
    expect(attendancePercent(0, 0)).toBeNull();
  });
  it("hammasi kelmagan — 0", () => {
    expect(attendancePercent(0, 4)).toBe(0);
  });
});

describe("averageScore", () => {
  it("o'rtacha ball", () => {
    expect(averageScore(255, 3)).toBe(85);
    expect(averageScore(100, 3)).toBe(33.3);
  });
  it("ball yo'q — null", () => {
    expect(averageScore(0, 0)).toBeNull();
  });
});

describe("rankByRating", () => {
  it("ball bo'yicha kamayish, teng bo'lsa davomat bo'yicha", () => {
    const ranked = rankByRating([
      { id: "a", avgScore: 80, attendancePct: 90 },
      { id: "b", avgScore: 95, attendancePct: 70 },
      { id: "c", avgScore: 80, attendancePct: 100 },
    ]);
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 3],
    ]);
  });
  it("to'liq teng natijalar bir xil o'rin oladi, keyingisi ketma-ket ('zich' o'rin)", () => {
    const ranked = rankByRating([
      { id: "a", avgScore: 90, attendancePct: 100 },
      { id: "b", avgScore: 90, attendancePct: 100 },
      { id: "c", avgScore: 70, attendancePct: 50 },
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 2]);
  });
  it("davomati yo'q talaba teng ballda oxirida", () => {
    const ranked = rankByRating([
      { id: "a", avgScore: 90, attendancePct: null },
      { id: "b", avgScore: 90, attendancePct: 10 },
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["b", "a"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2]);
  });
  it("bo'sh ro'yxat", () => {
    expect(rankByRating([])).toEqual([]);
  });
});

const lead = (key: string | null, converted: boolean, paid = false, daysToConvert: number | null = null): ConversionLead => ({ key, converted, paid, daysToConvert });

describe("groupConversion", () => {
  it("kalit bo'yicha guruhlaydi, eng ko'p lidli birinchi", () => {
    const rows = groupConversion([lead("INSTAGRAM", true, true), lead("INSTAGRAM", false), lead("INSTAGRAM", true), lead("TELEGRAM", false), lead(null, false), lead(null, false)]);
    expect(rows.map((r) => r.key)).toEqual(["INSTAGRAM", null, "TELEGRAM"]);
    expect(rows[0]).toMatchObject({ leads: 3, converted: 2, paid: 1, rate: 66.7, paidRate: 50 });
    expect(rows[2]).toMatchObject({ leads: 1, converted: 0, rate: 0, paidRate: null });
  });
  it("to'lamagan konvertatsiya 'paid'ga kirmaydi; aylantirilmagan lid to'lagan bo'lolmaydi", () => {
    const rows = groupConversion([lead("A", false, true), lead("A", true, false)]);
    expect(rows[0]).toMatchObject({ converted: 1, paid: 0 });
  });
  it("bo'sh kirish", () => {
    expect(groupConversion([])).toEqual([]);
  });
});

describe("conversionSummary", () => {
  it("jami ko'rsatkichlar va o'rtacha kun", () => {
    const s = conversionSummary([lead("A", true, true, 2), lead("A", true, false, 5), lead("B", false), lead("B", true, false, null)]);
    expect(s).toEqual({ leads: 4, converted: 3, paid: 1, rate: 75, avgDaysToConvert: 3.5 });
  });
  it("lidlar yo'q", () => {
    expect(conversionSummary([])).toEqual({ leads: 0, converted: 0, paid: 0, rate: null, avgDaysToConvert: null });
  });
});

describe("daysBetween", () => {
  it("kunlar farqi", () => {
    expect(daysBetween("2026-09-01", "2026-09-22")).toBe(21);
    expect(daysBetween("2026-09-22", "2026-09-22")).toBe(0);
  });
  it("teskari tartib — 0", () => {
    expect(daysBetween("2026-09-22", "2026-09-01")).toBe(0);
  });
});
