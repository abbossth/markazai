import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LEAD_SOURCES, DAYS_PATTERNS } from "@markazai/types";
import { FilterBar, type FilterField } from "@/components/data-table/filter-bar";
import { can } from "@/lib/permissions";
import { requireModule } from "@/lib/session";
import { Board } from "./board";
import { TASK_FILTERS, loadBoard } from "./queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("leads") };
}

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const user = await requireModule("leads");
  const sp = await searchParams;
  const t = await getTranslations("lead");
  const te = await getTranslations("enums");

  const { columns, cards, containers, lookups } = await loadBoard(user, sp);
  const canWrite = can(user.roles, "leads:write");

  const fields: FilterField[] = [
    {
      name: "listId",
      label: t("section"),
      type: "select",
      options: columns.flatMap((c) => c.lists.map((l) => ({ value: l.id, label: `${c.name} / ${l.name}` }))),
    },
    { name: "courseId", label: t("course"), type: "select", options: lookups.courses.map((c) => ({ value: c.id, label: c.name })) },
    { name: "days", label: t("days"), type: "select", options: DAYS_PATTERNS.map((d) => ({ value: d, label: te(`days.${d}`) })) },
    { name: "tagId", label: t("tags"), type: "select", options: lookups.tags.map((x) => ({ value: x.id, label: x.name })) },
    { name: "source", label: t("source"), type: "select", options: LEAD_SOURCES.map((s) => ({ value: s.value, label: te(`leadSource.${s.value}`) })) },
    { name: "assigneeId", label: t("assignee"), type: "select", options: lookups.assignees.map((u) => ({ value: u.id, label: u.name })) },
    { name: "task", label: t("task"), type: "select", options: TASK_FILTERS.map((f) => ({ value: f, label: t(`taskFilter.${f}`) })) },
    { name: "from", label: `${t("createdAt")}: ${t("dateFrom")}`, type: "date" },
    { name: "to", label: `${t("createdAt")}: ${t("dateTo")}`, type: "date" },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <FilterBar searchPlaceholder={t("searchPlaceholder")} fields={fields} />
      <Board
        columns={columns}
        cards={cards}
        containers={containers}
        lookups={lookups}
        canWrite={canWrite}
        canDelete={can(user.roles, "leads:delete")}
        canConfigure={can(user.roles, "leads:configure")}
      />
    </div>
  );
}
