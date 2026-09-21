import { describe, expect, it } from "vitest";
import { fromISODate, isoWeekday, lessonDatesBetween, lessonDatesInMonth, schedulesOverlap, weekdaysOf } from "./schedule";

describe("weekdaysOf", () => {
  it("toq/juft/har kuni/dam olish kuni", () => {
    expect(weekdaysOf("ODD")).toEqual([1, 3, 5]);
    expect(weekdaysOf("EVEN")).toEqual([2, 4, 6]);
    expect(weekdaysOf("EVERY_DAY")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(weekdaysOf("WEEKEND")).toEqual([6, 7]);
  });

  it("OTHER: takrorlarni olib tashlaydi, tartiblaydi va noto'g'ri kunlarni tashlaydi", () => {
    expect(weekdaysOf("OTHER", [5, 2, 2, 9, 0])).toEqual([2, 5]);
  });
});

describe("isoWeekday", () => {
  it("yakshanba = 7, dushanba = 1", () => {
    expect(isoWeekday(fromISODate("2026-09-20"))).toBe(7); // yakshanba
    expect(isoWeekday(fromISODate("2026-09-21"))).toBe(1); // dushanba
  });
});

describe("lessonDatesInMonth", () => {
  const base = { days: "ODD" as const, startDate: fromISODate("2026-01-01") };

  it("toq kunlar: 2026-09 oyida Du/Chor/Ju", () => {
    const dates = lessonDatesInMonth(base, 2026, 9);
    expect(dates[0]).toBe("2026-09-02"); // chorshanba
    expect(dates).toContain("2026-09-21");
    expect(dates.length).toBe(13);
  });

  it("guruh boshlanish sanasidan oldingi kunlar kirmaydi", () => {
    const dates = lessonDatesInMonth({ ...base, startDate: fromISODate("2026-09-15") }, 2026, 9);
    expect(dates[0]).toBe("2026-09-16");
  });

  it("tugash sanasidan keyingi kunlar kirmaydi", () => {
    const dates = lessonDatesInMonth({ ...base, endDate: fromISODate("2026-09-10") }, 2026, 9);
    expect(dates.at(-1)).toBe("2026-09-09");
  });

  it("guruh hali boshlanmagan oyda bo'sh ro'yxat", () => {
    expect(lessonDatesInMonth({ ...base, startDate: fromISODate("2026-10-01") }, 2026, 9)).toEqual([]);
  });
});

describe("lessonDatesBetween", () => {
  it("oylar oralig'ida chegaralar bilan dars kunlarini qaytaradi", () => {
    const g = { days: "WEEKEND" as const, startDate: fromISODate("2026-01-01") };
    const dates = lessonDatesBetween(g, fromISODate("2026-08-29"), fromISODate("2026-09-06"));
    expect(dates).toEqual(["2026-08-29", "2026-08-30", "2026-09-05", "2026-09-06"]);
  });

  it("yil almashishini to'g'ri hal qiladi", () => {
    const g = { days: "EVERY_DAY" as const, startDate: fromISODate("2025-01-01") };
    const dates = lessonDatesBetween(g, fromISODate("2025-12-30"), fromISODate("2026-01-02"));
    expect(dates).toEqual(["2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02"]);
  });
});

describe("schedulesOverlap", () => {
  const base = { days: "ODD" as const, startTime: "09:00", durationMinutes: 90, startDate: fromISODate("2026-01-01"), endDate: null };

  it("bir xil kun va vaqt — to'qnashadi", () => {
    expect(schedulesOverlap(base, { ...base, startTime: "10:00" })).toBe(true);
  });
  it("vaqt ketma-ket (biri tugagan zahoti ikkinchisi boshlansa) — to'qnashmaydi", () => {
    expect(schedulesOverlap(base, { ...base, startTime: "10:30" })).toBe(false);
  });
  it("kunlar kesishmasa (toq va juft) — to'qnashmaydi", () => {
    expect(schedulesOverlap(base, { ...base, days: "EVEN" })).toBe(false);
  });
  it("OTHER kunlari toq guruh bilan kesishsa — to'qnashadi", () => {
    expect(schedulesOverlap(base, { ...base, days: "OTHER", customDays: [5, 7] })).toBe(true);
  });
  it("sana oralig'lari kesishmasa — to'qnashmaydi", () => {
    const a = { ...base, endDate: fromISODate("2026-03-31") };
    expect(schedulesOverlap(a, { ...base, startDate: fromISODate("2026-04-01") })).toBe(false);
  });
});

describe("dam olish kunlari", () => {
  const g = { days: "ODD" as const, startDate: new Date("2026-09-01T00:00:00.000Z") };
  it("dars kuni bayramga to'g'ri kelsa, u ro'yxatdan chiqariladi", () => {
    const all = lessonDatesInMonth(g, 2026, 9);
    // 2026-09-02 — chorshanba (toq kun)
    expect(all).toContain("2026-09-02");
    const withHoliday = lessonDatesInMonth({ ...g, holidays: ["2026-09-02"] }, 2026, 9);
    expect(withHoliday).toEqual(all.filter((d) => d !== "2026-09-02"));
  });
  it("dars kuni bo'lmagan bayram hech narsani o'zgartirmaydi", () => {
    expect(lessonDatesInMonth({ ...g, holidays: ["2026-09-01"] }, 2026, 9)).toEqual(lessonDatesInMonth(g, 2026, 9));
  });
});
