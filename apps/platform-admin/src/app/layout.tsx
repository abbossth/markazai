import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = { title: { default: "Markazai Control Plane", template: "%s · Markazai Control Plane" }, description: "Markazai platforma boshqaruvi" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${geist.variable} h-full antialiased`}>
      <body className="bg-background text-foreground min-h-full">{children}</body>
    </html>
  );
}
