import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@markazai/db";
import { isoWeekday, toCenterParts } from "@markazai/types";
import { intParam } from "@/lib/search-params";
import { requireModule } from "@/lib/session";
import { HolidaysView } from "../catalog-views";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("holidays") };
}

export default async function HolidaysPage({ searchParams }: PageProps<"/settings/holidays">) {
  const user = await requireModule("settings");
  const today = toCenterParts(new Date()).date;
  const year = intParam(await searchParams, "year", Number(today.slice(0, 4)), 2000, 2100);
  const rows = await prisma.holiday.findMany({ where: { organizationId: user.orgId, date: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) } }, orderBy: { date: "asc" } });
  return <HolidaysView year={year} today={today} items={rows.map((h) => ({ id: h.id, date: h.date.toISOString().slice(0, 10), name: h.name, weekday: isoWeekday(h.date) }))} />;
}
