import { cache } from "react";
import { prisma } from "@markazai/db";
import { LOCALES, readableForeground } from "@markazai/types";
import { currentOrganizationId } from "./tenant";

/** Markaz sozlamalari (bir so'rov ichida keshlanadi: layout, i18n va sahifalar bitta so'rov qiladi). */
export const loadCenter = cache(async () => prisma.centerSettings.findUnique({ where: { organizationId: await currentOrganizationId() } }));

export type CenterConfig = { name: string; logoUrl: string | null; locales: string[]; defaultTheme: string };

export async function loadCenterConfig(): Promise<CenterConfig> {
  const s = await loadCenter();
  const locales = (s?.locales ?? []).filter((l) => (LOCALES as readonly string[]).includes(l));
  return { name: s?.name ?? "Markazai", logoUrl: s?.logoUrl ?? null, locales: locales.length ? locales : [...LOCALES], defaultTheme: s?.defaultTheme ?? "system" };
}

/** Brend rangini CSS o'zgaruvchilariga aylantiradi (faqat tekshirilgan #rrggbb). */
export function brandCss(hex: string | null | undefined): string | null {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const fg = readableForeground(hex);
  return `html:root,html.dark{--primary:${hex};--primary-foreground:${fg};--sidebar-primary:${hex};--sidebar-primary-foreground:${fg};--ring:${hex}}`;
}
