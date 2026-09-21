import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarCheck } from "lucide-react";
import { FilterBar, type FilterField } from "@/components/data-table/filter-bar";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { requireModule } from "@/lib/session";
import { PAGE_SIZE, listTeachers, loadTeacherLookups } from "./queries";
import { NewTeacherButton, TeachersTable } from "./teachers-table";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("teachers") };
}

export default async function TeachersPage({ searchParams }: PageProps<"/teachers">) {
  const user = await requireModule("teachers");
  const sp = await searchParams;
  const t = await getTranslations("teacher");

  const [{ rows, total, page, sort }, lookups] = await Promise.all([listTeachers(user, sp), loadTeacherLookups(user)]);
  const canWrite = can(user.roles, "teachers:write");
  const canSalary = can(user.roles, "salary:read");

  const fields: FilterField[] = [
    { name: "status", label: t("status"), type: "select", options: [{ value: "active", label: t("active") }, { value: "inactive", label: t("inactive") }] },
    { name: "branchId", label: t("branches"), type: "select", options: lookups.branches.map((b) => ({ value: b.id, label: b.name })) },
    ...(canSalary
      ? ([{ name: "salaryType", label: t("salaryType"), type: "select", options: [{ value: "PERCENT", label: t("salaryPercent") }, { value: "FIXED", label: t("salaryFixed") }] }] as FilterField[])
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Button variant="outline" nativeButton={false} render={<Link href="/teacher-attendance" />}>
          <CalendarCheck className="size-4" />
          {t("attendanceLink")}
        </Button>
      </div>
      <FilterBar searchPlaceholder={t("searchPlaceholder")} fields={fields} actions={canWrite ? <NewTeacherButton lookups={lookups} canSalary={canSalary} /> : null} />
      <TeachersTable rows={rows} total={total} page={page} pageSize={PAGE_SIZE} sort={sort} lookups={lookups} canWrite={canWrite} canSalary={canSalary} />
    </div>
  );
}
