import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DAYS_PATTERNS, GROUP_STATUSES, type DaysPattern } from "@markazai/types";
import { FilterBar, type FilterField } from "@/components/data-table/filter-bar";
import { can, isTeacherOnly } from "@/lib/permissions";
import { requireModule } from "@/lib/session";
import { PAGE_SIZE, listGroups, loadGroupLookups } from "./queries";
import { GroupsTable, NewGroupButton } from "./groups-table";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("groups") };
}

export default async function GroupsPage({ searchParams }: PageProps<"/groups">) {
  const user = await requireModule("groups");
  const sp = await searchParams;
  const t = await getTranslations("group");
  const te = await getTranslations("enums");

  const [{ rows, total, page, sort }, lookups] = await Promise.all([listGroups(user, sp), loadGroupLookups(user)]);
  const canWrite = can(user.roles, "groups:write");

  // Lidlar ro'yxatidan "Guruh yaratish": forma ochiq va oldindan to'ldirilgan holda keladi (?new=1&name=…).
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const prefillDays = one("days");
  const prefill = one("new")
    ? {
        name: one("name"),
        courseId: lookups.courses.some((c) => c.id === one("courseId")) ? one("courseId") : undefined,
        teacherId: lookups.teachers.some((x) => x.id === one("teacherId")) ? one("teacherId") : undefined,
        days: (DAYS_PATTERNS as readonly string[]).includes(prefillDays ?? "") ? (prefillDays as DaysPattern) : undefined,
        startTime: /^\d{2}:\d{2}$/.test(one("startTime") ?? "") ? one("startTime") : undefined,
      }
    : undefined;

  const fields: FilterField[] = [
    { name: "status", label: t("status"), type: "select", options: GROUP_STATUSES.map((s) => ({ value: s, label: te(`groupStatus.${s}`) })) },
    ...(isTeacherOnly(user.roles) ? [] : [{ name: "teacherId", label: t("teacher"), type: "select" as const, options: lookups.teachers.map((x) => ({ value: x.id, label: x.name })) }]),
    { name: "courseId", label: t("course"), type: "select", options: lookups.courses.map((c) => ({ value: c.id, label: c.name })) },
    { name: "days", label: t("days"), type: "select", options: DAYS_PATTERNS.map((d) => ({ value: d, label: te(`days.${d}`) })) },
    { name: "tagId", label: t("tags"), type: "select", options: lookups.tags.map((x) => ({ value: x.id, label: x.name })) },
    { name: "from", label: `${t("startDate")}: ${t("dateFrom")}`, type: "date" },
    { name: "to", label: `${t("startDate")}: ${t("dateTo")}`, type: "date" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <FilterBar searchPlaceholder={t("searchPlaceholder")} fields={fields} actions={canWrite ? <NewGroupButton lookups={lookups} prefill={prefill} defaultOpen={!!prefill} /> : null} />
      <GroupsTable
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        sort={sort}
        // Tahrirlash imkoni yo'q foydalanuvchiga o'qituvchilar/xonalar ro'yxati client'ga yuborilmaydi.
        lookups={canWrite ? lookups : { ...lookups, teachers: [], rooms: [] }}
        canWrite={canWrite}
        canDelete={can(user.roles, "groups:delete")}
      />
    </div>
  );
}
