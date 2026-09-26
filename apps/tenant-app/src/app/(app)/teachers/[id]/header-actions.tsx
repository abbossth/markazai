"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteTeacher, setTeacherActive } from "../actions";
import type { TeacherLookups } from "../queries";
import { TeacherSheet, type EditableTeacher } from "../teacher-form";

type Props = { teacher: EditableTeacher; isActive: boolean; lookups: TeacherLookups; canSalary: boolean };

export function TeacherHeaderActions({ teacher, isActive, lookups, canSalary }: Props) {
  const t = useTranslations("teacher");
  const tc = useTranslations("common");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      const res = await setTeacherActive(teacher.id, !isActive);
      if (res.ok) {
        toast.success(tc("saved"));
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  const remove = () =>
    startTransition(async () => {
      const res = await deleteTeacher(teacher.id);
      if (res.ok) {
        toast.success(tc("deleted"));
        router.push("/teachers");
      } else {
        setDeleting(false);
        toast.error(res.error === "hasRecords" ? t("hasRecords") : tc("error"));
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button variant="outline" className="h-9 px-3.5" onClick={() => setEditing(true)}>
        <Pencil className="size-4" />
        {tc("edit")}
      </Button>
      {/* Kamdan-kam va xavfli amallar (nofaol qilish, o'chirish) alohida menyuda — tasodifan bosilmasligi uchun. */}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="icon" variant="outline" className="size-9" aria-label={tc("actions")} title={tc("actions")} disabled={pending} />}>
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={toggle}>
            <Power /> {isActive ? t("deactivate") : t("activate")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
            <Trash2 /> {tc("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TeacherSheet open={editing} onOpenChange={setEditing} lookups={lookups} canSalary={canSalary} teacher={teacher} />
      <ConfirmDialog open={deleting} onOpenChange={setDeleting} title={t("deleteTitle", { name: teacher.name })} description={tc("confirmDelete")} confirmLabel={tc("delete")} destructive pending={pending} onConfirm={remove} />
    </div>
  );
}
