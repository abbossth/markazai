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
 * `withTenant`dan farqli: callback'ni o'rab bo'lmaydigan joylar uchun (masalan Next.js root layout — undan keyingi
 * `{children}` renderini funksiya sifatida o'rab bo'lmaydi). Joriy va undan keyingi bajarilishlar uchun kontekstni
 * o'rnatadi (`AsyncLocalStorage.enterWith`). So'rov boshida BIR MARTA chaqirilsa, keyingi barcha Prisma so'rovlari —
 * hatto pg pool eskirgan ulanishni yopib, yangisini ochayotganda ham (haqiqiy soket I/O, kechikkan callback) — resolver
 * orqali `next/headers()`ga qayta murojaat qilmay, shu aniq qiymatdan foydalanadi.
 *
 * TARIX: 2026-09-23'da bu funksiya "xavfli" deb olib tashlangan edi (nazariy jihatdan: bitta so'rovning
 * `enterWith`i boshqa parallel so'rovga sizib chiqishi mumkin), lekin productionda buni olib tashlash HOLATNI
 * YOMONLASHTIRDI — `getSessionUser`/`/dashboard`/`/groups` xato ko'payib, ko'proq foydalanuvchi "sessiya tugadi"ga
 * chiqib keta boshladi. Demak asosiy muammo aslida `next/headers()`ning so'rov davomida KECH chaqirilgan
 * callback'lardan (masalan pg pool navbatda kutib, boshqa so'rovning ulanishi bo'shaganda davom etganda)
 * ishlamay qolishi ekan — bu holatda ALS-only (faqat resolver) yechim ancha ko'proq muvaffaqiyatsizlikka olib
 * keladi. Shuning uchun QAYTARILDI: enterWith — asosiy tezkor yo'l, resolver — faqat enterTenant chaqirilmagan
 * joylar (masalan `/api/*` route handler'lar, ular root layout orqali o'tmaydi) uchun zaxira.
 */
export function enterTenant(orgId: string): void {
  store.enterWith({ orgId });
}

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
