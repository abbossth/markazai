"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { GraduationCap, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toISODate } from "@markazai/types";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/simple-select";
import { deleteLead } from "../actions";
import { LeadSheet, type EditableLead } from "../lead-form";
import type { BoardLookups } from "../queries";
import { convertLeadToStudent } from "./actions";

type Props = {
  lead: EditableLead;
  converted: boolean;
  lookups: BoardLookups;
  groups: { id: string; name: string; courseName: string; members: number; capacity: number | null }[];
  canWrite: boolean;
  canConvert: boolean;
  canDelete: boolean;
};

const NONE = "__none";

export function LeadHeaderActions({ lead, converted, lookups, groups, canWrite, canConvert, canDelete }: Props) {
  const t = useTranslations("lead");
  const ts = useTranslations("student");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [groupId, setGroupId] = useState(NONE);
  const [joinedAt, setJoinedAt] = useState(() => toISODate(new Date()));

  const convert = (force = false) =>
    startTransition(async () => {
      const res = await convertLeadToStudent(lead.id, { groupId: groupId === NONE ? undefined : groupId, joinedAt }, force);
      if (res.ok) {
        toast.success(t("converted"));
        router.push(`/students/${res.studentId}`);
        return;
      }
      if (res.error === "duplicatePhone" && res.duplicate) {
        toast.warning(ts("duplicatePhoneConfirm", { name: res.duplicate.name }), {
          action: { label: ts("duplicatePhoneCreate"), onClick: () => convert(true) },
        });
        return;
      }
      toast.error(res.error === "forbidden" ? tc("forbidden") : res.error === "groupInactive" ? ts("groupInactive") : tc("error"));
    });

  const remove = () =>
    startTransition(async () => {
      const res = await deleteLead(lead.id);
      if (res.ok) {
        toast.success(tc("deleted"));
        router.push("/leads");
      } else {
        toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
        setDeleting(false);
      }
    });

  if (converted) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {canConvert && (
        <Button size="sm" onClick={() => setConverting(true)}>
          <GraduationCap className="size-4" />
          {t("convert")}
        </Button>
      )}
      {canWrite && (
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
          {tc("edit")}
        </Button>
      )}
      {canDelete && (
        <Button size="sm" variant="destructive" onClick={() => setDeleting(true)}>
          <Trash2 className="size-4" />
          {tc("delete")}
        </Button>
      )}

      {canWrite && <LeadSheet open={editing} onOpenChange={setEditing} lookups={lookups} lead={lead} />}

      <Dialog open={converting} onOpenChange={setConverting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("convertTitle", { name: lead.name })}</DialogTitle>
            <DialogDescription>{t("convertHint")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{ts("group")}</Label>
              <SimpleSelect
                value={groupId}
                onValueChange={setGroupId}
                options={[
                  { value: NONE, label: ts("noGroup") },
                  ...groups.map((g) => ({ value: g.id, label: `${g.name} · ${g.courseName} (${g.members}${g.capacity ? `/${g.capacity}` : ""})` })),
                ]}
              />
            </div>
            {groupId !== NONE && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="convert-date">{ts("joinedAt")}</Label>
                <Input id="convert-date" type="date" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConverting(false)}>
              {tc("cancel")}
            </Button>
            <Button disabled={pending} onClick={() => convert()}>
              {t("convert")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleting} onOpenChange={setDeleting} title={t("deleteTitle", { name: lead.name })} description={tc("confirmDelete")} confirmLabel={tc("delete")} destructive pending={pending} onConfirm={remove} />
    </div>
  );
}
