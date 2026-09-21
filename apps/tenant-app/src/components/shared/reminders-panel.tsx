"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { reminderSchema, type ReminderInput } from "@markazai/types";
import { createReminder, deleteReminder, setReminderDone } from "@/app/(app)/reminders/actions";
import type { ReminderItem, ReminderLookups } from "@/app/(app)/reminders/queries";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Link = { leadId: string } | { groupId: string } | { studentId: string };

type Props = {
  link: Link;
  items: ReminderItem[];
  lookups: ReminderLookups;
  currentUserId: string;
  canWrite: boolean;
  canDeleteAny: boolean;
  /** Ixcham ko'rinish (yon panel uchun). */
  compact?: boolean;
  /** Dialog ochilganda sukut bo'yicha sana (markaz vaqti, "YYYY-MM-DD") — serverdan keladi. */
  today: string;
};

export function RemindersPanel({ link, items, lookups, currentUserId, canWrite, canDeleteAny, compact, today }: Props) {
  const t = useTranslations("reminders");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const { register, control, handleSubmit, reset, setError, formState: { errors } } = useForm<ReminderInput>({
    resolver: zodResolver(reminderSchema),
    defaultValues: { title: "", note: "", dueDate: today, dueTime: "09:00", responsibleId: currentUserId, tagIds: [], ...link },
  });
  const errText = (msg?: string) => (msg ? (tv.has(msg as "required") ? tv(msg as "required") : tv("invalid")) : undefined);

  const submit = (values: ReminderInput) =>
    startTransition(async () => {
      const res = await createReminder(values);
      if (res.ok) {
        toast.success(tc("saved"));
        setOpen(false);
        reset();
        router.refresh();
      } else if (res.fieldErrors) {
        for (const [name, message] of Object.entries(res.fieldErrors)) setError(name as keyof ReminderInput, { message });
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  const toggle = (item: ReminderItem, done: boolean) =>
    startTransition(async () => {
      const res = await setReminderDone(item.id, done);
      if (res.ok) router.refresh();
      else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  const remove = (item: ReminderItem) =>
    startTransition(async () => {
      const res = await deleteReminder(item.id);
      if (res.ok) router.refresh();
      else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  return (
    <div className="flex flex-col gap-3">
      {canWrite && (
        <Button className="w-fit" size="sm" variant={compact ? "outline" : "default"} onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      )}

      {items.length === 0 ? (
        compact ? <p className="text-muted-foreground text-sm">{t("empty")}</p> : <EmptyState title={t("empty")} />
      ) : (
        <ul className={cn("bg-card divide-y rounded-lg border", !compact && "max-w-2xl")}>
          {items.map((r) => {
            const done = !!r.doneAt;
            const canToggle = r.responsibleId === currentUserId || r.createdById === currentUserId || canDeleteAny;
            return (
              <li key={r.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                <Checkbox className="mt-0.5" checked={done} disabled={!canToggle || pending} onCheckedChange={(v) => toggle(r, !!v)} aria-label={t("markDone")} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn("font-medium", done && "text-muted-foreground line-through")}>{r.title}</span>
                  {r.note && <span className="text-muted-foreground text-xs whitespace-pre-wrap">{r.note}</span>}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className={cn("inline-flex items-center gap-1", r.overdue ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>
                      <Bell className="size-3" /> {formatDateTime(r.dueAt)}
                    </span>
                    <span className="text-muted-foreground">· {r.responsibleName}</span>
                    {r.overdue && <Badge variant="destructive">{t("overdue")}</Badge>}
                    {r.tags.map((x) => (
                      <Badge key={x.id} variant="secondary">
                        {x.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                {(r.createdById === currentUserId || canDeleteAny) && (
                  <Button variant="ghost" size="icon-xs" aria-label={tc("delete")} disabled={pending} onClick={() => remove(r)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>{t("add")}</DialogTitle>
            </DialogHeader>
            <Field label={t("title")} error={errText(errors.title?.message)}>
              <Input {...register("title")} autoFocus />
            </Field>
            <Field label={t("note")}>
              <Textarea rows={2} {...register("note")} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("dueDate")} error={errText(errors.dueDate?.message)}>
                <Input type="date" {...register("dueDate")} />
              </Field>
              <Field label={t("dueTime")} error={errText(errors.dueTime?.message)}>
                <Input type="time" {...register("dueTime")} />
              </Field>
            </div>
            <Field label={t("responsible")} error={errText(errors.responsibleId?.message)}>
              <Controller
                control={control}
                name="responsibleId"
                render={({ field: f }) => <SimpleSelect value={f.value} onValueChange={f.onChange} options={lookups.users.map((u) => ({ value: u.id, label: u.name }))} />}
              />
            </Field>
            {lookups.tags.length > 0 && (
              <Controller
                control={control}
                name="tagIds"
                render={({ field: f }) => (
                  <div className="flex flex-col gap-2">
                    <Label>{t("tags")}</Label>
                    <div className="flex flex-wrap gap-2">
                      {lookups.tags.map((tag) => {
                        const on = f.value.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => f.onChange(on ? f.value.filter((id) => id !== tag.id) : [...f.value, tag.id])}
                            className={cn("rounded-full border px-3 py-1 text-xs transition-colors", on ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              />
            )}
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

