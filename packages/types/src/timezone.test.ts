import { describe, expect, it } from "vitest";
import { centerDayRange, fromCenterTime, toCenterParts } from "./timezone";

describe("markaz vaqti (UTC+5)", () => {
  it("fromCenterTime: 15:30 markaz vaqti = 10:30 UTC", () => {
    expect(fromCenterTime("2026-09-21", "15:30").toISOString()).toBe("2026-09-21T10:30:00.000Z");
  });
  it("yarim tundan oldingi vaqt oldingi UTC kunga tushadi", () => {
    expect(fromCenterTime("2026-09-21", "02:00").toISOString()).toBe("2026-09-20T21:00:00.000Z");
  });
  it("toCenterParts fromCenterTime'ning teskarisi", () => {
    const d = fromCenterTime("2026-12-31", "23:45");
    expect(toCenterParts(d)).toEqual({ date: "2026-12-31", time: "23:45" });
  });
  it("centerDayRange: kun 24 soat, markaz vaqti bo'yicha", () => {
    const { start, end } = centerDayRange("2026-09-21");
    expect(start.toISOString()).toBe("2026-09-20T19:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-21T18:59:59.999Z");
  });
});
