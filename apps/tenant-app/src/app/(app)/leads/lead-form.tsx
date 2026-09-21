"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DAYS_PATTERNS, LEAD_SOURCES, leadSchema, type LeadInput, type LeadOutput } from "@markazai/types";
import { PhoneInput } from "@/components/layout/phone-input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createLead, updateLead } from "./actions";
import type { BoardLookups } from "./queries";

export type EditableLead = {
  id: string;
  name: string;
  phone: string;
  source: string | null;
  columnId: string;
  listId: string | null;
  note: string | null;
  assignedToId: string | null;
  courseId: string | null;
  daysPattern: string | null;
  tagIds: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lookups: BoardLookups;
  lead?: EditableLead;
  /** Yaratishda oldindan tanlangan ustun/ro'yxat. */
  defaultColumnId?: string;
  defaultListId?: string;
};

const NONE = "__none";
const nine = (phone: string) => (phone.startsWith("998") ? phone.slice(3) : phone);

export function LeadSheet(props: Props) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-xl">
        {props.open && <LeadFormBody {...props} onDone={() => props.onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function LeadFormBody({ lookups, lead, defaultColumnId, defaultListId, onDone }: Props & { onDone: () => void }) {
  const t = useTranslations("lead");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const te = useTranslations("enums");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [duplicate, setDuplicate] = useState<{ values: LeadOutput; name: string; kind: "lead" | "student" } | null>(null);
  const isEdit = !!lead;

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LeadInput, unknown, LeadOutput>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: lead?.name ?? "",
      phone: lead ? nine(lead.phone) : "",
      source: (lead?.source as LeadInput["source"]) ?? "",
      columnId: lead?.columnId ?? defaultColumnId ?? lookups.columns[0]?.id ?? "",
      listId: lead?.listId ?? defaultListId ?? "",
      note: lead?.note ?? "",
      assignedToId: lead?.assignedToId ?? "",
      courseId: lead?.courseId ?? "",
      daysPattern: (lead?.daysPattern as LeadInput["daysPattern"]) ?? "",
      tagIds: lead?.tagIds ?? [],
    },
  });

  const columnId = watch("columnId");
  const lists = lookups.columns.find((c) => c.id === columnId)?.lists ?? [];
  const errText = (msg?: string) => (msg ? (tv.has(msg as "required") ? tv(msg as "required") : tv("invalid")) : undefined);
  const field = (name: keyof LeadInput) => errText(errors[name]?.message as string | undefined);

  const send = (values: LeadOutput, force = false) => {
    startTransition(async () => {
      const res = lead ? await updateLead(lead.id, values, { force }) : await createLead(values, { force });
      if (res.ok) {
        toast.success(tc("saved"));
        onDone();
        router.refresh();
      } else if (res.error === "duplicatePhone" && res.duplicate) {
        setDuplicate({ values, ...res.duplicate });
      } else if (res.fieldErrors) {
        for (const [name, message] of Object.entries(res.fieldErrors)) setError(name as keyof LeadInput, { message });
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });
  };

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit((v) => send(v))} noValidate>
      <SheetHeader>
        <SheetTitle>{isEdit ? t("editTitle") : t("newTitle")}</SheetTitle>
        <SheetDescription>{isEdit ? lead.name : t("newDescription")}</SheetDescription>
      </SheetHeader>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 px-4 pb-4">
          <Field label={t("name")} error={field("name")}>
            <Input {...register("name")} aria-invalid={!!errors.name} autoFocus />
          </Field>
          <Field label={t("phone")} error={field("phone")}>
            <Controller control={control} name="phone" render={({ field: f }) => <PhoneInput value={f.value} onChange={f.onChange} onBlur={f.onBlur} ref={f.ref} aria-invalid={!!errors.phone} />} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("column")} error={field("columnId")}>
              <Controller
                control={control}
                name="columnId"
                render={({ field: f }) => (
                  <SimpleSelect
                    value={f.value}
                    onValueChange={(v) => {
                      f.onChange(v);
                      setValue("listId", ""); // ro'yxat ustunga bog'liq
                    }}
                    options={lookups.columns.map((c) => ({ value: c.id, label: c.name }))}
                  />
                )}
              />
            </Field>
            <Field label={t("list")} error={field("listId")}>
              <Controller
                control={control}
                name="listId"
                render={({ field: f }) => (
                  <SimpleSelect
                    value={f.value || NONE}
                    onValueChange={(v) => f.onChange(v === NONE ? "" : v)}
                    options={[{ value: NONE, label: "—" }, ...lists.map((l) => ({ value: l.id, label: l.name }))]}
                  />
                )}
              />
            </Field>
            <Field label={t("source")}>
              <Controller
                control={control}
                name="source"
                render={({ field: f }) => (
                  <SimpleSelect
                    value={f.value || NONE}
                    onValueChange={(v) => f.onChange(v === NONE ? "" : v)}
                    options={[{ value: NONE, label: "—" }, ...LEAD_SOURCES.map((s) => ({ value: s.value, label: te(`leadSource.${s.value}`) }))]}
                  />
                )}
              />
            </Field>
            <Field label={t("assignee")}>
              <Controller
                control={control}
                name="assignedToId"
                render={({ field: f }) => (
                  <SimpleSelect
                    value={f.value || NONE}
                    onValueChange={(v) => f.onChange(v === NONE ? "" : v)}
                    options={[{ value: NONE, label: "—" }, ...lookups.assignees.map((u) => ({ value: u.id, label: u.name }))]}
                  />
                )}
              />
            </Field>
            <Field label={t("course")}>
              <Controller
                control={control}
                name="courseId"
                render={({ field: f }) => (
                  <SimpleSelect
                    value={f.value || NONE}
                    onValueChange={(v) => f.onChange(v === NONE ? "" : v)}
                    options={[{ value: NONE, label: "—" }, ...lookups.courses.map((c) => ({ value: c.id, label: c.name }))]}
                  />
                )}
              />
            </Field>
            <Field label={t("days")}>
              <Controller
                control={control}
                name="daysPattern"
                render={({ field: f }) => (
                  <SimpleSelect
                    value={f.value || NONE}
                    onValueChange={(v) => f.onChange(v === NONE ? "" : v)}
                    options={[{ value: NONE, label: "—" }, ...DAYS_PATTERNS.map((d) => ({ value: d, label: te(`days.${d}`) }))]}
                  />
                )}
              />
            </Field>
          </div>

          <Field label={t("note")}>
            <Textarea rows={3} {...register("note")} />
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
        </div>
      </ScrollArea>

      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <Button type="button" variant="outline" onClick={onDone}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {tc("save")}
        </Button>
      </SheetFooter>

      <ConfirmDialog
        open={!!duplicate}
        onOpenChange={(o) => !o && setDuplicate(null)}
        title={t("duplicateTitle")}
        description={duplicate ? t(duplicate.kind === "lead" ? "duplicateLead" : "duplicateStudent", { name: duplicate.name }) : undefined}
        confirmLabel={t("saveAnyway")}
        pending={pending}
        onConfirm={() => {
          if (duplicate) send(duplicate.values, true);
          setDuplicate(null);
        }}
      />
    </form>
  );
}
