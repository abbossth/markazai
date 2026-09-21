"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, Pencil, Trash2, UsersRound, Wallet } from "lucide-react";
import { toast } from "sonner";
import { STUDENT_STATUSES } from "@markazai/types";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaymentDialog, type PayStudent } from "../../finance/payment-dialog";
import { AddToGroupDialog } from "../add-to-group-dialog";
import { deleteStudent, setStudentStatus } from "../actions";
import { StudentSheet, type EditableStudent } from "../student-form";
import type { StudentLookups } from "../queries";

type Props = {
  student: EditableStudent;
  status: string;
  lookups: StudentLookups;
  canWrite: boolean;
  canDelete: boolean;
  /** Berilsa — "To'lov" tugmasi ko'rsatiladi (payments:write ruxsati bor foydalanuvchi uchun). */
  payStudent?: PayStudent;
  today: string;
};

export function StudentHeaderActions({ student, status, lookups, canWrite, canDelete, payStudent, today }: Props) {
  const t = useTranslations("student");
  const tc = useTranslations("common");
  const te = useTranslations("enums.studentStatus");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [addingToGroup, setAddingToGroup] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [reason, setReason] = useState("");

  if (!canWrite && !payStudent) return null;

  const changeStatus = (next: string, freezeReason?: string) =>
    startTransition(async () => {
      const res = await setStudentStatus(student.id, { status: next, freezeReason });
      if (res.ok) {
        toast.success(tc("saved"));
        setFreezeOpen(false);
        router.refresh();
      } else toast.error(res.error === "validation" ? t("freezeReasonRequired") : res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  const remove = () =>
    startTransition(async () => {
      const res = await deleteStudent(student.id);
      if (res.ok) {
        toast.success(tc("deleted"));
        router.push("/students");
      } else {
        toast.error(res.error === "hasPayments" ? t("hasPayments") : tc("error"));
        setConfirmDelete(false);
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {payStudent && (
        <Button size="sm" onClick={() => setPaying(true)}>
          <Wallet className="size-4" />
          {t("pay")}
        </Button>
      )}
      {canWrite && (
      <>
      <Button size="sm" onClick={() => setAddingToGroup(true)}>
        <UsersRound className="size-4" />
        {t("addToGroup")}
      </Button>
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
          {STUDENT_STATUSES.filter((s) => s !== "JOINED_THIS_MONTH" && s !== status).map((s) => (
            <DropdownMenuItem key={s} onClick={() => (s === "FROZEN" ? setFreezeOpen(true) : changeStatus(s))}>
              {te(s)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {canDelete && (
        <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="size-4" />
          {tc("delete")}
        </Button>
      )}
      </>
      )}

      {payStudent && <PaymentDialog open={paying} onOpenChange={setPaying} student={payStudent} today={today} />}

      <StudentSheet open={editing} onOpenChange={setEditing} lookups={lookups} student={student} />
      {addingToGroup && <AddToGroupDialog open onOpenChange={setAddingToGroup} studentIds={[student.id]} groups={lookups.groups} />}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("deleteTitle", { name: student.name })}
        description={tc("confirmDelete")}
        confirmLabel={tc("delete")}
        destructive
        pending={pending}
        onConfirm={remove}
      />
      <Dialog open={freezeOpen} onOpenChange={setFreezeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("freezeTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="freezeReason">{t("freezeReason")}</Label>
            <Input id="freezeReason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFreezeOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button disabled={pending || !reason.trim()} onClick={() => changeStatus("FROZEN", reason)}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
