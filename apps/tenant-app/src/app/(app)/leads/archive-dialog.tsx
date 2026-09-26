"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { archiveLead } from "./archive-actions";

/** Lidni arxivlash: sabab (majburiy) va izoh (ixtiyoriy) so'raladi. */
export function ArchiveDialog({ lead, reasons, onClose }: { lead: { id: string; name: string }; reasons: { id: string; name: string }[]; onClose: () => void }) {
  const t = useTranslations("lead.arch.dialog");
  const tc = useTranslations("common");
  const router = useRouter();
  const [reasonId, setReasonId] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const res = await archiveLead(lead.id, reasonId, note);
      if (res.ok) {
        toast.success(t("done"));
        onClose();
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{lead.name}</DialogDescription>
        </DialogHeader>
        {reasons.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noReasons")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="archive-reason">{t("reason")}</Label>
              <select id="archive-reason" className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm" value={reasonId} onChange={(e) => setReasonId(e.target.value)}>
                <option value="">{t("choose")}</option>
                {reasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="archive-note">{t("note")}</Label>
              <Textarea id="archive-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !reasonId}>
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
