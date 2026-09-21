import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@markazai/db";
import { requireModule } from "@/lib/session";
import { RoomsView } from "../catalog-views";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("rooms") };
}

export default async function RoomsPage() {
  const user = await requireModule("settings");
  const rooms = await prisma.room.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, include: { _count: { select: { groups: true } } } });
  return <RoomsView items={rooms.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity, groups: r._count.groups }))} />;
}
