import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@markazai/db";
import { requireModule } from "@/lib/session";
import { CoursesView } from "../catalog-views";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("courses") };
}

export default async function CoursesPage() {
  const user = await requireModule("settings");
  const courses = await prisma.course.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, include: { _count: { select: { groups: true } } } });
  return <CoursesView items={courses.map((c) => ({ id: c.id, name: c.name, price: c.price, durationMonths: c.durationMonths, color: c.color, groups: c._count.groups }))} />;
}
