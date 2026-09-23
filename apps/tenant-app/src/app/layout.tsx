import type { Metadata } from "next";
import { Geist_Mono, Onest } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Providers } from "@/components/providers/providers";
import { brandCss, loadCenter, loadCenterConfig } from "@/lib/center";
import { currentTenant } from "@/lib/tenant";
import "./globals.css";

// Onest — brend qo'llanmasidagi yagona shrift (lotin + kirill, interfeys/chek/reklamada bir xil ovoz).
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Markazai", template: "%s · Markazai" },
  description: "O'quv markazlar uchun boshqaruv tizimi",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  // MUHIM: bu yerda `enterTenant`/`AsyncLocalStorage.enterWith` ISHLATILMAYDI — u butun so'rov davomida "joriy
  // kontekst"ni joyida o'zgartiradi, Node esa bir vaqtning o'zida bir nechta so'rovni (turli tashkilotlar!) bitta
  // process ichida interleaved bajarishi mumkin, shuning uchun bir so'rovning enterWith chaqiruvi boshqa,
  // parallel bajarilayotgan so'rovning keyingi Prisma ulanishlariga sizib chiqishi mumkin edi (kamdan-kam,
  // vaqt bo'yicha to'qnashganda) — buni productionda `/groups/[id]`da vaqti-vaqti bilan bitta talaba nolga
  // o'xshab qolishi (RLS "hech kim yo'q") sifatida kuzatdik. Tenant har bir Prisma ulanish so'ralganda
  // `TenantPool` orqali resolver (`currentTenant()` → `next/headers()`) yordamida aniqlanadi — bu React `cache()`
  // bilan keshlangan va Next.js'ning o'zi kafolatlagan so'rov-darajasidagi izolyatsiyaga tayanadi.
  // Chaqiruv natijasi ishlatilmaydi — faqat React `cache()`ni shu so'rov uchun oldindan "isitib qo'yish": pastdagi
  // `getSessionUser()`/sahifalar keyinroq `currentTenant()`ni chaqirganda qayta host/DB so'roviga bormaydi.
  await currentTenant();
  const [config, center] = await Promise.all([loadCenterConfig(), loadCenter()]);
  const brand = brandCss(center?.brandColor);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${onest.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>{brand && <style dangerouslySetInnerHTML={{ __html: brand }} />}</head>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <Providers config={config}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
