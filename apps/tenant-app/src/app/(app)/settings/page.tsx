import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@markazai/db";
import { LOCALES, type GeneralSettingsInput } from "@markazai/types";
import { requireModule } from "@/lib/session";
import { GeneralForm } from "./general-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function GeneralSettingsPage() {
  const user = await requireModule("settings");
  const s = await prisma.centerSettings.findUnique({ where: { organizationId: user.orgId } });

  const initial: GeneralSettingsInput = {
    name: s?.name ?? "",
    // PhoneInput 9 ta raqam bilan ishlaydi (+998 prefiksisiz).
    phone: s?.phone ? s.phone.replace(/^998/, "") : "",
    address: s?.address ?? "",
    workingHours: s?.workingHours ?? "",
    telegram: s?.telegram ?? "",
    instagram: s?.instagram ?? "",
    lessonStartStep: s?.lessonStartStep ?? 30,
    returningStudentRule: s?.returningStudentRule ?? "",
    brandColor: s?.brandColor ?? "",
    defaultTheme: (s?.defaultTheme as GeneralSettingsInput["defaultTheme"]) ?? "system",
    locales: (s?.locales ?? [...LOCALES]).filter((l): l is (typeof LOCALES)[number] => (LOCALES as readonly string[]).includes(l)),
    loginWelcome: s?.loginWelcome ?? "",
    offerText: s?.offerText ?? "",
    logoUrl: s?.logoUrl ?? "",
    loginBannerUrl: s?.loginBannerUrl ?? "",
    gamificationEnabled: s?.gamificationEnabled ?? false,
  };
  return <GeneralForm initial={initial} />;
}
