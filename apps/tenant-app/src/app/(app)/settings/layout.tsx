import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/session";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireModule("settings");
  const t = await getTranslations("settings");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <div className="grid items-start gap-6 lg:grid-cols-[13rem_1fr]">
        <SettingsNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
