import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ensureDefaultArchiveReasons, prisma } from "@markazai/db";
import { can } from "@/lib/permissions";
import { requireModule } from "@/lib/session";
import { ReasonsManager } from "./reasons-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("lead.arch.reasons");
  return { title: t("title") };
}

export default async function LeadReasonsPage() {
  const user = await requireModule("leads");
  await ensureDefaultArchiveReasons(prisma, user.orgId);
  const [reasons, users] = await Promise.all([
    prisma.leadArchiveReason.findMany({ where: { organizationId: user.orgId }, orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({ where: { organizationId: user.orgId }, select: { id: true, name: true } }),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));
  return (
    <ReasonsManager
      canConfigure={can(user.roles, "leads:configure")}
      reasons={reasons.map((r) => ({ id: r.id, name: r.name, isActive: r.isActive, createdBy: r.createdById ? (userName.get(r.createdById) ?? "") : "" }))}
    />
  );
}
