"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PhoneCall, PhoneIncoming, PhoneOutgoing, Plus } from "lucide-react";
import { toast } from "sonner";
import { CALL_OUTCOMES, callSchema, type CallInput } from "@markazai/types";
import { logCall, type CommsTarget } from "@/app/(app)/comms/actions";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";

export type CallItem = {
  id: string;
  direction: "OUTGOING" | "INCOMING";
  outcome: (typeof CALL_OUTCOMES)[number];
  durationSeconds: number | null;
  note: string | null;
  createdAt: string;
  authorName: string;
  /** Talabaning oldingi (lid davridagi) yozuvi bo'lsa true. */
  fromLead?: boolean;
};

export function CallsTab({ target, items, canWrite }: { target: CommsTarget; items: CallItem[]; canWrite: boolean }) {
  const t = useTranslations("calls");
  const te = useTranslations("enums");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CallInput>({
    resolver: zodResolver(callSchema),
    defaultValues: { outcome: "ANSWERED", direction: "OUTGOING", durationMinutes: undefined, note: "" },
  });

  const submit = (values: CallInput) =>
    startTransition(async () => {
      const res = await logCall(target, values);
      if (res.ok) {
        toast.success(tc("saved"));
        setOpen(false);
        reset();
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  return (
    <div className="flex flex-col gap-4">
      {canWrite && (
        <Button className="w-fit" size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          {t("log")}
        </Button>
      )}

      {items.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="bg-card max-w-2xl divide-y rounded-lg border">
          {items.map((c) => {
            const Icon = c.direction === "INCOMING" ? PhoneIncoming : PhoneOutgoing;
            return (
              <li key={c.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={c.outcome === "ANSWERED" ? "secondary" : "outline"}>{te(`callOutcome.${c.outcome}`)}</Badge>
                    {c.durationSeconds ? <span className="text-muted-foreground text-xs">{t("minutes", { count: Math.max(1, Math.round(c.durationSeconds / 60)) })}</span> : null}
                    {c.fromLead && <Badge variant="outline">{t("fromLead")}</Badge>}
                  </div>
                  {c.note && <p className="whitespace-pre-wrap">{c.note}</p>}
                  <p className="text-muted-foreground text-xs">
                    {c.authorName} · {formatDateTime(c.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PhoneCall className="size-4" /> {t("log")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("direction")}>
                <SimpleSelect
                  value={watch("direction")}
                  onValueChange={(v) => setValue("direction", v as CallInput["direction"])}
                  options={[
                    { value: "OUTGOING", label: te("callDirection.OUTGOING") },
                    { value: "INCOMING", label: te("callDirection.INCOMING") },
                  ]}
                />
              </Field>
              <Field label={t("outcome")}>
                <SimpleSelect
                  value={watch("outcome")}
                  onValueChange={(v) => setValue("outcome", v as CallInput["outcome"])}
                  options={CALL_OUTCOMES.map((o) => ({ value: o, label: te(`callOutcome.${o}`) }))}
                />
              </Field>
            </div>
            <Field label={t("duration")} error={errors.durationMinutes ? tv("invalid") : undefined}>
              <Input type="number" min={0} {...register("durationMinutes", { setValueAs: (v) => (v === "" || v === undefined ? undefined : Number(v)) })} />
            </Field>
            <Field label={t("note")}>
              <Textarea rows={3} {...register("note")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
