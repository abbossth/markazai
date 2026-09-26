"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateEnrollmentJoinedAt } from "@/app/(app)/students/actions";

/** Talabaning guruhga qo'shilgan sanasini tahrirlash oynasi (boshqariladigan: `open` tashqaridan). */
export function JoinDateDialog({ studentId, groupId, joinedAt, open, onOpenChange }: { studentId: string; groupId: string; joinedAt: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("student");
  const tc = useTranslations("common");
  const router = useRouter();
  const [value, setValue] = useState(joinedAt);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const res = await updateEnrollmentJoinedAt(studentId, groupId, value);
      if (res.ok) {
        toast.success(tc("saved"));
        onOpenChange(false);
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editJoinDate")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="join-date-edit">{t("joinedAt")}</Label>
          <Input id="join-date-edit" type="date" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="button" onClick={save} disabled={pending || !value}>
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
