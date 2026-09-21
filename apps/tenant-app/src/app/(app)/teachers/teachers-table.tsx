"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type AnyColumnDef } from "@/components/data-table/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatMoney, formatPhone, initials } from "@/lib/format";
import { deleteTeacher, setTeacherActive } from "./actions";
import { TeacherSheet } from "./teacher-form";
import type { TeacherLookups, TeacherRow } from "./queries";

type Props = {
  rows: TeacherRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: { key: string; dir: "asc" | "desc" };
  lookups: TeacherLookups;
  canWrite: boolean;
  canSalary: boolean;
};

export function TeachersTable({ rows, total, page, pageSize, sort, lookups, canWrite, canSalary }: Props) {
  const t = useTranslations("teacher");
  const tc = useTranslations("common");
  const router = useRouter();
  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const [deleting, setDeleting] = useState<TeacherRow | null>(null);
  const [pending, startTransition] = useTransition();

  const toggleActive = useCallback(
    (row: TeacherRow) =>
      startTransition(async () => {
        const res = await setTeacherActive(row.id, !row.isActive);
        if (res.ok) {
          toast.success(tc("saved"));
          router.refresh();
        } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
      }),
    [router, tc],
  );

  const confirmDelete = () => {
    if (!deleting) return;
    startTransition(async () => {
      const res = await deleteTeacher(deleting.id);
      setDeleting(null);
      if (res.ok) {
        toast.success(tc("deleted"));
        router.refresh();
      } else toast.error(res.error === "hasRecords" ? t("hasRecords") : res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });
  };

  const columns = useMemo<AnyColumnDef<TeacherRow>[]>(
    () => [
      {
        id: "name",
        header: t("name"),
        meta: { sortKey: "name", label: t("name") },
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              {row.original.photoUrl && <AvatarImage src={row.original.photoUrl} alt="" />}
              <AvatarFallback className="text-xs">{initials(row.original.name)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              <Link href={`/teachers/${row.original.id}`} className="font-medium hover:underline">
                {row.original.name}
              </Link>
              {!row.original.isActive && <Badge variant="outline">{t("inactive")}</Badge>}
            </div>
          </div>
        ),
      },
      { id: "phone", header: t("phone"), meta: { label: t("phone") }, cell: ({ row }) => <span className="whitespace-nowrap">{formatPhone(row.original.phone)}</span> },
      {
        id: "groups",
        header: t("groups"),
        meta: { label: t("groups"), className: "text-center" },
        cell: ({ row }) => (
          <span>
            {row.original.activeGroups}
            {row.original.totalGroups > row.original.activeGroups && <span className="text-muted-foreground"> / {row.original.totalGroups}</span>}
          </span>
        ),
      },
      ...(canSalary
        ? ([
            {
              id: "salary",
              header: t("salary"),
              meta: { label: t("salary") },
              cell: ({ row }) =>
                row.original.salaryType === "PERCENT" ? (
                  <span>{t("percentValue", { percent: row.original.percent ?? 0 })}</span>
                ) : (
                  <span className="whitespace-nowrap tabular-nums">{formatMoney(row.original.fixedSalary ?? 0)}</span>
                ),
            },
          ] as AnyColumnDef<TeacherRow>[])
        : []),
      { id: "branches", header: t("branches"), meta: { label: t("branches") }, cell: ({ row }) => (row.original.branches.length ? row.original.branches.join(", ") : "—") },
      {
        id: "actions",
        header: () => null,
        enableHiding: false,
        meta: { className: "w-10" },
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={tc("actions")} />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href={`/teachers/${row.original.id}`} />}>{t("open")}</DropdownMenuItem>
              {canWrite && (
                <>
                  <DropdownMenuItem onClick={() => setEditing(row.original)}>{tc("edit")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleActive(row.original)}>{row.original.isActive ? t("deactivate") : t("activate")}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleting(row.original)}>
                    {tc("delete")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [t, tc, canWrite, canSalary, toggleActive],
  );

  return (
    <>
      <DataTable columns={columns} data={rows} total={total} page={page} pageSize={pageSize} sort={sort} getRowId={(r) => r.id} storageKey="teachers" />
      {editing && <TeacherSheet open onOpenChange={(o) => !o && setEditing(null)} lookups={lookups} canSalary={canSalary} teacher={editing.editable} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("deleteTitle", { name: deleting?.name ?? "" })}
        description={tc("confirmDelete")}
        confirmLabel={tc("delete")}
        destructive
        pending={pending}
        onConfirm={confirmDelete}
      />
    </>
  );
}

export function NewTeacherButton({ lookups, canSalary }: { lookups: TeacherLookups; canSalary: boolean }) {
  const t = useTranslations("teacher");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t("new")}
      </Button>
      <TeacherSheet open={open} onOpenChange={setOpen} lookups={lookups} canSalary={canSalary} />
    </>
  );
}
