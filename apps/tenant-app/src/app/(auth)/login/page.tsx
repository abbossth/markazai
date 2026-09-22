import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MarkazaiMark } from "@/components/brand/mark";
import { Card, CardContent } from "@/components/ui/card";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { notFound } from "next/navigation";
import { loadCenter } from "@/lib/center";
import { currentTenant } from "@/lib/tenant";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title") };
}

export default async function LoginPage() {
  const t = await getTranslations("login");
  const tc = await getTranslations("common");
  // Tashkilot topilmasa — 404; to'xtatilgan yoki obunasi tugagan bo'lsa forma o'rniga xabar (ma'lumot o'chirilmaydi).
  const tenant = await currentTenant();
  if (!tenant) notFound();
  const blocked = !tenant.access.allowed ? tenant.access.reason : null;
  const center = await loadCenter();
  const name = center?.name ?? tenant.name;

  return (
    <main className="bg-muted/40 relative flex min-h-screen items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-3xl overflow-hidden p-0">
        {/* Brend banner: Sozlamalar → Umumiy (CenterSettings.loginBannerUrl); yuklanmagan bo'lsa — brend rangidagi gradient */}
        {center?.loginBannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- ichki /api/files manzili, next/image optimizatsiyasi kerak emas
          <img src={center.loginBannerUrl} alt="" className="h-36 w-full object-cover" />
        ) : (
          <div className="from-brand-500 to-brand-700 relative h-36 bg-gradient-to-br" aria-hidden>
            <div
              className="absolute inset-0 opacity-90"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 15% 35%, rgba(255,176,32,0.35), transparent 45%)",
              }}
            />
          </div>
        )}
        <CardContent className="grid gap-8 p-8 md:grid-cols-2">
          <div className="flex flex-col items-start justify-center gap-3">
            {center?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- ichki /api/files manzili
              <img src={center.logoUrl} alt="" className="size-14 rounded-2xl object-contain" />
            ) : (
              <MarkazaiMark size={56} tone="blue" />
            )}
            <h1 className="text-2xl font-semibold">{name}</h1>
            <p className="text-muted-foreground text-sm">{center?.loginWelcome || t("title")}</p>
          </div>
          {blocked ? (
            <div role="alert" className="border-destructive/40 bg-destructive/5 flex flex-col justify-center gap-1 rounded-lg border p-4 text-sm">
              <p className="font-semibold">{t(`blocked.${blocked}.title`)}</p>
              <p className="text-muted-foreground">{t(`blocked.${blocked}.hint`)}</p>
            </div>
          ) : (
            <LoginForm />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
