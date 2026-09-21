import { describe, expect, it } from "vitest";
import { discountSchema, examSchema, isHttpUrl, onlineLessonSchema } from "./group-extras";

describe("isHttpUrl", () => {
  it("http/https qabul qilinadi", () => {
    expect(isHttpUrl("https://example.com/a?b=1")).toBe(true);
    expect(isHttpUrl("http://localhost:3000")).toBe(true);
  });
  it("javascript:, data:, file: va oddiy matn rad etiladi", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,<b>x</b>", "file:///etc/passwd", "example.com", ""]) {
      expect(isHttpUrl(bad)).toBe(false);
    }
  });
});

describe("onlineLessonSchema", () => {
  it("xavfli havolani rad etadi", () => {
    expect(onlineLessonSchema.safeParse({ title: "Dars", url: "javascript:alert(1)" }).success).toBe(false);
    expect(onlineLessonSchema.safeParse({ title: "Dars", url: "https://x.uz/v" }).success).toBe(true);
  });
});

describe("examSchema", () => {
  const ok = { name: "Nazorat", date: "2026-09-25", durationMinutes: 60, maxScore: 100, passScore: 60 };
  it("o'tish balli maksimaldan oshmasligi kerak", () => {
    expect(examSchema.safeParse(ok).success).toBe(true);
    expect(examSchema.safeParse({ ...ok, passScore: 101 }).success).toBe(false);
  });
  it("bo'sh fayl havolasi undefined bo'ladi", () => {
    const r = examSchema.safeParse({ ...ok, fileUrl: "" });
    expect(r.success && r.data.fileUrl).toBeUndefined();
  });
});

describe("discountSchema", () => {
  const ok = { studentId: "00000000-0000-4000-8000-000000000001", amount: 50_000, fromDate: "2026-09-01" };
  it("tugash sanasi boshlanishdan oldin bo'lmasligi kerak", () => {
    expect(discountSchema.safeParse({ ...ok, toDate: "2026-08-01" }).success).toBe(false);
    expect(discountSchema.safeParse({ ...ok, toDate: "2026-10-01" }).success).toBe(true);
  });
  it("summa musbat butun son bo'lishi kerak", () => {
    expect(discountSchema.safeParse({ ...ok, amount: 0 }).success).toBe(false);
    expect(discountSchema.safeParse({ ...ok, amount: 1.5 }).success).toBe(false);
  });
});
