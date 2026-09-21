import { describe, expect, it } from "vitest";
import { WIDGETS, daysLeft, defaultLayout, isTrialOverdue, loadPercent, sanitizeLayout, timeRange, timetableTab } from "./dashboard";

const all = new Set<string>(WIDGETS.map((w) => w.id));

describe("defaultLayout", () => {
  it("faqat ruxsat etilgan vidjetlar, reyestr tartibida", () => {
    const l = defaultLayout(new Set(["schedule", "activeStudents", "groups"]));
    expect(l.map((x) => x.id)).toEqual(["activeStudents", "groups", "schedule"]);
    expect(l.find((x) => x.id === "schedule")?.size).toBe("XL");
  });
});

describe("sanitizeLayout", () => {
  it("yaroqsiz kirish — sukut bo'yicha tartib", () => {
    expect(sanitizeLayout(null, all)).toEqual(defaultLayout(all));
    expect(sanitizeLayout("x", all)).toEqual(defaultLayout(all));
  });
  it("noma'lum, takroriy va ruxsatsiz vidjetlar tashlanadi", () => {
    const l = sanitizeLayout(
      [{ id: "groups", size: "M" }, { id: "groups", size: "L" }, { id: "hack", size: "S" }, { id: "debtors", size: "S" }, null, 5],
      new Set(["groups", "activeStudents"]),
    );
    expect(l).toEqual([{ id: "groups", size: "M" }]);
  });
  it("vidjet uchun ruxsat etilmagan o'lcham sukut bo'yicha o'lchamga almashadi", () => {
    // schedule faqat L/XL; paymentsChart — M/L/XL
    expect(sanitizeLayout([{ id: "schedule", size: "S" }, { id: "paymentsChart", size: "M" }, { id: "groups", size: "??" }], all)).toEqual([
      { id: "schedule", size: "XL" },
      { id: "paymentsChart", size: "M" },
      { id: "groups", size: "S" },
    ]);
  });
  it("foydalanuvchi olib tashlagan vidjet qayta qo'shilmaydi; bo'sh ro'yxat — bo'sh", () => {
    expect(sanitizeLayout([], all)).toEqual([]);
  });
});

describe("timetableTab", () => {
  it("toq / juft / boshqa", () => {
    expect(timetableTab("ODD")).toBe("ODD");
    expect(timetableTab("EVEN")).toBe("EVEN");
    for (const d of ["EVERY_DAY", "WEEKEND", "OTHER"] as const) expect(timetableTab(d)).toBe("OTHER");
  });
});

describe("daysLeft / loadPercent / isTrialOverdue / timeRange", () => {
  it("daysLeft", () => {
    expect(daysLeft("2026-10-01", "2026-09-22")).toBe(9);
    expect(daysLeft("2026-09-22", "2026-09-22")).toBe(0);
    expect(daysLeft("2026-09-01", "2026-09-22")).toBe(0);
    expect(daysLeft(null, "2026-09-22")).toBeNull();
  });
  it("loadPercent", () => {
    expect(loadPercent(9, 12)).toBe(75);
    expect(loadPercent(13, 12)).toBe(108);
    expect(loadPercent(5, 0)).toBeNull();
  });
  it("isTrialOverdue: 7 kundan keyin", () => {
    expect(isTrialOverdue("2026-09-15", "2026-09-22")).toBe(false); // aynan 7 kun
    expect(isTrialOverdue("2026-09-14", "2026-09-22")).toBe(true);
    expect(isTrialOverdue("2026-09-20", "2026-09-22", 1)).toBe(true);
  });
  it("timeRange", () => {
    expect(timeRange("09:00", 90)).toBe("09:00–10:30");
    expect(timeRange("23:30", 60)).toBe("23:30–00:30");
  });
});
