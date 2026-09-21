import pg from "pg";
import { currentTenantOrg } from "./tenant-context";

type TenantClient = pg.PoolClient & { __tenantOrg?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Har bir ulanish olinganda (checkout) `app.current_org` sessiya sozlamasini joriy tashkilotga o'rnatadigan pg.Pool.
 *
 * Nega har checkout'da: ulanishlar so'rovlar orasida qayta ishlatiladi — oldingi so'rovning tashkiloti qolib ketmasligi shart.
 * Nega `connect()` ichida: Prisma har so'rov/tranzaksiya uchun ulanishni shu pool'dan oladi; interaktiv tranzaksiya
 * ulanishni oxirigacha ushlab turadi, ya'ni butun tranzaksiya bitta tashkilot ostida bo'ladi.
 * Kontekst `connect()` chaqirilgan joyda (chaqiruvchining async konteksti) olinadi, callback esa boshqa
 * kontekstda ishlashi mumkin (pool navbati) — shuning uchun qiymat closure orqali olib o'tiladi.
 * Ulanish darajasida keshlanadi: tashkilot o'zgarmasa qo'shimcha so'rov yo'q.
 */
export class TenantPool extends pg.Pool {
  // pg-pool: ham callback, ham promise shakli bor; `query()` ichki ravishda callback shaklini chaqiradi.
  // @ts-expect-error — overload'lar pg tiplarida murakkab; ikkala shakl ham quyida qayta yaratilgan.
  connect(cb?: (err: Error | undefined, client?: pg.PoolClient, done?: (release?: unknown) => void) => void): Promise<pg.PoolClient> | void {
    const orgPromise = currentTenantOrg(); // SINXRON: chaqiruvchi kontekstida boshlanadi

    const acquire = async () => {
      const org = await orgPromise;
      const client = (await super.connect()) as TenantClient;
      const value = org && UUID.test(org) ? org : "";
      try {
        if (client.__tenantOrg !== value) {
          await client.query("SELECT set_config('app.current_org', $1, false)", [value]);
          client.__tenantOrg = value;
        }
      } catch (e) {
        client.release(e as Error);
        throw e;
      }
      return client;
    };

    if (typeof cb === "function") {
      acquire().then(
        (client) => cb(undefined, client, (err?: unknown) => (client.release as (e?: unknown) => void)(err)),
        (err: Error) => cb(err, undefined, () => undefined),
      );
      return;
    }
    return acquire();
  }
}
