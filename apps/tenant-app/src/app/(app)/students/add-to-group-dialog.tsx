"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { toISODate } from "@markazai/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/simple-select";
import { addStudentsToGroup } from "./actions";
import type { StudentLookups } from "./queries";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentIds: string[];
  groups: StudentLookups["groups"];
  onDone?: () => void;
};

export function AddToGroupDialog({ open, onOpenChange, studentIds, groups, onDone }: Props) {
  const t = useTranslations("student");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [groupId, setGroupId] = useState("");
  const [joinedAt, setJoinedAt] = useState(() => toISODate(new Date()));

  const submit = () => {
    if (!groupId) return;
    startTransition(async () => {
      const res = await addStudentsToGroup(studentIds, groupId, joinedAt);
      if (!res.ok) {
        toast.error(res.error === "forbidden" ? tc("forbidden") : res.error === "groupInactive" ? t("groupInactive") : tc("error"));
        return;
      }
      toast.success(t("addedToGroup", { added: res.added, skipped: res.skipped }));
      if (res.overCapacity) toast.warning(t("overCapacity"));
      onOpenChange(false);
      onDone?.();
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addToGroup")}</DialogTitle>
          <DialogDescription>{t("addToGroupDescription", { count: studentIds.length })}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("group")}</Label>
            <SimpleSelect
              value={groupId}
              onValueChange={setGroupId}
              placeholder={t("selectGroup")}
              options={groups.map((g) => ({
                value: g.id,
                label: `${g.name} · ${g.courseName} (${g.members}${g.capacity ? `/${g.capacity}` : ""})`,
              }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="joinedAt">{t("joinedAt")}</Label>
            <Input id="joinedAt" type="date" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button disabled={!groupId || pending} onClick={submit}>
            {tc("add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
