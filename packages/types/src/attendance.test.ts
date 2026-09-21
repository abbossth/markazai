import { describe, expect, it } from "vitest";
import { attendanceStats, type AttendanceValue } from "./attendance";

describe("attendanceStats", () => {
  const dates = ["2026-09-01", "2026-09-03", "2026-09-05", "2026-09-07", "2026-09-30"];

  it("faqat bugungacha bo'lgan darslarni sanaydi", () => {
    const records = new Map<string, AttendanceValue>([["2026-09-01", "PRESENT"]]);
    const s = attendanceStats(dates, records, "2026-09-05");
    expect(s).toMatchObject({ held: 3, present: 1, absent: 0, excused: 0, empty: 2 });
  });

  it("foiz: sababli darslar maxrajdan chiqariladi", () => {
    const records = new Map<string, AttendanceValue>([
      ["2026-09-01", "PRESENT"],
      ["2026-09-03", "ABSENT"],
      ["2026-09-05", "EXCUSED"],
      ["2026-09-07", "PRESENT"],
    ]);
    const s = attendanceStats(dates, records, "2026-09-07");
    expect(s.held).toBe(4);
    expect(s.percent).toBe(67); // 2 / (4 − 1)
  });

  it("dars bo'lmagan bo'lsa foiz null", () => {
    expect(attendanceStats(dates, new Map(), "2026-08-01").percent).toBeNull();
  });
});
