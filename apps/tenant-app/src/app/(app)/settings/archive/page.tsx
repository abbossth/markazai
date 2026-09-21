import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@markazai/db";
import { toISODate } from "@markazai/types";
import { requireModule } from "@/lib/session";
import { ArchiveView } from "../catalog-views";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("archive") };
}

export default async function ArchivePage() {
  const user = await requireModule("settings");
  const groups = await prisma.group.findMany({
    where: { organizationId: user.orgId, status: { not: "ACTIVE" } },
    orderBy: { updatedAt: "desc" },
    include: { course: { select: { name: true } }, teacher: { select: { name: true } }, _count: { select: { enrollments: true } } },
  });
  return <ArchiveView groups={groups.map((g) => ({ id: g.id, name: g.name, courseName: g.course.name, teacherName: g.teacher.name, status: g.status, endDate: g.endDate ? toISODate(g.endDate) : null, students: g._count.enrollments }))} />;
}
