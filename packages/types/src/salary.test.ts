import { describe, expect, it } from "vitest";
import { calculatePayroll, fixedSalaryBreakdown, isPeriod, percentSalary, periodBounds, scheduledWorkDays, shiftPeriod } from "./salary";
import { salaryPaymentSchema, teacherSchema } from "./teacher";

describe("period helpers", () => {
  it("isPeriod / periodBounds / shiftPeriod", () => {
    expect(isPeriod("2026-09")).toBe(true);
    for (const bad of ["2026-13", "2026-9", "26-09", "", undefined]) expect(isPeriod(bad as string)).toBe(false);
    const { from, to } = periodBounds("2026-02");
    expect([from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)]).toEqual(["2026-02-01", "2026-02-28"]);
    expect(shiftPeriod("2026-01", -1)).toBe("2025-12");
    expect(shiftPeriod("2026-12", 1)).toBe("2027-01");
  });
});

describe("scheduledWorkDays", () => {
  it("2026-09: dushanba/chorshanba/juma = 13 ta ish kuni", () => {
    const days = scheduledWorkDays([1, 3, 5], "2026-09");
    expect(days).toHaveLength(13);
    expect(days[0]).toBe("2026-09-02");
  });
  it("jadval bo'sh bo'lsa — ish kunlari yo'q", () => {
    expect(scheduledWorkDays([], "2026-09")).toEqual([]);
  });
});

describe("fixedSalaryBreakdown", () => {
  it("to'liq oy kelgan — aniq oylik maosh", () => {
    expect(fixedSalaryBreakdown({ fixedSalary: 3_000_000, scheduledCount: 13, came: 13, extra: 0 })).toEqual({ base: 3_000_000, extraIncome: 0, total: 3_000_000 });
  });
  it("kelmagan kunlar ayriladi (proporsional)", () => {
    const r = fixedSalaryBreakdown({ fixedSalary: 3_000_000, scheduledCount: 12, came: 9, extra: 0 });
    expect(r.base).toBe(2_250_000);
  });
  it("qo'shimcha kun kunlik stavka bo'yicha to'lanadi", () => {
    const r = fixedSalaryBreakdown({ fixedSalary: 2_400_000, scheduledCount: 12, came: 12, extra: 2 });
    expect(r).toEqual({ base: 2_400_000, extraIncome: 400_000, total: 2_800_000 });
  });
  it("keldi ish kunlaridan ko'p bo'lsa, asosiy maosh oylikdan oshmaydi", () => {
    expect(fixedSalaryBreakdown({ fixedSalary: 1_000_000, scheduledCount: 10, came: 15, extra: 0 }).base).toBe(1_000_000);
  });
  it("jadval yoki oylik yo'q — 0 (nolga bo'lish yo'q)", () => {
    expect(fixedSalaryBreakdown({ fixedSalary: 1_000_000, scheduledCount: 0, came: 3, extra: 1 }).total).toBe(0);
    expect(fixedSalaryBreakdown({ fixedSalary: 0, scheduledCount: 10, came: 3, extra: 1 }).total).toBe(0);
  });
});

describe("percentSalary", () => {
  it("foiz va yaxlitlash", () => {
    expect(percentSalary(1_000_000, 40)).toBe(400_000);
    expect(percentSalary(333_333, 35)).toBe(116_667);
  });
  it("to'lov yoki foiz yo'q — 0; 100% dan oshmaydi", () => {
    expect(percentSalary(0, 40)).toBe(0);
    expect(percentSalary(500_000, 0)).toBe(0);
    expect(percentSalary(500_000, 250)).toBe(500_000);
  });
});

describe("calculatePayroll", () => {
  it("PERCENT modeli to'lovlardan hisoblanadi", () => {
    const p = calculatePayroll({ salaryType: "PERCENT", percent: 40, fixedSalary: null, workDays: [], period: "2026-09", paymentsByGroup: [1_500_000, 1_000_000], came: 0, extra: 0 });
    expect(p).toMatchObject({ method: "PERCENT", base: 1_000_000, total: 1_000_000 });
  });
  it("PERCENT: guruhlar bo'yicha yaxlitlash — jami qatorlar yig'indisiga teng", () => {
    const groups = [333_333, 333_333, 333_334];
    const p = calculatePayroll({ salaryType: "PERCENT", percent: 35, fixedSalary: null, workDays: [], period: "2026-09", paymentsByGroup: groups, came: 0, extra: 0 });
    expect(p.total).toBe(groups.reduce((s, g) => s + percentSalary(g, 35), 0));
  });
  it("FIXED modeli davomatdan hisoblanadi", () => {
    const p = calculatePayroll({ salaryType: "FIXED", percent: null, fixedSalary: 2_600_000, workDays: [1, 3, 5], period: "2026-09", paymentsByGroup: [9_999_999], came: 10, extra: 1 });
    expect(p.fullWorkDays).toBe(13);
    expect(p.base).toBe(2_000_000);
    expect(p.extraIncome).toBe(200_000);
    expect(p.total).toBe(2_200_000);
  });
});

describe("teacher sxemalari", () => {
  const ok = { name: "Ali Vali", phone: "901234567", branchIds: [], salaryType: "PERCENT", percent: 40, workDays: [3, 1, 3] };
  it("foiz modeli: foiz majburiy, 0–100", () => {
    expect(teacherSchema.safeParse(ok).success).toBe(true);
    expect(teacherSchema.safeParse({ ...ok, percent: undefined }).success).toBe(false);
    expect(teacherSchema.safeParse({ ...ok, percent: 101 }).success).toBe(false);
  });
  it("belgilangan model: oylik majburiy va musbat; ish kunlari tartiblanadi", () => {
    const fixed = { ...ok, salaryType: "FIXED", percent: undefined };
    expect(teacherSchema.safeParse(fixed).success).toBe(false);
    const r = teacherSchema.safeParse({ ...fixed, fixedSalary: 3_000_000 });
    expect(r.success && r.data.workDays).toEqual([1, 3]);
  });
  it("tugash vaqti boshlanishdan keyin bo'lishi kerak; parol kamida 8 belgi", () => {
    expect(teacherSchema.safeParse({ ...ok, workStart: "18:00", workEnd: "09:00" }).success).toBe(false);
    expect(teacherSchema.safeParse({ ...ok, password: "short" }).success).toBe(false);
    expect(teacherSchema.safeParse({ ...ok, password: "" }).success).toBe(true);
  });
  it("NaN (bo'sh son maydoni) qiymati undefined bo'ladi", () => {
    const r = teacherSchema.safeParse({ ...ok, salaryType: "PERCENT", percent: 30, fixedSalary: Number.NaN });
    expect(r.success && r.data.fixedSalary).toBeUndefined();
  });
});

describe("salaryPaymentSchema", () => {
  it("davr formati va summa tekshiriladi", () => {
    const ok = { teacherId: "00000000-0000-4000-8000-000000000001", period: "2026-09", amount: 1_000_000, date: "2026-09-30" };
    expect(salaryPaymentSchema.safeParse(ok).success).toBe(true);
    expect(salaryPaymentSchema.safeParse({ ...ok, period: "2026-9" }).success).toBe(false);
    expect(salaryPaymentSchema.safeParse({ ...ok, amount: 0 }).success).toBe(false);
  });
});
