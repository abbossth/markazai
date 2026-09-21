import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

export * from "./generated/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL o'rnatilmagan");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/**
 * Tenant bazasi klienti. Barcha so'rovlar organizationId bo'yicha filtrlanadi;
 * 9-bosqichda shu yerga RLS uchun `set_config('app.current_org', ...)` o'rnatiladigan
 * withTenant() helper qo'shiladi.
 */
export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
export * from "./lead-defaults";
export * from "./billing";
export * from "./holidays";
export * from "./secrets";
export * from "./gamification";
