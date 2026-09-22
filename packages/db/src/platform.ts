import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated-platform/client";

export * from "./generated-platform/client";

/**
 * Control Plane bazasi (platform_db) klienti. Faqat `PLATFORM_DATABASE_URL` ishlatiladi.
 * platform-admin ilovasi FAQAT shu modulni import qiladi (tenant klienti `@markazai/db` emas): u tenant bazasiga
 * ulana olmasligi shart (0.6). tenant-app esa bu yerdan faqat o'qiydi (slug → tashkilot, obuna holati, limitlar).
 */
const g = globalThis as unknown as { platformPrisma?: PrismaClient };

function create() {
  const connectionString = process.env.PLATFORM_DATABASE_URL;
  if (!connectionString) throw new Error("PLATFORM_DATABASE_URL o'rnatilmagan");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const platformPrisma = g.platformPrisma ?? create();
if (process.env.NODE_ENV !== "production") g.platformPrisma = platformPrisma;
