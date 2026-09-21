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
const store = new AsyncLocalStorage<{ orgId: string }>();

type Resolver = () => Promise<string | undefined>;
// globalThis: Next.js/Turbopack modulni bir necha marta yuklashi mumkin — resolver hammasiga umumiy bo'lsin.
const g = globalThis as unknown as { __markazaiTenantResolver?: Resolver };

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

/** pool.connect chaqirilgan paytdagi tashkilot (aniq kontekst → resolver). Xatolik → undefined (fail-closed). */
export async function currentTenantOrg(): Promise<string | undefined> {
  const explicit = store.getStore()?.orgId;
  if (explicit) return explicit;
  try {
    return await g.__markazaiTenantResolver?.();
  } catch {
    return undefined;
  }
}
