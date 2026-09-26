import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { prisma, type Prisma } from "@markazai/db";
import { FilterBar, type FilterField } from "@/components/data-table/filter-bar";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { dateParam, param } from "@/lib/search-params";
import { requireModule } from "@/lib/session";
import { ArchiveTable } from "./archive-table";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("lead.arch.page");
  return { title: t("title") };
}

const LIMIT = 500;

export default async function LeadsArchivePage({ searchParams }: PageProps<"/leads/archive">) {
  const user = await requireModule("leads");
  const sp = await searchParams;
  const t = await getTranslations("lead.arch.page");
  const tm = await getTranslations("lead.arch.menu");

  const q = param(sp, "q");
  const reasonId = param(sp, "reasonId");
  const userId = param(sp, "userId");
  const from = dateParam(sp, "from");
  const to = dateParam(sp, "to");

  const and: Prisma.LeadWhereInput[] = [];
  if (q) {
    const digits = q.replace(/\D/g, "");
    and.push({ OR: [{ name: { contains: q, mode: "insensitive" } }, ...(digits.length >= 2 ? [{ phone: { contains: digits } }] : [])] });
  }
  if (reasonId) and.push({ archiveReasonId: reasonId });
  if (userId) and.push({ archivedById: userId });
  if (from || to) and.push({ archivedAt: { ...(from && { gte: from }), ...(to && { lte: new Date(to.getTime() + 86_399_999) }) } });

  const where: Prisma.LeadWhereInput = { organizationId: user.orgId, archivedAt: { not: null }, AND: and };
  const [rows, total, reasons, users] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { archivedAt: "desc" },
      take: LIMIT,
      include: { column: { select: { name: true } }, list: { select: { name: true } }, archiveReason: { select: { name: true } } },
    }),
    prisma.lead.count({ where }),
    prisma.leadArchiveReason.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));

  const fields: FilterField[] = [
    { name: "reasonId", label: t("filterReason"), type: "select", options: reasons.map((r) => ({ value: r.id, label: r.name })) },
    { name: "userId", label: t("filterEmployee"), type: "select", options: users.map((u) => ({ value: u.id, label: u.name })) },
    { name: "from", label: t("from"), type: "date" },
    { name: "to", label: t("to"), type: "date" },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon-sm" nativeButton={false} render={<Link href="/leads" />} aria-label={t("back")} title={t("back")}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <span className="text-muted-foreground text-sm">{t("count", { count: total })}</span>
        <Button variant="outline" size="sm" className="ml-auto" nativeButton={false} render={<Link href="/leads/reasons" />}>
          {tm("reasons")}
        </Button>
      </div>
      <FilterBar searchPlaceholder={t("search")} fields={fields} />
      <ArchiveTable
        canRestore={can(user.roles, "leads:write")}
        canPurge={can(user.roles, "leads:delete")}
        rows={rows.map((l) => ({
          id: l.id,
          name: l.name,
          phone: l.phone,
          section: l.list ? `${l.column.name} / ${l.list.name}` : l.column.name,
          reason: l.archiveReason?.name ?? "—",
          note: l.archiveNote ?? "",
          archivedBy: l.archivedById ? (userName.get(l.archivedById) ?? "—") : "—",
          archivedAt: l.archivedAt ? formatDateTime(l.archivedAt) : "—",
        }))}
      />
    </div>
  );
}
