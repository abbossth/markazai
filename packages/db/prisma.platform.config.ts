import { config } from "dotenv";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Control Plane bazasi (platform_db) uchun alohida Prisma konfiguratsiyasi.
// Ishlatish: prisma <buyruq> --config prisma.platform.config.ts
config({ path: path.resolve(process.cwd(), "../../.env") });

export default defineConfig({
  schema: "prisma/platform/schema.prisma",
  migrations: { path: "prisma/platform/migrations" },
  datasource: { url: process.env.PLATFORM_DATABASE_URL ?? "" },
});
