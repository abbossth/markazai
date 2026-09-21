"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { studentSchema, toISODate, type StudentInput, type StudentOutput } from "@markazai/types";
import { PhoneInput } from "@/components/layout/phone-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createStudent, updateStudent } from "./actions";
import type { StudentLookups } from "./queries";

export type EditableStudent = {
  id: string;
  name: string;
  phone: string;
  extraPhones: string[];
  birthDate: string | null;
  gender: string | null;
  note: string | null;
  contactPerson: string | null;
  email: string | null;
  telegram: string | null;
  socialLink: string | null;
  address: string | null;
  externalId: string | null;
  tagIds: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lookups: Pick<StudentLookups, "tags" | "groups">;
  /** Berilsa — tahrirlash rejimi (guruhga qo'shish maydonlari yashiriladi). */
  student?: EditableStudent;
};

const NONE = "__none";
const nine = (phone: string) => (phone.startsWith("998") ? phone.slice(3) : phone);

function defaults(student?: EditableStudent): StudentInput {
  return {
    name: student?.name ?? "",
    phone: student ? nine(student.phone) : "",
    extraPhones: student?.extraPhones.map(nine) ?? [],
    birthDate: student?.birthDate ?? "",
    gender: (student?.gender as "MALE" | "FEMALE" | null) ?? "",
    note: student?.note ?? "",
    contactPerson: student?.contactPerson ?? "",
    email: student?.email ?? "",
    telegram: student?.telegram ?? "",
    socialLink: student?.socialLink ?? "",
    address: student?.address ?? "",
    externalId: student?.externalId ?? "",
    tagIds: student?.tagIds ?? [],
    groupId: "",
    joinedAt: toISODate(new Date()),
  };
}

export function StudentSheet({ open, onOpenChange, lookups, student }: Props) {
  // Yopilganda forma holati tozalanishi uchun ichki qism har ochilishda qayta yaratiladi.
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-xl">
        {open && <StudentFormBody lookups={lookups} student={student} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function StudentFormBody({ lookups, student, onDone }: { lookups: Props["lookups"]; student?: EditableStudent; onDone: () => void }) {
  const t = useTranslations("student");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [moreOpen, setMoreOpen] = useState(!!student);
  const isEdit = !!student;

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<StudentInput, unknown, StudentOutput>({
    resolver: zodResolver(studentSchema),
    defaultValues: defaults(student),
  });

  const errText = (msg?: string) => (msg ? (tv.has(msg as "required") ? tv(msg as "required") : tv("invalid")) : undefined);

  // Sxemalar idempotent: transformdan o'tgan qiymatni server qayta tekshirganda ham to'g'ri chiqadi.
  const send = (values: StudentOutput) => {
    startTransition(async () => {
      const res = student ? await updateStudent(student.id, values) : await createStudent(values);
      if (res.ok) {
        toast.success(tc("saved"));
        onDone();
        router.refresh();
        return;
      }
      if (res.error === "validation" && res.fieldErrors) {
        for (const [field, message] of Object.entries(res.fieldErrors)) setError(field as keyof StudentInput, { message });
        return;
      }
      toast.error(res.error === "forbidden" ? tc("forbidden") : res.error === "groupInactive" ? t("groupInactive") : tc("error"));
    });
  };

  const field = (name: keyof StudentInput) => errText(errors[name]?.message as string | undefined);

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={handleSubmit(send, () => setMoreOpen(true))}
      noValidate
    >
      <SheetHeader>
        <SheetTitle>{isEdit ? t("editTitle") : t("newTitle")}</SheetTitle>
        <SheetDescription>{isEdit ? student.name : t("newDescription")}</SheetDescription>
      </SheetHeader>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 px-4 pb-4">
          <Field label={t("name")} error={field("name")}>
            <Input {...register("name")} aria-invalid={!!errors.name} autoFocus />
          </Field>

          <Field label={t("phone")} error={field("phone")}>
            <Controller control={control} name="phone" render={({ field: f }) => <PhoneInput value={f.value} onChange={f.onChange} onBlur={f.onBlur} ref={f.ref} aria-invalid={!!errors.phone} />} />
          </Field>

          <Controller
            control={control}
            name="extraPhones"
            render={({ field: f }) => {
              const list = (f.value as string[]) ?? [];
              return (
                <div className="flex flex-col gap-2">
                  <Label>{t("extraPhones")}</Label>
                  {list.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <PhoneInput
                        value={p}
                        onChange={(digits) => f.onChange(list.map((x, j) => (j === i ? digits : x)))}
                        aria-label={`${t("extraPhones")} ${i + 1}`}
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => f.onChange(list.filter((_, j) => j !== i))} aria-label={tc("delete")}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {errors.extraPhones && <p className="text-destructive text-xs">{tv("invalidPhone")}</p>}
                  {list.length < 5 && (
                    <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => f.onChange([...list, ""])}>
                      <Plus className="size-4" />
                      {t("addPhone")}
                    </Button>
                  )}
                </div>
              );
            }}
          />

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
                    options={[
                      { value: NONE, label: "—" },
                      { value: "MALE", label: t("male") },
                      { value: "FEMALE", label: t("female") },
                    ]}
                  />
                )}
              />
            </Field>
          </div>

          <Field label={t("note")}>
            <Textarea rows={3} {...register("note")} />
          </Field>

          {!isEdit && (
            <div className="bg-muted/40 grid gap-4 rounded-lg border p-3 sm:grid-cols-2">
              <Field label={t("group")}>
                <Controller
                  control={control}
                  name="groupId"
                  render={({ field: f }) => (
                    <SimpleSelect
                      value={f.value || NONE}
                      onValueChange={(v) => f.onChange(v === NONE ? "" : v)}
                      options={[
                        { value: NONE, label: t("noGroup") },
                        ...lookups.groups.map((g) => ({
                          value: g.id,
                          label: `${g.name} · ${g.courseName} (${g.members}${g.capacity ? `/${g.capacity}` : ""})`,
                        })),
                      ]}
                    />
                  )}
                />
              </Field>
              <Field label={t("joinedAt")} error={field("joinedAt")}>
                <Input type="date" {...register("joinedAt")} />
              </Field>
            </div>
          )}

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

          <button type="button" className="text-primary w-fit text-sm hover:underline" onClick={() => setMoreOpen((o) => !o)}>
            {moreOpen ? t("lessContacts") : t("moreContacts")}
          </button>

          {moreOpen && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("contactPerson")}>
                <Input {...register("contactPerson")} />
              </Field>
              <Field label={t("email")} error={field("email")}>
                <Input type="email" {...register("email")} />
              </Field>
              <Field label={t("telegram")}>
                <Input placeholder="@username" {...register("telegram")} />
              </Field>
              <Field label={t("socialLink")}>
                <Input {...register("socialLink")} />
              </Field>
              <Field label={t("externalId")}>
                <Input {...register("externalId")} />
              </Field>
              <Field label={t("address")}>
                <Input {...register("address")} />
              </Field>
            </div>
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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
