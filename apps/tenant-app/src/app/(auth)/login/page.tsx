import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title") };
}

export default async function LoginPage() {
  const t = await getTranslations("login");
  const tc = await getTranslations("common");

  return (
    <main className="bg-muted/40 relative flex min-h-screen items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-3xl overflow-hidden p-0">
        {/* Brend banner — keyinchalik Sozlamalardan yuklanadi (CenterSettings.loginBannerUrl) */}
        <div className="from-primary/90 to-primary/50 h-36 bg-gradient-to-br" aria-hidden />
        <CardContent className="grid gap-8 p-8 md:grid-cols-2">
          <div className="flex flex-col items-start justify-center gap-3">
            <div className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-2xl">
              <GraduationCap className="size-8" />
            </div>
            <h1 className="text-2xl font-semibold">{tc("appName")}</h1>
            <p className="text-muted-foreground text-sm">{t("title")}</p>
          </div>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
