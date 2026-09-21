import { PrismaPg } from "@prisma/adapter-pg";
import type pg from "pg";
import { PrismaClient } from "./generated/client";
import { TenantPool } from "./tenant-pool";

export * from "./generated/client";
export * from "./tenant-context";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; adminPrisma?: PrismaClient };

/**
 * ILOVA klienti (runtime): cheklangan `markazai_app` roli (APP_DATABASE_URL) orqali ulanadi, shuning uchun RLS
 * policy'lari qo'llanadi va har ulanishga joriy tashkilot o'rnatiladi (`TenantPool`). Kontekst yo'q bo'lsa — qator ko'rinmaydi.
 * Production'da APP_DATABASE_URL SHART: aks holda (egasi ulanishi) RLS aylanib o'tilib, izolyatsiya jimgina o'chib qolardi.
 */
function createAppClient() {
  const url = process.env.APP_DATABASE_URL;
  if (!url && process.env.NODE_ENV === "production") throw new Error("APP_DATABASE_URL o'rnatilmagan: production'da RLS'siz ishga tushmaydi");
  const connectionString = url ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("APP_DATABASE_URL / DATABASE_URL o'rnatilmagan");
  return new PrismaClient({ adapter: new PrismaPg(new TenantPool({ connectionString }) as unknown as pg.Pool) });
}

/**
 * EGASI klienti: RLS'ni aylanib o'tadi. FAQAT ishonchli xizmat kodi uchun — seed, migratsiya yordamchilari, testlar.
 * So'rovlarga xizmat qiluvchi kodda ishlatilmaydi.
 */
export function getAdminPrisma(): PrismaClient {
  if (!globalForPrisma.adminPrisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL o'rnatilmagan");
    globalForPrisma.adminPrisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }
  return globalForPrisma.adminPrisma;
}

export const prisma = globalForPrisma.prisma ?? createAppClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
export * from "./lead-defaults";
export * from "./billing";
export * from "./holidays";
export * from "./gamification";
export * from "./secrets";
