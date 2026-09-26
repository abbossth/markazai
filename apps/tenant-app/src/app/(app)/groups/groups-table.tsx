"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Pin, PinOff, Plus } from "lucide-react";
import { toast } from "sonner";
import { GROUP_STATUSES } from "@markazai/types";
import { DataTable, type AnyColumnDef } from "@/components/data-table/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useDaysLabel } from "@/components/shared/days-label";
import { GroupStatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocalSet } from "@/hooks/use-local-set";
import { formatDate, formatMoney } from "@/lib/format";
import { deleteGroup, setGroupStatus } from "./actions";
import { GroupSheet, type EditableGroup } from "./group-form";
import type { GroupLookups, GroupRow } from "./queries";

type Props = {
  rows: GroupRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: { key: string; dir: "asc" | "desc" };
  lookups: GroupLookups;
  canWrite: boolean;
  canDelete: boolean;
};

export function toEditable(g: GroupRow, lookups: Pick<GroupLookups, "tags">): EditableGroup {
  return {
    id: g.id,
    name: g.name,
    courseId: g.course.id,
    teacherId: g.teacherId,
    roomId: g.roomId,
    days: g.days,
    customDays: g.customDays,
    startTime: g.startTime,
    durationMinutes: g.durationMinutes,
    startDate: g.startDate.slice(0, 10),
    endDate: g.endDate?.slice(0, 10) ?? null,
    price: g.price,
    tagIds: g.tags.map((t) => t.id).filter((id) => lookups.tags.some((t) => t.id === id)),
  };
}

export function GroupsTable({ rows, total, page, pageSize, sort, lookups, canWrite, canDelete }: Props) {
  const t = useTranslations("group");
  const tc = useTranslations("common");
  const te = useTranslations("enums.groupStatus");
  const router = useRouter();
  const daysLabel = useDaysLabel();
  // Mahkamlangan guruhlar (brauzerda saqlanadi) ro'yxatning tepasida turadi.
  const [pinned, togglePin] = useLocalSet("markazai.pinnedGroups");
  const data = useMemo(() => [...rows].sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id))), [rows, pinned]);
  const [editing, setEditing] = useState<GroupRow | null>(null);
  const [deleting, setDeleting] = useState<GroupRow | null>(null);
  const [pending, startTransition] = useTransition();

  const changeStatus = useCallback(
    (row: GroupRow, status: string) =>
      startTransition(async () => {
        const res = await setGroupStatus(row.id, status);
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
      const res = await deleteGroup(deleting.id);
      if (res.ok) {
        toast.success(tc("deleted"));
        router.refresh();
      } else toast.error(res.error === "hasStudents" ? t("hasStudents") : res.error === "forbidden" ? tc("forbidden") : tc("error"));
      setDeleting(null);
    });
  };

  const columns = useMemo<AnyColumnDef<GroupRow>[]>(
    () => [
      {
        id: "no",
        header: "№",
        enableHiding: false,
        meta: { className: "w-8 text-muted-foreground text-xs tabular-nums" },
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        id: "name",
        header: t("name"),
        meta: { sortKey: "name", label: t("name") },
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <Link href={`/groups/${row.original.id}`} className="inline-flex items-center gap-1.5 font-medium hover:underline">
              {pinned.has(row.original.id) && <Pin className="text-brand-500 size-3.5 shrink-0" aria-label={t("pinned")} />}
              {row.original.name}
            </Link>
            <GroupStatusBadge status={row.original.status} />
          </div>
        ),
      },
      {
        id: "course",
        header: t("course"),
        meta: { label: t("course") },
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: row.original.course.color }} aria-hidden />
            {row.original.course.name}
          </span>
        ),
      },
      { id: "teacher", header: t("teacher"), meta: { label: t("teacher") }, cell: ({ row }) => row.original.teacherName },
      {
        id: "days",
        header: t("days"),
        meta: { label: t("days") },
        cell: ({ row }) => (
          <div className="flex flex-col text-xs">
            <span>{daysLabel(row.original.days, row.original.customDays)}</span>
            <span className="text-muted-foreground">{row.original.startTime}</span>
          </div>
        ),
      },
      {
        id: "dates",
        header: t("dates"),
        meta: { sortKey: "startDate", label: t("dates") },
        cell: ({ row }) => (
          <span className="text-xs whitespace-nowrap">
            {formatDate(row.original.startDate)} – {formatDate(row.original.endDate)}
          </span>
        ),
      },
      {
        id: "elapsed",
        header: t("elapsed"),
        meta: { label: t("elapsed") },
        cell: ({ row }) => {
          const { progress, daysElapsed } = row.original;
          // "2 oy 3 hafta" ko'rinishi: to'liq oylar, qolgan kunlardan haftalar (oy = 30 kun).
          const months = Math.floor(daysElapsed / 30);
          const weeks = Math.floor((daysElapsed % 30) / 7);
          const text = months || weeks ? [months ? t("elapsedMonths", { count: months }) : "", weeks ? t("elapsedWeeks", { count: weeks }) : ""].filter(Boolean).join(" ") : t("daysCount", { count: daysElapsed });
          return (
            <div className="flex w-28 flex-col gap-1">
              {progress !== null && (
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                  <div className="bg-primary h-full" style={{ width: `${progress}%` }} />
                </div>
              )}
              <span className="text-xs whitespace-nowrap">
                {text}
                {progress !== null && <span className="text-muted-foreground"> · {progress}%</span>}
              </span>
            </div>
          );
        },
      },
      { id: "room", header: t("room"), meta: { label: t("room") }, cell: ({ row }) => row.original.roomName ?? "—" },
      {
        id: "tags",
        header: t("tags"),
        meta: { label: t("tags") },
        cell: ({ row }) =>
          row.original.tags.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {row.original.tags.map((x) => (
                <Badge key={x.id} variant="secondary">
                  {x.name}
                </Badge>
              ))}
            </div>
          ),
      },
      {
        id: "students",
        header: t("students"),
        meta: { label: t("students") },
        cell: ({ row }) => {
          const { studentCount, capacity } = row.original;
          const full = capacity !== null && studentCount >= capacity;
          return (
            <span className={full ? "font-medium text-amber-600 dark:text-amber-400" : undefined}>
              {studentCount}
              {capacity !== null && <span className="text-muted-foreground">/{capacity}</span>}
            </span>
          );
        },
      },
      {
        id: "price",
        header: t("price"),
        meta: { sortKey: "price", label: t("price"), className: "text-right" },
        cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{formatMoney(row.original.price)}</span>,
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
              <DropdownMenuItem onClick={() => togglePin(row.original.id)}>
                {pinned.has(row.original.id) ? <PinOff /> : <Pin />} {pinned.has(row.original.id) ? t("unpin") : t("pin")}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={`/groups/${row.original.id}`} />}>{t("open")}</DropdownMenuItem>
              {canWrite && (
                <>
                  <DropdownMenuItem onClick={() => setEditing(row.original)}>{tc("edit")}</DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>{t("changeStatus")}</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {GROUP_STATUSES.filter((s) => s !== row.original.status).map((s) => (
                        <DropdownMenuItem key={s} onClick={() => changeStatus(row.original, s)}>
                          {te(s)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}
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
    [t, tc, te, daysLabel, canWrite, canDelete, changeStatus, page, pageSize, pinned, togglePin],
  );

  return (
    <>
      <DataTable columns={columns} data={data} total={total} page={page} pageSize={pageSize} sort={sort} getRowId={(r) => r.id} storageKey="groups" />

      {editing && <GroupSheet open onOpenChange={(o) => !o && setEditing(null)} lookups={lookups} group={toEditable(editing, lookups)} />}

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

export function NewGroupButton({ lookups, prefill, defaultOpen = false }: { lookups: GroupLookups; prefill?: Parameters<typeof GroupSheet>[0]["prefill"]; defaultOpen?: boolean }) {
  const t = useTranslations("group");
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t("new")}
      </Button>
      <GroupSheet open={open} onOpenChange={setOpen} lookups={lookups} prefill={prefill} />
    </>
  );
}
