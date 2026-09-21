"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import type { LeadFormField } from "@markazai/types";
import { PhoneInput } from "@/components/layout/phone-input";
import { Field } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Textarea } from "@/components/ui/textarea";
import { submitLead } from "./actions";

export type LeadFormConfig = { title: string; description: string | null; submitLabel: string; successMessage: string; fields: LeadFormField[] };

const DAYS = ["ODD", "EVEN", "EVERY_DAY", "WEEKEND"] as const;

/**
 * Lid formasi: ham ommaviy sahifada (`/apply`), ham Sozlamalardagi jonli ko'rinishda (`preview`) ishlatiladi.
 * Ko'rinishda maydonlar faol emas va yuborish tugmasi hech narsa qilmaydi.
 */
export function LeadFormView({ config, courses, preview }: { config: LeadFormConfig; courses: { id: string; name: string }[]; preview?: boolean }) {
  const t = useTranslations("apply");
  const te = useTranslations("enums.days");
  const tv = useTranslations("validation");
  const [values, setValues] = useState({ name: "", phone: "", course: "", days: "", note: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof values) => (v: string) => setValues((cur) => ({ ...cur, [k]: v }));
  const err = (k: string) => (errors[k] ? (tv.has(errors[k] as "required") ? tv(errors[k] as "required") : tv("invalid")) : undefined);

  const enabled = config.fields.filter((f) => f.enabled);
  const label = (f: LeadFormField) => f.label || t(`fields.${f.key}`);
  const mark = (f: LeadFormField) => (f.required ? `${label(f)} *` : label(f));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) return;
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const res = await submitLead(values);
      if (res.ok) setDone(true);
      else if (res.error === "validation") setErrors(res.fieldErrors ?? {});
      else setFormError(t(`errors.${res.error}`));
    });
  };

  if (done)
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="text-primary size-10" />
        <p className="text-lg font-medium">{config.successMessage}</p>
      </div>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{config.title}</h2>
        {config.description && <p className="text-muted-foreground text-sm">{config.description}</p>}
      </div>
      {enabled.map((f) => (
        <Field key={f.key} label={mark(f)} error={err(f.key)}>
          {f.key === "name" && <Input value={values.name} onChange={(e) => set("name")(e.target.value)} disabled={preview} autoComplete="name" />}
          {f.key === "phone" && <PhoneInput value={values.phone} onChange={set("phone")} disabled={preview} />}
          {f.key === "course" && <SimpleSelect value={values.course} onValueChange={set("course")} disabled={preview} placeholder={t("choose")} options={courses.map((c) => ({ value: c.id, label: c.name }))} />}
          {f.key === "days" && <SimpleSelect value={values.days} onValueChange={set("days")} disabled={preview} placeholder={t("choose")} options={DAYS.map((d) => ({ value: d, label: te(d) }))} />}
          {f.key === "note" && <Textarea rows={3} value={values.note} onChange={(e) => set("note")(e.target.value)} disabled={preview} />}
        </Field>
      ))}
      {/* Honeypot: odam ko'rmaydi va to'ldirmaydi; botlar to'ldiradi. */}
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={values.website} onChange={(e) => set("website")(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      {formError && (
        <p role="alert" className="text-destructive text-sm">
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {config.submitLabel}
      </Button>
    </form>
  );
}
