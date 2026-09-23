import type { MetadataRoute } from "next";

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "markazai.uz";

/**
 * Faqat marketing (bosh) host uchun mazmunli — tenant subdomenlarida esa (login, dashboard va h.k.)
 * hech narsa indekslanmasin: robots va `noindex` meta (`app/(app)/layout.tsx`) birga ishlaydi.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/settings", "/groups", "/students", "/leads", "/teachers", "/finance", "/reports"] }],
    sitemap: `https://${ROOT_DOMAIN}/sitemap.xml`,
  };
}
