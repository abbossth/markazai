import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Providers } from "@/components/providers/providers";
import { brandCss, loadCenter, loadCenterConfig } from "@/lib/center";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
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
  const [config, center] = await Promise.all([loadCenterConfig(), loadCenter()]);
  const brand = brandCss(center?.brandColor);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
