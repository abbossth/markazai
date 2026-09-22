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
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [
      // Ommaviy ariza formasi (/apply) markaz saytiga iframe sifatida joylanishi mumkin; qolgan hamma sahifa — yo'q (clickjacking).
      { source: "/apply", headers: base },
      { source: "/((?!apply).*)", headers: [...base, { key: "X-Frame-Options", value: "DENY" }] },
    ];
  },
};

export default withNextIntl(nextConfig);
