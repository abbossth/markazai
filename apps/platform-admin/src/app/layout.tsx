import type { Metadata } from "next";
import { Onest } from "next/font/google";
import "./globals.css";

// Onest — brend qo'llanmasidagi yagona shrift (lotin + kirill).
const onest = Onest({ variable: "--font-onest", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = { title: { default: "Markazai Control Plane", template: "%s · Markazai Control Plane" }, description: "Markazai platforma boshqaruvi" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${onest.variable} h-full antialiased`}>
      <body className="bg-background text-foreground min-h-full">{children}</body>
    </html>
  );
}
