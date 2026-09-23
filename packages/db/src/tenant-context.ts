import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Joriy tashkilot (tenant) konteksti — RLS uchun `app.current_org` shundan olinadi.
 *
 * Ikki manba:
 *  1. `withTenant(orgId, fn)` — aniq kontekst (provisioning, cron, skriptlar);
 *  2. resolver — so'rov ichida (masalan, Next.js `headers()` → host → tashkilot). Ilova ishga tushganda `setTenantResolver` bilan
 *     o'rnatiladi. Resolver so'rov kontekstida SINXRON chaqiriladi (pool.connect chaqirilgan joyda), shuning uchun boshqa
 *     so'rovning konteksti aralashib ketmaydi.
 * Hech biri org bermasa — `undefined`: RLS hech qanday qatorni ko'rsatmaydi (fail-closed).
 */
type Resolver = () => Promise<string | undefined>;
// globalThis: Next.js/Turbopack bir modulni bir necha nusxada yuklashi mumkin (masalan route va instrumentation alohida).
// Store va resolver hammasiga UMUMIY bo'lmasa, bir nusxadagi `withTenant` boshqasidagi pool'ga ko'rinmay qolib,
// so'rov jimgina boshqa (host bo'yicha) tashkilot kontekstida bajarilardi.
const g = globalThis as unknown as { __markazaiTenantResolver?: Resolver; __markazaiTenantStore?: AsyncLocalStorage<{ orgId: string }> };
const store = (g.__markazaiTenantStore ??= new AsyncLocalStorage<{ orgId: string }>());

export function setTenantResolver(fn: Resolver) {
  g.__markazaiTenantResolver = fn;
}

/**
 * `fn` shu tashkilot kontekstida bajariladi. MUHIM: `await fn()` doira ICHIDA — Prisma so'rovlari "lazy" (PrismaPromise `.then`
 * chaqirilganda ishga tushadi), shuning uchun `fn` ichidan qaytarilgan tugallanmagan so'rov doiradan tashqarida bajarilib,
 * kontekstni yo'qotgan bo'lardi.
 */
export function withTenant<T>(orgId: string, fn: () => PromiseLike<T> | T): Promise<T> {
  return store.run({ orgId }, async () => await fn());
}

/**
 * DIQQAT: bu yerda ataylab `AsyncLocalStorage.enterWith` asosidagi "enterTenant" YO'Q (avval bo'lgan, olib
 * tashlandi). `enterWith` joriy async kontekstni JOYIDA o'zgartiradi — Node esa bir process ichida bir nechta
 * so'rovni (turli tashkilotlar!) interleaved bajarishi mumkin, shuning uchun bitta so'rovning `enterWith`
 * chaqiruvi, vaqt jihatdan to'qnashganda, BOSHQA parallel so'rovning keyingi Prisma ulanishlariga sizib chiqishi
 * mumkin edi — productionda buni `/groups/[id]`da vaqti-vaqti bilan bitta yozuv "RLS hech kim yo'q" bilan
 * qaytishi sifatida kuzatdik. Hozir yagona yo'l: `withTenant` (`store.run` — xavfsiz, alohida branch yaratadi)
 * yoki resolver (`setTenantResolver`, Next.js so'rov ichida `next/headers()` orqali, React `cache()` bilan
 * keshlangan — bu Next.js'ning o'zi kafolatlagan so'rov-darajasidagi izolyatsiyaga tayanadi).
 */

/** pool.connect chaqirilgan paytdagi tashkilot (aniq kontekst → resolver). Xatolik → undefined (fail-closed). */
export async function currentTenantOrg(): Promise<string | undefined> {
  const explicit = store.getStore()?.orgId;
  if (explicit) return explicit;
  try {
    const resolved = await g.__markazaiTenantResolver?.();
    // VAQTINCHALIK TASHXIS: resolver bo'sh qaytarsa (RLS "hech kim yo'q" deydi) — buni ko'rish uchun.
    if (!resolved) console.error("[diag currentTenantOrg] resolver bo'sh qiymat qaytardi", { hasResolver: !!g.__markazaiTenantResolver });
    return resolved;
  } catch (e) {
    console.error("[diag currentTenantOrg] resolver xatolik berdi", e);
    return undefined;
  }
}
