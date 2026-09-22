import type { NextConfig } from "next";

// DIQQAT: bu ilova ildizdagi .env'ni O'QIMAYDI (Next faqat o'z papkasidagi .env'ni yuklaydi) — shuning uchun tenant bazasi
// ulanish satri (DATABASE_URL / APP_DATABASE_URL) bu ilovaning muhitida umuman bo'lmaydi (0.6). Kerakli o'zgaruvchilar: .env.example.
const nextConfig: NextConfig = {
  transpilePackages: ["@markazai/db", "@markazai/types"],
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // Control Plane qidiruv tizimlarida ko'rinmasin
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
