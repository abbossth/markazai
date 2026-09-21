"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Plus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable, type AnyColumnDef } from "@/components/data-table/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useDaysLabel } from "@/components/shared/days-label";
import { ExpandableText } from "@/components/shared/expandable-text";
import { Money } from "@/components/shared/money";
import { StudentQuickCard } from "@/components/shared/student-quick-card";
import { StudentStatusBadge } from "@/components/shared/status-badge";
import { formatPhone } from "@/lib/format";
import { AddToGroupDialog } from "./add-to-group-dialog";
import { deleteStudent } from "./actions";
import { StudentSheet } from "./student-form";
import type { StudentLookups, StudentRow } from "./queries";

type Props = {
  rows: StudentRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: { key: string; dir: "asc" | "desc" };
  lookups: StudentLookups;
  canWrite: boolean;
  canDelete: boolean;
};

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function StudentsTable({ rows, total, page, pageSize, sort, lookups, canWrite, canDelete }: Props) {
  const t = useTranslations("student");
  const tc = useTranslations("common");
  const router = useRouter();
  const daysLabel = useDaysLabel();
  const [deleting, setDeleting] = useState<StudentRow | null>(null);
  const [pending, startTransition] = useTransition();
  const [groupTargets, setGroupTargets] = useState<string[] | null>(null);
  const [clearSelection, setClearSelection] = useState<(() => void) | null>(null);

  const columns = useMemo<AnyColumnDef<StudentRow>[]>(
    () => [
      {
        id: "photo",
        header: () => null,
        enableHiding: false,
        meta: { className: "w-12" },
        cell: ({ row }) => (
          <Avatar className="size-8">
            {row.original.photoUrl && <AvatarImage src={row.original.photoUrl} alt="" />}
            <AvatarFallback className="text-xs">{initials(row.original.name)}</AvatarFallback>
          </Avatar>
        ),
      },
      {
        id: "name",
        header: t("name"),
        meta: { sortKey: "name", label: t("name") },
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <StudentQuickCard student={row.original} />
            <StudentStatusBadge status={row.original.status} />
          </div>
        ),
      },
      {
        id: "phone",
        header: t("phone"),
        meta: { sortKey: "phone", label: t("phone") },
        cell: ({ row }) => <span className="whitespace-nowrap">{formatPhone(row.original.phone)}</span>,
      },
      {
        id: "groups",
        header: t("groups"),
        meta: { label: t("groups") },
        cell: ({ row }) =>
          row.original.groups.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {row.original.groups.map((g) => (
                <Link key={g.id} href={`/groups/${g.id}`}>
                  <Badge variant="outline">{g.name}</Badge>
                </Link>
              ))}
            </div>
          ),
      },
      {
        id: "teachers",
        header: t("teachers"),
        meta: { label: t("teachers") },
        cell: ({ row }) => {
          const names = [...new Set(row.original.groups.map((g) => g.teacherName))];
          return names.length ? names.join(", ") : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        id: "schedule",
        header: t("schedule"),
        meta: { label: t("schedule") },
        cell: ({ row }) =>
          row.original.groups.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <div className="flex flex-col text-xs">
              {row.original.groups.map((g) => (
                <span key={g.id}>
                  {daysLabel(g.days, g.customDays)} · {g.startTime}
                </span>
              ))}
            </div>
          ),
      },
      {
        id: "balance",
        header: t("balance"),
        meta: { sortKey: "balance", label: t("balance"), className: "text-right" },
        cell: ({ row }) => <Money value={row.original.balance} />,
      },
      {
        id: "tags",
        header: t("tags"),
        meta: { label: t("tags"), hidden: true },
        cell: ({ row }) =>
          row.original.tags.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {row.original.tags.map((tag) => (
                <Badge key={tag.id} variant="secondary">
                  {tag.name}
                </Badge>
              ))}
            </div>
          ),
      },
      {
        id: "note",
        header: t("note"),
        meta: { label: t("note"), className: "max-w-56 whitespace-normal" },
        cell: ({ row }) => <ExpandableText text={row.original.note} />,
      },
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
              <DropdownMenuItem render={<Link href={`/students/${row.original.id}`} />}>{t("goToProfile")}</DropdownMenuItem>
              {canWrite && <DropdownMenuItem onClick={() => setGroupTargets([row.original.id])}>{t("addToGroup")}</DropdownMenuItem>}
              {canDelete && (
                <>
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
    [t, tc, daysLabel, canWrite, canDelete],
  );

  const confirmDelete = () => {
    if (!deleting) return;
    startTransition(async () => {
      const res = await deleteStudent(deleting.id);
      if (res.ok) {
        toast.success(tc("deleted"));
        setDeleting(null);
        router.refresh();
      } else {
        toast.error(res.error === "hasPayments" ? t("hasPayments") : res.error === "forbidden" ? tc("forbidden") : tc("error"));
        setDeleting(null);
      }
    });
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        sort={sort}
        getRowId={(r) => r.id}
        storageKey="students"
        selectable={canWrite}
        bulkActions={(selected, clear) => (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setClearSelection(() => clear);
              setGroupTargets(selected.map((s) => s.id));
            }}
          >
            <UsersRound className="size-4" />
            {t("addToGroup")}
          </Button>
        )}
      />

      {groupTargets && (
        <AddToGroupDialog
          open
          onOpenChange={(o) => !o && setGroupTargets(null)}
          studentIds={groupTargets}
          groups={lookups.groups}
          onDone={() => clearSelection?.()}
        />
      )}

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

export function NewStudentButton({ lookups }: { lookups: Pick<StudentLookups, "tags" | "groups"> }) {
  const t = useTranslations("student");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t("new")}
      </Button>
      <StudentSheet open={open} onOpenChange={setOpen} lookups={lookups} />
    </>
  );
}
