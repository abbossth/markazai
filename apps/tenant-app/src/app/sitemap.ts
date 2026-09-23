import type { MetadataRoute } from "next";

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "markazai.uz";

/** Faqat marketing (bosh) sahifa — tenant ichki sahifalari `robots.ts`da indeksdan chiqarilgan. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `https://${ROOT_DOMAIN}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 }];
}
