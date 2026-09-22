import { headers } from "next/headers";
import { platformPrisma } from "@markazai/db/platform";
import { setTenantResolver } from "@markazai/db";
import { accessDecision, moduleEnabled, parseHost, toISODate, type AccessDecision, type HostTarget, type OrgStatus, type PlanLimits } from "@markazai/types";

/**
 * Tenant kontekstini aniqlash (0.2): host → slug → tashkilot (Control Plane bazasidan o'qiladi, qisqa muddat keshlanadi).
 * `ROOT_DOMAIN` — asosiy domen (production: markazai.uz). Dev'da `localhost` va `DEFAULT_TENANT_SLUG` (sukut: demo):
 * `localhost:3100` → demo, `acme.localhost:3100` → acme (brauzerlar *.localhost'ni loopback'ga yo'naltiradi).
 * Production'da sukut tenant YO'Q: noma'lum host rad etiladi.
 */
const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "localhost";
const DEFAULT_SLUG = process.env.NODE_ENV === "production" ? undefined : (process.env.DEFAULT_TENANT_SLUG ?? "demo");
const CACHE_TTL_MS = 30_000;

export type TenantInfo = {
  orgId: string;
  slug: string;
  name: string;
  status: OrgStatus;
  subscriptionEnd: string | null;
  limits: PlanLimits;
  planName: string | null;
  /** Reja + bayroqlar bo'yicha yoqilgan modullar. */
  modules: string[];
  access: AccessDecision;
};

const cache = new Map<string, { at: number; info: TenantInfo | null }>();

async function loadTenantBySlug(slug: string): Promise<TenantInfo | null> {
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.info;

  const org = await platformPrisma.organization.findUnique({
    where: { slug },
    include: { flags: true, subscriptions: { where: { status: "ACTIVE" }, orderBy: { endDate: "desc" }, take: 1, include: { plan: true } } },
  });
  let info: TenantInfo | null = null;
  if (org) {
    const sub = org.subscriptions[0];
    const subscriptionEnd = sub ? toISODate(sub.endDate) : null;
    const flags = Object.fromEntries(org.flags.map((f) => [f.module, f.enabled]));
    const planModules = sub?.plan.modules ?? [];
    const allModules = new Set([...planModules, ...Object.keys(flags)]);
    info = {
      orgId: org.id,
      slug: org.slug,
      name: org.name,
      status: org.status,
      subscriptionEnd,
      // Obunasi yo'q (yangi/sinov) tashkilot cheklanmagan hisoblanadi — Control Plane keyin reja biriktiradi.
      limits: { maxStaff: sub?.plan.maxStaff ?? null, maxBranches: sub?.plan.maxBranches ?? null, maxStudents: sub?.plan.maxStudents ?? null },
      planName: sub?.plan.name ?? null,
      modules: [...allModules].filter((m) => moduleEnabled(planModules, flags, m)),
      access: accessDecision({ status: org.status, subscriptionEnd }, toISODate(new Date())),
    };
  }
  cache.set(slug, { at: Date.now(), info });
  return info;
}

/** Keshni tozalash (Control Plane o'zgartirgach darhol qo'llash uchun; aks holda TTL ichida yangilanadi). */
export function invalidateTenantCache(slug?: string) {
  if (slug) cache.delete(slug);
  else cache.clear();
}

export async function currentHostTarget(): Promise<HostTarget> {
  const h = await headers();
  return parseHost(h.get("x-forwarded-host") ?? h.get("host"), ROOT_DOMAIN, { defaultSlug: DEFAULT_SLUG });
}

/** Joriy so'rovning tenant'i; host tenant emas yoki tashkilot topilmasa — null. */
export async function currentTenant(): Promise<TenantInfo | null> {
  const target = await currentHostTarget();
  return target.kind === "tenant" ? loadTenantBySlug(target.slug) : null;
}

/**
 * Joriy so'rov tashkiloti ID'si (RLS kontekstini ham shu beradi). Topilmasa xatolik — sahifa noto'g'ri tenant
 * ma'lumoti bilan ishlashdan ko'ra yiqilgani xavfsizroq.
 */
export async function currentOrganizationId(): Promise<string> {
  const tenant = await currentTenant();
  if (!tenant) throw new Error("Tenant aniqlanmadi (host noma'lum yoki tashkilot topilmadi)");
  return tenant.orgId;
}

// Baza qatlami har ulanishda tashkilotni shu resolver orqali so'raydi. Topilmasa — undefined: RLS hech narsa ko'rsatmaydi.
// To'xtatilgan/o'chirilgan tashkilot uchun ham kontekst beriladi (login sahifasi nomni ko'rsata olishi uchun); kirish esa
// alohida `access` tekshiruvi bilan yopiladi.
setTenantResolver(async () => (await currentTenant())?.orgId);
