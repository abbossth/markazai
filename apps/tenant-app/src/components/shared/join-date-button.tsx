"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JoinDateDialog } from "./join-date-dialog";

/** Talaba sahifasidagi guruh kartochkasi uchun "qo'shilgan sanani tahrirlash" tugmasi. */
export function JoinDateButton({ studentId, groupId, joinedAt }: { studentId: string; groupId: string; joinedAt: string }) {
  const t = useTranslations("student");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="ghost" size="icon-xs" aria-label={t("editJoinDate")} title={t("editJoinDate")} onClick={() => setOpen(true)}>
        <Pencil className="size-3" />
      </Button>
      {open && <JoinDateDialog studentId={studentId} groupId={groupId} joinedAt={joinedAt} open onOpenChange={setOpen} />}
    </>
  );
}
