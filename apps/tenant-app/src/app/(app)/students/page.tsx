import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FilterBar, type FilterField } from "@/components/data-table/filter-bar";
import { can, canAccess } from "@/lib/permissions";
import { requireModule } from "@/lib/session";
import { STUDENT_STATUSES } from "@markazai/types";
import { FINANCE_FILTERS, GROUPS_COUNT_FILTERS, PAGE_SIZE, listStudents, loadStudentLookups } from "./queries";
import { NewStudentButton, StudentsTable } from "./students-table";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("students") };
}

export default async function StudentsPage({ searchParams }: PageProps<"/students">) {
  const user = await requireModule("students");
  const sp = await searchParams;
  const t = await getTranslations("student");
  const te = await getTranslations("enums");

  const [{ rows, total, page, sort }, lookups] = await Promise.all([listStudents(user, sp), loadStudentLookups(user)]);
  const canWrite = can(user.roles, "students:write");
  const canFinance = canAccess(user.roles, "finance");

  const fields: FilterField[] = [
    { name: "courseId", label: t("course"), type: "select", options: lookups.courses.map((c) => ({ value: c.id, label: c.name })) },
    { name: "status", label: t("status"), type: "select", options: STUDENT_STATUSES.map((s) => ({ value: s, label: te(`studentStatus.${s}`) })) },
    ...(canFinance ? ([{ name: "finance", label: t("financeStatus"), type: "select", options: FINANCE_FILTERS.map((f) => ({ value: f, label: te(`financeFilter.${f}`) })) }] as FilterField[]) : []),
    { name: "tagId", label: t("tags"), type: "select", options: lookups.tags.map((tag) => ({ value: tag.id, label: tag.name })) },
    { name: "externalId", label: t("externalId"), type: "text" },
    { name: "groupsCount", label: t("groupsCount"), type: "select", options: GROUPS_COUNT_FILTERS.map((g) => ({ value: g, label: g })) },
    { name: "from", label: `${t("addedOn")}: ${t("dateFrom")}`, type: "date" },
    { name: "to", label: `${t("addedOn")}: ${t("dateTo")}`, type: "date" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <FilterBar
        searchPlaceholder={t("searchPlaceholder")}
        fields={fields}
        actions={canWrite ? <NewStudentButton lookups={lookups} /> : null}
      />
      <StudentsTable
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        sort={sort}
        lookups={lookups}
        canWrite={canWrite}
        canDelete={can(user.roles, "students:delete")}
        canFinance={canFinance}
      />
    </div>
  );
}
