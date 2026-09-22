import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";

export const metadata: Metadata = { title: "Markazai — o'quv markazlar uchun CRM" };

/** Asosiy domen (markazai.uz / www) — marketing sahifasi. Har bir markaz o'z subdomenida ishlaydi: {slug}.markazai.uz. */
export default function MarketingPage() {
  return (
    <main className="bg-muted/40 flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-2xl">
        <GraduationCap className="size-9" />
      </div>
      <h1 className="text-4xl font-semibold">Markazai</h1>
      <p className="text-muted-foreground max-w-md">O&apos;quv markazlar uchun boshqaruv tizimi: lidlar, guruhlar, talabalar, moliya va hisobotlar — bir joyda.</p>
      <p className="text-muted-foreground text-sm">Markazingiz manzili: <span className="font-mono">markaz-nomi.markazai.uz</span></p>
    </main>
  );
}
