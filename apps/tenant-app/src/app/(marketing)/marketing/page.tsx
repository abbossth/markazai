import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  Building2,
  Calendar,
  Check,
  CloudCog,
  GraduationCap,
  Languages,
  Mail,
  ShieldCheck,
  Trophy,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { platformPrisma } from "@markazai/db/platform";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { DashboardMock } from "./dashboard-mock";
import { SubdomainForm } from "./subdomain-form";

export const metadata: Metadata = {
  title: "Markazai — o'quv markazlar uchun boshqaruv tizimi",
  description: "Lidlar, guruhlar, talabalar, moliya, hisobotlar va gamifikatsiya — bitta tizimda. Har bir o'quv markaz uchun o'z shaxsiy manzili.",
};

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "markazai.uz";
const CONTACT_EMAIL = "hello@markazai.uz";

const FEATURES = [
  { icon: Users, title: "Lidlar va CRM", desc: "Kanban doska, avtomatik konversiya, qo'ng'iroq va SMS jurnali — birorta ariza ham yo'qolmaydi." },
  { icon: Calendar, title: "Guruhlar va jadval", desc: "Dars jadvali, davomat, baholash — bir necha bosishda. Xona va o'qituvchi to'qnashuvi avtomatik oldini olinadi." },
  { icon: Wallet, title: "Moliya", desc: "To'lovlar dars-dars avtomatik hisoblanadi, qarzdorlar, xarajatlar, ish haqi va chek — bir joyda." },
  { icon: BarChart3, title: "Hisobotlar", desc: "Reyting, davomat, konversiya, churn — markazingiz haqidagi haqiqiy rasm, real vaqtda." },
  { icon: Trophy, title: "Gamifikatsiya", desc: "Coin tizimi bilan o'quvchilarni motivatsiya qiling — davomat uchun avtomatik, o'qituvchi qo'lda beradi." },
  { icon: Building2, title: "Ko'p filial, bitta hisob", desc: "Xodimlarni bir nechta filialga biriktiring, rollarni moslashtiring — hammasi bitta boshqaruv panelida." },
];

const VALUES = [
  { icon: ShieldCheck, title: "Xavfsiz izolyatsiya", desc: "Har bir markazning ma'lumoti baza darajasida ajratilgan (Row-Level Security) — boshqa markaz hech qachon ko'rinmaydi." },
  { icon: Languages, title: "3 tilda", desc: "O'zbek, rus va ingliz tillarida — xodim va talabalar o'ziga qulay tilni tanlaydi." },
  { icon: CloudCog, title: "To'liq bulutli", desc: "O'rnatish shart emas — istalgan qurilma, istalgan brauzerdan kiring." },
  { icon: Zap, title: "Tezkor start", desc: "So'rov qoldirasiz, biz sozlab beramiz — markazingiz bir necha soatda ishga tushadi." },
];

const FAQ = [
  { q: "Markazai nima va kim uchun?", a: "Markazai — til kurslari, repetitorlik markazlari, IT akademiyalar kabi o'quv markazlar uchun to'liq boshqaruv tizimi (CRM): lidlardan tortib moliya va hisobotlargacha." },
  { q: "Sinov muddati bormi?", a: "Ha. Yangi markaz sinov (trial) holatida ochiladi — tizimni to'liq sinab ko'rasiz, so'ng qulay tarifni tanlaysiz." },
  { q: "Ma'lumotlarim xavfsizmi?", a: "Ha. Har bir markazning ma'lumoti baza darajasida (PostgreSQL Row-Level Security) ajratilgan — bu boshqa dasturchining xatosiga emas, arxitekturaning o'ziga tayanadi." },
  { q: "Qanday to'lash mumkin?", a: "Payme, Click yoki bank o'tkazmasi orqali — menejerimiz bilan bog'lanib, tarifni tasdiqlaysiz." },
];

async function loadPlans() {
  try {
    return await platformPrisma.plan.findMany({ where: { isActive: true }, orderBy: { monthlyPrice: "asc" } });
  } catch {
    return [];
  }
}

const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(n).replace(/ /g, " ");
const limit = (n: number | null, unit: string) => (n === null ? `Cheksiz ${unit}` : `${n} tagacha ${unit}`);

export default async function MarketingPage() {
  const plans = await loadPlans();

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
      {/* ───────── Header ───────── */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="#" className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              <GraduationCap className="size-4.5" />
            </span>
            Markazai
          </Link>
          <nav className="ml-4 hidden items-center gap-6 text-sm text-slate-600 md:flex dark:text-slate-300">
            <Link href="#imkoniyatlar" className="hover:text-slate-900 dark:hover:text-white">
              Imkoniyatlar
            </Link>
            <Link href="#qanday-ishlaydi" className="hover:text-slate-900 dark:hover:text-white">
              Qanday ishlaydi
            </Link>
            <Link href="#narxlar" className="hover:text-slate-900 dark:hover:text-white">
              Narxlar
            </Link>
            <Link href="#savollar" className="hover:text-slate-900 dark:hover:text-white">
              Savollar
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link
              href={`mailto:${CONTACT_EMAIL}`}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-slate-900"
            >
              Bog&apos;lanish
            </Link>
          </div>
        </div>
      </header>

      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 h-[32rem] bg-[radial-gradient(60%_60%_at_50%_0%,theme(colors.indigo.200),transparent)] dark:bg-[radial-gradient(60%_60%_at_50%_0%,theme(colors.indigo.900/40%),transparent)]" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pt-16 pb-20 text-center sm:px-6 sm:pt-24">
          <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            <span className="size-1.5 rounded-full bg-emerald-500" /> O&apos;quv markazlar uchun boshqaruv tizimi
          </span>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
            Markazingizni <span className="bg-gradient-to-br from-indigo-500 to-violet-600 bg-clip-text text-transparent">tizimli boshqaring</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-300">
            Lidlar, guruhlar, talabalar, moliya va hisobotlar — bitta joyda. Qog&apos;oz jurnal va Excel&apos;lar o&apos;rniga, har bir markaz uchun o&apos;z shaxsiy manzili bilan.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Markazai — bepul konsultatsiya")}`}
              className="rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-transform hover:scale-[1.03]"
            >
              Bepul konsultatsiya olish
            </Link>
            <Link href="#imkoniyatlar" className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5">
              Imkoniyatlarni ko&apos;rish
            </Link>
          </div>

          <div className="mt-6 flex flex-col items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Markazingiz allaqachon ro&apos;yxatdan o&apos;tganmi?</span>
            <SubdomainForm root={ROOT_DOMAIN} />
          </div>

          <div className="mt-16 w-full">
            <DashboardMock host={`markaz-nomi.${ROOT_DOMAIN}`} />
          </div>
        </div>
      </section>

      {/* ───────── Imkoniyatlar ───────── */}
      <section id="imkoniyatlar" className="border-t border-slate-200 bg-slate-50 py-20 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Barcha jarayonlar — bitta tizimda</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">Lid tushgandan to to&apos;lov qabul qilinguncha — hech narsa qo&apos;ldan boy berilmaydi.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Qanday ishlaydi ───────── */}
      <section id="qanday-ishlaydi" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Qanday ishga tushirasiz</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">Uch qadam — va markazingiz o&apos;z shaxsiy manzilida ishlaydi.</p>
          </div>
          <div className="relative mt-12 grid gap-8 sm:grid-cols-3">
            <div aria-hidden className="absolute top-6 right-0 left-0 hidden h-px bg-slate-200 sm:block dark:bg-white/10" />
            {[
              ["1", "So'rov qoldiring", "Markaz nomi va aloqa ma'lumotingizni \"Bog'lanish\" tugmasi orqali yuboring."],
              ["2", "Biz sozlab beramiz", "Jamoamiz markazingizni tayyorlaydi: boshlang'ich sozlamalar, birinchi xodim (siz) darhol tayyor bo'ladi."],
              ["3", "Ishga tushiring", "`markaz-nomi." + ROOT_DOMAIN + "` manzilida kirib, kurslar, guruhlar va xodimlarni qo'shishni boshlaysiz."],
            ].map(([n, title, desc]) => (
              <div key={n} className="relative flex flex-col items-center gap-3 text-center">
                <span className="relative z-10 flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-semibold text-white">{n}</span>
                <h3 className="font-semibold">{title}</h3>
                <p className="max-w-xs text-sm text-slate-600 dark:text-slate-300">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Qadriyatlar ───────── */}
      <section className="border-y border-slate-200 bg-slate-50 py-20 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v) => (
              <div key={v.title} className="flex flex-col gap-2">
                <v.icon className="size-6 text-indigo-500" />
                <h3 className="font-semibold">{v.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Narxlar ───────── */}
      {plans.length > 0 && (
        <section id="narxlar" className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Markazingizga mos tarif</h2>
              <p className="mt-3 text-slate-600 dark:text-slate-300">Har doim kattaroq tarifga o&apos;tishingiz mumkin. Yillik to&apos;lovda chegirma bor.</p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p, i) => {
                const featured = i === 1 && plans.length >= 3;
                return (
                  <div
                    key={p.id}
                    className={`flex flex-col gap-5 rounded-2xl border p-6 ${featured ? "border-indigo-500 bg-slate-900 text-white shadow-xl shadow-indigo-500/20" : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"}`}
                  >
                    {featured && <span className="w-fit rounded-full bg-indigo-500 px-2.5 py-0.5 text-xs font-medium">Ommabop</span>}
                    <div>
                      <h3 className="font-semibold">{p.name}</h3>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-3xl font-bold tabular-nums">{fmt(p.monthlyPrice)}</span>
                        <span className={`text-sm ${featured ? "text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>so&apos;m / oy</span>
                      </div>
                    </div>
                    <ul className="flex flex-col gap-2.5 text-sm">
                      {[limit(p.maxStaff, "xodim"), limit(p.maxBranches, "filial"), limit(p.maxStudents, "talaba")].map((line) => (
                        <li key={line} className="flex items-center gap-2">
                          <Check className={`size-4 shrink-0 ${featured ? "text-indigo-400" : "text-indigo-500"}`} />
                          {line}
                        </li>
                      ))}
                      {p.modules.includes("gamification") && (
                        <li className="flex items-center gap-2">
                          <Check className={`size-4 shrink-0 ${featured ? "text-indigo-400" : "text-indigo-500"}`} />
                          Gamifikatsiya
                        </li>
                      )}
                    </ul>
                    <Link
                      href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Markazai — ${p.name} tarifi`)}`}
                      className={`mt-auto rounded-full px-4 py-2.5 text-center text-sm font-semibold ${featured ? "bg-white text-slate-900" : "bg-slate-900 text-white dark:bg-white dark:text-slate-900"}`}
                    >
                      Tanlash
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ───────── FAQ ───────── */}
      <section id="savollar" className="border-t border-slate-200 py-20 dark:border-white/10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Savol tug&apos;ildimi?</h2>
          <div className="mt-10 flex flex-col divide-y divide-slate-200 dark:divide-white/10">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                  {f.q}
                  <span className="ml-4 shrink-0 text-slate-400 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="flex flex-col items-center gap-5 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 px-6 py-14 text-center text-white">
          <h2 className="max-w-lg text-3xl font-bold tracking-tight">Markazingizni bugun raqamlashtiring</h2>
          <p className="max-w-md text-indigo-100">Bepul konsultatsiya so&apos;rang — jamoamiz markazingiz uchun eng qulay yechimni taklif qiladi.</p>
          <Link href={`mailto:${CONTACT_EMAIL}`} className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition-transform hover:scale-[1.03]">
            Bog&apos;lanish
          </Link>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-slate-200 py-10 dark:border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-sm text-slate-500 sm:flex-row sm:justify-between sm:px-6 dark:text-slate-400">
          <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
            <GraduationCap className="size-4" /> Markazai
          </div>
          <Link href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white">
            <Mail className="size-3.5" /> {CONTACT_EMAIL}
          </Link>
          <span>© {new Date().getFullYear()} Markazai</span>
        </div>
      </footer>
    </div>
  );
}
