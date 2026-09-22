import { describe, expect, it } from "vitest";
import { accessDecision, cyclePrice, moduleEnabled, parseHost, slugSchema, subscriptionEndDate, withinLimit } from "./tenancy";

describe("slugSchema", () => {
  it("to'g'ri slug'lar (registr kichikka keltiriladi)", () => {
    expect(slugSchema.parse("100x")).toBe("100x");
    expect(slugSchema.parse("Demo-Markaz")).toBe("demo-markaz");
  });
  it("noto'g'ri shakllar rad etiladi", () => {
    for (const bad of ["ab", "-abc", "abc-", "a b c", "abc.def", "a--b", "x".repeat(40), "чакки", "abc_def"]) expect(slugSchema.safeParse(bad).success, bad).toBe(false);
  });
  it("taqiqlangan nomlar rad etiladi", () => {
    for (const r of ["www", "admin", "superadmin", "api", "app", "mail", "ftp", "static", "cdn", "blog", "help", "support", "status", "docs", "login"]) {
      const res = slugSchema.safeParse(r);
      // uch belgidan qisqa bo'lganlar (masalan "www" — 3 ta, o'tadi) taqiqlanganligi uchun rad etilishi shart
      expect(res.success, r).toBe(false);
    }
  });
});

describe("parseHost", () => {
  const root = "markazai.uz";
  it("marketing, admin va tenant", () => {
    expect(parseHost("markazai.uz", root)).toEqual({ kind: "marketing" });
    expect(parseHost("www.markazai.uz", root)).toEqual({ kind: "marketing" });
    expect(parseHost("admin.markazai.uz", root)).toEqual({ kind: "admin" });
    expect(parseHost("100x.markazai.uz", root)).toEqual({ kind: "tenant", slug: "100x" });
  });
  it("port, registr va oxirgi nuqta e'tiborga olinmaydi", () => {
    expect(parseHost("Demo.MarkazAI.uz:443", root)).toEqual({ kind: "tenant", slug: "demo" });
    expect(parseHost("demo.markazai.uz.", root)).toEqual({ kind: "tenant", slug: "demo" });
  });
  it("taqiqlangan/ko'p darajali/begona host — unknown", () => {
    expect(parseHost("api.markazai.uz", root)).toEqual({ kind: "unknown" });
    expect(parseHost("a.b.markazai.uz", root)).toEqual({ kind: "unknown" });
    expect(parseHost("evil.com", root)).toEqual({ kind: "unknown" });
    expect(parseHost("markazai.uz.evil.com", root)).toEqual({ kind: "unknown" });
    expect(parseHost("evilmarkazai.uz", root)).toEqual({ kind: "unknown" });
    expect(parseHost(null, root)).toEqual({ kind: "unknown" });
  });
  it("dev: localhost — sukut bo'yicha tenant, demo.localhost — demo", () => {
    expect(parseHost("localhost:3100", "localhost", { defaultSlug: "demo" })).toEqual({ kind: "tenant", slug: "demo" });
    expect(parseHost("acme.localhost:3100", "localhost", { defaultSlug: "demo" })).toEqual({ kind: "tenant", slug: "acme" });
    expect(parseHost("127.0.0.1:3100", "localhost", { defaultSlug: "demo" })).toEqual({ kind: "tenant", slug: "demo" });
    expect(parseHost("admin.localhost:3100", "localhost", { defaultSlug: "demo" })).toEqual({ kind: "admin" });
  });
});

describe("accessDecision", () => {
  const today = "2026-09-22";
  it("faol va sinov ochiq", () => {
    expect(accessDecision({ status: "ACTIVE", subscriptionEnd: "2026-12-01" }, today)).toEqual({ allowed: true });
    expect(accessDecision({ status: "TRIAL", subscriptionEnd: null }, today)).toEqual({ allowed: true });
  });
  it("to'xtatilgan va o'chirilgan yopiq", () => {
    expect(accessDecision({ status: "SUSPENDED", subscriptionEnd: "2027-01-01" }, today)).toEqual({ allowed: false, reason: "suspended" });
    expect(accessDecision({ status: "DELETED", subscriptionEnd: null }, today)).toEqual({ allowed: false, reason: "deleted" });
  });
  it("obuna tugash kuni ochiq, keyingi kundan yopiq", () => {
    expect(accessDecision({ status: "ACTIVE", subscriptionEnd: "2026-09-22" }, today)).toEqual({ allowed: true });
    expect(accessDecision({ status: "ACTIVE", subscriptionEnd: "2026-09-21" }, today)).toEqual({ allowed: false, reason: "expired" });
  });
});

describe("subscriptionEndDate", () => {
  it("oddiy va oy oxiri", () => {
    expect(subscriptionEndDate("2026-09-22", 1)).toBe("2026-10-22");
    expect(subscriptionEndDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(subscriptionEndDate("2028-01-31", 1)).toBe("2028-02-29");
    expect(subscriptionEndDate("2026-11-15", 3)).toBe("2027-02-15");
    expect(subscriptionEndDate("2026-09-22", 12)).toBe("2027-09-22");
  });
});

describe("cyclePrice", () => {
  it("uzoq muddat chegirma bilan", () => {
    expect(cyclePrice(1_000_000, 1)).toBe(1_000_000);
    expect(cyclePrice(1_000_000, 3)).toBe(2_850_000);
    expect(cyclePrice(1_000_000, 12)).toBe(9_600_000);
  });
  it("noma'lum davr — chegirmasiz", () => {
    expect(cyclePrice(500_000, 2)).toBe(1_000_000);
  });
});

describe("withinLimit / moduleEnabled", () => {
  it("limit", () => {
    expect(withinLimit(49, 50)).toBe(true);
    expect(withinLimit(50, 50)).toBe(false);
    expect(withinLimit(10_000, null)).toBe(true);
  });
  it("bayroq rejani bekor qiladi", () => {
    expect(moduleEnabled(["gamification"], {}, "gamification")).toBe(true);
    expect(moduleEnabled([], {}, "gamification")).toBe(false);
    expect(moduleEnabled([], { gamification: true }, "gamification")).toBe(true);
    expect(moduleEnabled(["gamification"], { gamification: false }, "gamification")).toBe(false);
  });
});
