import { z } from "zod";

/** Tashkilot slug'i sifatida taqiqlangan nomlar (0.2-band): tizim xizmatlari va marketing subdomenlari. */
export const RESERVED_SLUGS = ["www", "admin", "superadmin", "api", "app", "mail", "ftp", "static", "cdn", "blog", "help", "support", "status", "docs", "login"] as const;

/** 3–32 belgi: kichik lotin harflari, raqamlar va defis; harf/raqam bilan boshlanib tugaydi; taqiqlangan nomlar yo'q. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,30})[a-z0-9]$/, { message: "invalidSlug" })
  .refine((v) => !v.includes("--"), { message: "invalidSlug" })
  .refine((v) => !(RESERVED_SLUGS as readonly string[]).includes(v), { message: "reservedSlug" });

export type HostTarget = { kind: "tenant"; slug: string } | { kind: "admin" } | { kind: "marketing" } | { kind: "unknown" };

/**
 * Host sarlavhasidan qaysi ilova qismi so'ralganini aniqlaydi.
 *  - `root` va `www.root` → marketing; `admin.root` → Control Plane; `{slug}.root` → tenant;
 *  - boshqa host (masalan IP yoki noma'lum domen) → `defaultSlug` berilgan bo'lsa (faqat dev) shu tenant, aks holda unknown.
 * Port, registr va oxirgi nuqta e'tiborga olinmaydi. `{a}.{b}.root` (ko'p darajali) tenant emas.
 */
export function parseHost(host: string | null | undefined, rootDomain: string, opts: { defaultSlug?: string } = {}): HostTarget {
  const h = (host ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  const root = rootDomain.trim().toLowerCase().replace(/:\d+$/, "");
  const fallback: HostTarget = opts.defaultSlug ? { kind: "tenant", slug: opts.defaultSlug } : { kind: "unknown" };
  if (!h || !root) return fallback;

  if (h === root) return opts.defaultSlug ? fallback : { kind: "marketing" };
  if (!h.endsWith(`.${root}`)) return fallback;

  const sub = h.slice(0, -(root.length + 1));
  if (sub === "www") return { kind: "marketing" };
  if (sub === "admin") return { kind: "admin" };
  if (sub.includes(".")) return { kind: "unknown" };
  const parsed = slugSchema.safeParse(sub);
  return parsed.success ? { kind: "tenant", slug: parsed.data } : { kind: "unknown" };
}

// ───────────── Obuna va limitlar ─────────────

export const ORG_STATUSES = ["TRIAL", "ACTIVE", "SUSPENDED", "DELETED"] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];

export const BILLING_CYCLES = [1, 3, 6, 12] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export type AccessDecision = { allowed: true } | { allowed: false; reason: "suspended" | "deleted" | "expired" };

/**
 * Tenant kirishga ruxsati: o'chirilgan/to'xtatilgan tashkilot yopiq; obuna tugagan bo'lsa (`subscriptionEnd` o'tgan) — yopiq.
 * TRIAL va ACTIVE ochiq. Obunasi umuman yo'q tashkilot (yangi, hali biriktirilmagan) — ochiq (TRIAL sifatida).
 * Sanalar "YYYY-MM-DD"; `subscriptionEnd` kuni ham ochiq hisoblanadi (keyingi kundan yopiladi).
 */
export function accessDecision(org: { status: OrgStatus; subscriptionEnd: string | null }, today: string): AccessDecision {
  if (org.status === "DELETED") return { allowed: false, reason: "deleted" };
  if (org.status === "SUSPENDED") return { allowed: false, reason: "suspended" };
  if (org.subscriptionEnd && org.subscriptionEnd < today) return { allowed: false, reason: "expired" };
  return { allowed: true };
}

/** Obuna tugash sanasi: boshlanishdan `months` oy keyin, oy oxiridan oshib ketmasin (31-yanvar + 1 oy → 28/29-fevral). */
export function subscriptionEndDate(start: string, months: number): string {
  const [y, m, d] = start.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * Uzoq muddatli tarifga chegirma: narx = oylik × oylar × (1 − chegirma). `discounts` — { oylar: foiz }.
 * Yaxlitlash — butun so'mgacha (Math.round).
 */
export function cyclePrice(monthlyPrice: number, months: number, discounts: Record<number, number> = { 1: 0, 3: 5, 6: 10, 12: 20 }): number {
  const pct = discounts[months] ?? 0;
  return Math.round(monthlyPrice * months * (1 - pct / 100));
}

export type PlanLimits = { maxStaff: number | null; maxBranches: number | null; maxStudents: number | null };

/** Limit tekshiruvi: `null` — cheksiz; joriy soni limitga yetgan bo'lsa yangisini qo'shib bo'lmaydi. */
export function withinLimit(current: number, limit: number | null): boolean {
  return limit === null || current < limit;
}

export const PLAN_MODULES = ["gamification", "integrations"] as const;
export type PlanModule = (typeof PLAN_MODULES)[number];

/** Modul yoqilganmi: reja modullari va tashkilot bo'yicha alohida bayroqlar (bayroq rejani bekor qiladi: true/false). */
export function moduleEnabled(planModules: readonly string[], flags: Record<string, boolean>, module: string): boolean {
  return module in flags ? flags[module]! : planModules.includes(module);
}
