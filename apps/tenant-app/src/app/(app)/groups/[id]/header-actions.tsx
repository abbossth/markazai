"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, History, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GROUP_STATUSES } from "@markazai/types";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteGroup, setGroupStatus } from "../actions";
import { GroupSheet, type EditableGroup } from "../group-form";
import type { GroupLookups } from "../queries";
import { AddStudentsDialog } from "./add-students-dialog";

type Props = { group: EditableGroup; status: string; lookups: GroupLookups; canWrite: boolean; canDelete: boolean };

export function GroupHeaderActions({ group, status, lookups, canWrite, canDelete }: Props) {
  const t = useTranslations("group");
  const tc = useTranslations("common");
  const te = useTranslations("enums.groupStatus");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const changeStatus = (next: string) =>
    startTransition(async () => {
      const res = await setGroupStatus(group.id, next);
      if (res.ok) {
        toast.success(tc("saved"));
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  const remove = () =>
    startTransition(async () => {
      const res = await deleteGroup(group.id);
      if (res.ok) {
        toast.success(tc("deleted"));
        router.push("/groups");
      } else {
        toast.error(res.error === "hasStudents" ? t("hasStudents") : tc("error"));
        setConfirmDelete(false);
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {canWrite && status === "ACTIVE" && (
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          {t("addStudents")}
        </Button>
      )}
      {canWrite && (
        <>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
            {tc("edit")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="sm" variant="outline" disabled={pending} />}>
              {t("changeStatus")}
              <ChevronDown className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {GROUP_STATUSES.filter((s) => s !== status).map((s) => (
                <DropdownMenuItem key={s} onClick={() => changeStatus(s)}>
                  {te(s)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
      <Button size="sm" variant="outline" nativeButton={false} render={<Link href="?tab=history" scroll={false} />}>
        <History className="size-4" />
        {tc("history")}
      </Button>
      {canDelete && (
        <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="size-4" />
          {tc("delete")}
        </Button>
      )}

      {canWrite && <GroupSheet open={editing} onOpenChange={setEditing} lookups={lookups} group={group} />}
      <AddStudentsDialog open={adding} onOpenChange={setAdding} groupId={group.id} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("deleteTitle", { name: group.name })}
        description={tc("confirmDelete")}
        confirmLabel={tc("delete")}
        destructive
        pending={pending}
        onConfirm={remove}
      />
    </div>
  );
}
