import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ROLES, canManageRoles } from "@markazai/types";
import { FilterBar, type FilterField } from "@/components/data-table/filter-bar";
import { requireModule } from "@/lib/session";
import { PAGE_SIZE, listStaff, loadBranches } from "./queries";
import { ImportStaffButton, NewStaffButton, StaffTable } from "./staff-table";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("staff") };
}

export default async function StaffPage({ searchParams }: PageProps<"/settings/staff">) {
  const user = await requireModule("settings");
  const sp = await searchParams;
  const t = await getTranslations("settings.staff");
  const te = await getTranslations("enums.roles");
  const [list, branches] = await Promise.all([listStaff(user, { ...sp }), loadBranches(user)]);
  const canGrantPrivileged = canManageRoles(user.roles, ["CEO"]);

  const fields: FilterField[] = [
    { name: "role", label: t("columns.roles"), type: "select", options: ROLES.map((r) => ({ value: r, label: te(r) })) },
    { name: "status", label: t("columns.status"), type: "select", options: [{ value: "active", label: t("active") }, { value: "inactive", label: t("inactive") }] },
  ];

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        searchPlaceholder={t("search")}
        fields={fields}
        actions={
          <>
            <ImportStaffButton />
            <NewStaffButton branches={branches} canGrantPrivileged={canGrantPrivileged} />
          </>
        }
      />
      <StaffTable rows={list.rows} total={list.total} page={list.page} pageSize={PAGE_SIZE} sort={list.sort} branches={branches} canGrantPrivileged={canGrantPrivileged} meId={user.id} actorRoles={user.roles} />
    </div>
  );
}
