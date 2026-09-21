"use client";

import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { teacherSchema, type TeacherInput, type TeacherOutput } from "@markazai/types";
import { PhoneInput } from "@/components/layout/phone-input";
import { Field } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SimpleSelect } from "@/components/ui/simple-select";
import { cn } from "@/lib/utils";
import { createTeacher, updateTeacher } from "./actions";
import type { TeacherLookups } from "./queries";

export type EditableTeacher = {
  id: string;
  name: string;
  phone: string;
  birthDate: string | null;
  gender: string | null;
  branchIds: string[];
  salaryType: "PERCENT" | "FIXED";
  percent: number | null;
  fixedSalary: number | null;
  workDays: number[];
  workStart: string | null;
  workEnd: string | null;
  workStartDate: string | null;
  hasLogin: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lookups: TeacherLookups;
  /** Maosh bo'limi faqat `salary:read` ruxsati borlarga ko'rsatiladi. */
  canSalary: boolean;
  teacher?: EditableTeacher;
};

const NONE = "__none";
const nine = (phone: string) => (phone.startsWith("998") ? phone.slice(3) : phone);

export function TeacherSheet(props: Props) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-xl">
        {props.open && <TeacherFormBody {...props} onDone={() => props.onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function TeacherFormBody({ lookups, canSalary, teacher, onDone }: Props & { onDone: () => void }) {
  const t = useTranslations("teacher");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const td = useTranslations("enums.weekdaysShort");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!teacher;

  const { register, control, handleSubmit, setError, watch, formState: { errors } } = useForm<TeacherInput, unknown, TeacherOutput>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      name: teacher?.name ?? "",
      phone: teacher ? nine(teacher.phone) : "",
      birthDate: teacher?.birthDate ?? "",
      gender: (teacher?.gender as "MALE" | "FEMALE" | null) ?? "",
      branchIds: teacher?.branchIds ?? [],
      salaryType: teacher?.salaryType ?? "PERCENT",
      percent: teacher?.percent ?? (canSalary ? undefined : 0),
      fixedSalary: teacher?.fixedSalary ?? undefined,
      workDays: teacher?.workDays ?? [],
      workStart: teacher?.workStart ?? "",
      workEnd: teacher?.workEnd ?? "",
      workStartDate: teacher?.workStartDate ?? "",
      password: "",
    },
  });
  const salaryType = watch("salaryType");
  const errText = (msg?: string) => (msg ? (tv.has(msg as "required") ? tv(msg as "required") : tv("invalid")) : undefined);
  const field = (name: keyof TeacherInput) => errText(errors[name]?.message as string | undefined);

  const send = (values: TeacherOutput) =>
    startTransition(async () => {
      const res = teacher ? await updateTeacher(teacher.id, values) : await createTeacher(values);
      if (res.ok) {
        toast.success(tc("saved"));
        onDone();
        router.refresh();
      } else if (res.fieldErrors) {
        for (const [name, message] of Object.entries(res.fieldErrors)) setError(name as keyof TeacherInput, { message });
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit(send)} noValidate>
      <SheetHeader>
        <SheetTitle>{isEdit ? t("editTitle") : t("newTitle")}</SheetTitle>
        <SheetDescription>{isEdit ? teacher.name : t("newDescription")}</SheetDescription>
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
            <Field label={t("birthDate")} error={field("birthDate")}>
              <Input type="date" {...register("birthDate")} />
            </Field>
            <Field label={t("gender")}>
              <Controller
                control={control}
                name="gender"
                render={({ field: f }) => (
                  <SimpleSelect
                    value={f.value || NONE}
                    onValueChange={(v) => f.onChange(v === NONE ? "" : v)}
                    options={[{ value: NONE, label: "—" }, { value: "MALE", label: t("male") }, { value: "FEMALE", label: t("female") }]}
                  />
                )}
              />
            </Field>
          </div>

          {lookups.branches.length > 0 && (
            <Controller
              control={control}
              name="branchIds"
              render={({ field: f }) => (
                <div className="flex flex-col gap-2">
                  <Label>{t("branches")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {lookups.branches.map((b) => {
                      const on = f.value.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => f.onChange(on ? f.value.filter((id) => id !== b.id) : [...f.value, b.id])}
                          className={cn("rounded-full border px-3 py-1 text-xs transition-colors", on ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}
                        >
                          {b.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            />
          )}

          <Field label={isEdit ? t("newPassword") : t("password")} error={field("password")}>
            <Input type="password" autoComplete="new-password" {...register("password")} />
            <p className="text-muted-foreground text-xs">{isEdit && teacher.hasLogin ? t("passwordHintEdit") : t("passwordHint")}</p>
          </Field>

          {canSalary && (
            <fieldset className="bg-muted/30 flex flex-col gap-4 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">{t("salarySection")}</legend>
              <Field label={t("salaryType")}>
                <Controller
                  control={control}
                  name="salaryType"
                  render={({ field: f }) => (
                    <SimpleSelect value={f.value} onValueChange={f.onChange} options={[{ value: "PERCENT", label: t("salaryPercent") }, { value: "FIXED", label: t("salaryFixed") }]} />
                  )}
                />
              </Field>

              {salaryType === "PERCENT" ? (
                <Field label={t("percent")} error={field("percent")}>
                  <Input type="number" min={0} max={100} inputMode="numeric" {...register("percent", { valueAsNumber: true })} />
                </Field>
              ) : (
                <>
                  <Field label={t("fixedSalary")} error={field("fixedSalary")}>
                    <Input type="number" min={0} step={10000} inputMode="numeric" {...register("fixedSalary", { valueAsNumber: true })} />
                  </Field>
                  <Controller
                    control={control}
                    name="workDays"
                    render={({ field: f }) => (
                      <div className="flex flex-col gap-2">
                        <Label>{t("workDays")}</Label>
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
                                {td(String(d) as "1")}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label={t("workStart")} error={field("workStart")}>
                      <Input type="time" {...register("workStart")} />
                    </Field>
                    <Field label={t("workEnd")} error={field("workEnd")}>
                      <Input type="time" {...register("workEnd")} />
                    </Field>
                    <Field label={t("workStartDate")} error={field("workStartDate")}>
                      <Input type="date" {...register("workStartDate")} />
                    </Field>
                  </div>
                </>
              )}
            </fieldset>
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
