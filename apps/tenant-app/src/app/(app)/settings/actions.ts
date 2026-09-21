"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@markazai/db";
import { generalSettingsSchema, type GeneralSettingsInput } from "@markazai/types";
import { fieldErrorsOf, guardSettings, type Result } from "./guard";

/** Umumiy sozlamalar. Ixtiyoriy maydonlar bo'sh yuborilsa bazada tozalanadi (undefined → null). */
export async function saveGeneralSettings(input: GeneralSettingsInput): Promise<Result> {
  const user = await guardSettings();
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = generalSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrorsOf(parsed.error.issues) };

  const d = parsed.data;
  const data = {
    name: d.name,
    phone: d.phone ?? null,
    address: d.address ?? null,
    workingHours: d.workingHours ?? null,
    telegram: d.telegram ?? null,
    instagram: d.instagram ?? null,
    lessonStartStep: d.lessonStartStep,
    returningStudentRule: d.returningStudentRule ?? null,
    brandColor: d.brandColor ?? null,
    defaultTheme: d.defaultTheme,
    locales: d.locales,
    loginWelcome: d.loginWelcome ?? null,
    offerText: d.offerText ?? null,
    logoUrl: d.logoUrl ?? null,
    loginBannerUrl: d.loginBannerUrl ?? null,
    gamificationEnabled: d.gamificationEnabled,
  };
  await prisma.centerSettings.upsert({ where: { organizationId: user.orgId }, update: data, create: { organizationId: user.orgId, ...data } });
  revalidatePath("/", "layout");
  return { ok: true };
}
