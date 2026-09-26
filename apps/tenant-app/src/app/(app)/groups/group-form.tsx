"use client";

import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DAYS_PATTERNS, groupSchema, toISODate, type GroupInput, type GroupOutput } from "@markazai/types";
import { Field } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SimpleSelect } from "@/components/ui/simple-select";
import { cn } from "@/lib/utils";
import { createGroup, updateGroup } from "./actions";
import type { GroupLookups } from "./queries";

export type EditableGroup = {
  id: string;
  name: string;
  courseId: string;
  teacherId: string;
  roomId: string | null;
  days: (typeof DAYS_PATTERNS)[number];
  customDays: number[];
  startTime: string;
  durationMinutes: number;
  startDate: string;
  endDate: string | null;
  price: number;
  tagIds: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lookups: GroupLookups;
  group?: EditableGroup;
  /** Yangi guruh formasini oldindan to'ldirish (masalan lidlar ro'yxatidan "Guruh yaratish"). */
  prefill?: Partial<Pick<GroupInput, "name" | "courseId" | "teacherId" | "days" | "startTime">>;
};

const NONE = "__none";

function defaults(group?: EditableGroup, prefill?: Props["prefill"]): GroupInput {
  return {
    name: group?.name ?? prefill?.name ?? "",
    courseId: group?.courseId ?? prefill?.courseId ?? "",
    teacherId: group?.teacherId ?? prefill?.teacherId ?? "",
    roomId: group?.roomId ?? "",
    days: group?.days ?? prefill?.days ?? "ODD",
    customDays: group?.customDays ?? [],
    startTime: group?.startTime ?? prefill?.startTime ?? "09:00",
    durationMinutes: group?.durationMinutes ?? 90,
    startDate: group?.startDate ?? toISODate(new Date()),
    endDate: group?.endDate ?? "",
    price: group?.price ?? 0,
    tagIds: group?.tagIds ?? [],
  };
}

export function GroupSheet({ open, onOpenChange, lookups, group, prefill }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-xl">
        {open && <GroupFormBody lookups={lookups} group={group} prefill={prefill} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function GroupFormBody({ lookups, group, prefill, onDone }: { lookups: GroupLookups; group?: EditableGroup; prefill?: Props["prefill"]; onDone: () => void }) {
  const t = useTranslations("group");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const td = useTranslations("enums");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!group;

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, dirtyFields },
  } = useForm<GroupInput, unknown, GroupOutput>({ resolver: zodResolver(groupSchema), defaultValues: defaults(group, prefill) });

  const days = watch("days");
  const errText = (msg?: string) => (msg ? (tv.has(msg as "required") ? tv(msg as "required") : tv("invalid")) : undefined);
  const field = (name: keyof GroupInput) => errText(errors[name]?.message as string | undefined);

  const send = (values: GroupOutput) => {
    startTransition(async () => {
      const res = group ? await updateGroup(group.id, values) : await createGroup(values);
      if (res.ok) {
        toast.success(tc("saved"));
        onDone();
        router.refresh();
        return;
      }
      if (res.fieldErrors) {
        for (const [name, message] of Object.entries(res.fieldErrors)) setError(name as keyof GroupInput, { message });
        if (res.error !== "validation") toast.error(errText(res.error) ?? tc("error"));
        return;
      }
      toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });
  };

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit(send)} noValidate>
      <SheetHeader>
        <SheetTitle>{isEdit ? t("editTitle") : t("newTitle")}</SheetTitle>
        <SheetDescription>{isEdit ? group.name : t("newDescription")}</SheetDescription>
      </SheetHeader>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 px-4 pb-4">
          <Field label={t("name")} error={field("name")}>
            <Input {...register("name")} placeholder="A-3" aria-invalid={!!errors.name} autoFocus />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("course")} error={field("courseId")}>
              <Controller
                control={control}
                name="courseId"
                render={({ field: f }) => (
                  <SimpleSelect
                    value={f.value}
                    placeholder={t("selectCourse")}
                    aria-invalid={!!errors.courseId}
                    onValueChange={(v) => {
                      f.onChange(v);
                      // Narx qo'lda o'zgartirilmagan bo'lsa, kurs narxi avtomatik qo'yiladi.
                      const course = lookups.courses.find((c) => c.id === v);
                      if (course && !dirtyFields.price && !isEdit) setValue("price", course.price);
                    }}
                    options={lookups.courses.map((c) => ({ value: c.id, label: c.name }))}
                  />
                )}
              />
            </Field>
            <Field label={t("teacher")} error={field("teacherId")}>
              <Controller
                control={control}
                name="teacherId"
                render={({ field: f }) => (
                  <SimpleSelect
                    value={f.value}
                    placeholder={t("selectTeacher")}
                    aria-invalid={!!errors.teacherId}
                    onValueChange={f.onChange}
                    options={lookups.teachers.map((x) => ({ value: x.id, label: x.name }))}
                  />
                )}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("days")} error={field("days")}>
              <Controller
                control={control}
                name="days"
                render={({ field: f }) => (
                  <SimpleSelect value={f.value} onValueChange={f.onChange} options={DAYS_PATTERNS.map((d) => ({ value: d, label: td(`days.${d}`) }))} />
                )}
              />
            </Field>
            <Field label={t("room")} error={field("roomId")}>
              <Controller
                control={control}
                name="roomId"
                render={({ field: f }) => (
                  <SimpleSelect
                    value={f.value || NONE}
                    onValueChange={(v) => f.onChange(v === NONE ? "" : v)}
                    options={[{ value: NONE, label: "—" }, ...lookups.rooms.map((r) => ({ value: r.id, label: `${r.name} (${r.capacity})` }))]}
                  />
                )}
              />
            </Field>
          </div>

          {days === "OTHER" && (
            <Controller
              control={control}
              name="customDays"
              render={({ field: f }) => (
                <div className="flex flex-col gap-2">
                  <Label>{t("customDays")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                      const on = f.value.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={on}
                          onClick={() => f.onChange(on ? f.value.filter((x) => x !== d) : [...f.value, d].sort())}
                          className={cn("rounded-md border px-3 py-1 text-sm transition-colors", on ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}
                        >
                          {td(`weekdaysShort.${d}` as "weekdaysShort.1")}
                        </button>
                      );
                    })}
                  </div>
                  {errors.customDays && <p className="text-destructive text-xs">{errText(errors.customDays.message)}</p>}
                </div>
              )}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("startTime")} error={field("startTime")}>
              <Input type="time" {...register("startTime")} />
            </Field>
            <Field label={t("duration")} error={field("durationMinutes")}>
              <Input type="number" min={15} step={5} {...register("durationMinutes", { valueAsNumber: true })} />
            </Field>
            <Field label={t("startDate")} error={field("startDate")}>
              <Input type="date" {...register("startDate")} />
            </Field>
            <Field label={t("endDate")} error={field("endDate")}>
              <Input type="date" {...register("endDate")} />
            </Field>
          </div>

          <Field label={t("price")} error={field("price")}>
            <Input type="number" min={0} step={1000} {...register("price", { valueAsNumber: true })} />
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
    </form>
  );
}
