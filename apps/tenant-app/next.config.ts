import type { NextConfig } from "next";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import createNextIntlPlugin from "next-intl/plugin";

// .env monorepo ildizida turadi (Prisma CLI ham shuni o'qiydi).
loadEnvConfig(path.resolve(process.cwd(), "../.."), process.env.NODE_ENV !== "production", console, true);

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Ichki paketlar TypeScript manba sifatida ulanadi.
  transpilePackages: ["@markazai/db", "@markazai/types"],
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
};

export default withNextIntl(nextConfig);
