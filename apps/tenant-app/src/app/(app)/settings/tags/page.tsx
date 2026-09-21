import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@markazai/db";
import { requireModule } from "@/lib/session";
import { TagsView } from "../catalog-views";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("tags") };
}

export default async function TagsPage() {
  const user = await requireModule("settings");
  const tags = await prisma.tag.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, include: { _count: { select: { students: true, groups: true, leads: true } } } });
  return <TagsView items={tags.map((g) => ({ id: g.id, name: g.name, color: g.color, students: g._count.students, groups: g._count.groups, leads: g._count.leads }))} />;
}
