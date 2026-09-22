import type { Metadata } from "next";
import { Geist_Mono, Onest } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { enterTenant } from "@markazai/db";
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
  // Tashkilot shu yerda BIR MARTA aniqlanadi va Node AsyncLocalStorage'ga aniq o'rnatiladi (`enterTenant`),
  // shunda so'rovning qolgan qismidagi (ichki layout/sahifalar) Prisma so'rovlari — hatto ulanish pool'i
  // eskirgan soketni yopib, yangisini ochayotganda ham — `next/headers()`ga qayta murojaat qilmaydi. Bu API
  // so'rov davomida kech chaqirilgan callback'lardan doim ham ishlayvermaydi (Dynamic APIs cheklovi) va
  // ishlamay qolgan holatda RLS hech narsa ko'rsatmay, foydalanuvchi "sessiya tugadi" bilan chiqib ketardi.
  const tenant = await currentTenant();
  if (tenant) enterTenant(tenant.orgId);
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
