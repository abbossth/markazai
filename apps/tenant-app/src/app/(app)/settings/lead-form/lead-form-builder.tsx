"use client";

import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { leadFormSchema, normalizeLeadFormFields, type LeadFormInput, type LeadFormOutput } from "@markazai/types";
import { LeadFormView } from "@/app/(public)/apply/lead-form-view";
import { Field } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Textarea } from "@/components/ui/textarea";
import { saveLeadForm } from "../template-actions";

const LOCKED = ["name", "phone"];

/** Lid forma konstruktori: chapda sozlamalar, o'ngda jonli ko'rinish (ommaviy sahifadagi bilan bir xil komponent). */
export function LeadFormBuilder({ initial, columns, courses }: { initial: LeadFormInput; columns: { id: string; name: string }[]; courses: { id: string; name: string }[] }) {
  const t = useTranslations("settings.leadForm");
  const ta = useTranslations("apply.fields");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const err = (m?: string) => (m ? (tv.has(m as "required") ? tv(m as "required") : tv("invalid")) : undefined);
  const { control, register, handleSubmit, watch, formState: { errors, isDirty } } = useForm<LeadFormInput, unknown, LeadFormOutput>({ resolver: zodResolver(leadFormSchema), defaultValues: initial });
  const v = watch();

  const submit = (values: LeadFormOutput) =>
    startTransition(async () => {
      const res = await saveLeadForm(values as unknown as LeadFormInput);
      if (res.ok) {
        toast.success(tc("saved"));
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  // Origin faqat brauzerda ma'lum: hydration mos kelishi uchun mount'dan keyin o'rnatiladi.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/apply`;
  const previewFields = normalizeLeadFormFields(v.fields);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,30rem)_1fr]">
      <form onSubmit={handleSubmit(submit)} className="bg-card flex flex-col gap-4 rounded-lg border p-5" noValidate>
        <Controller control={control} name="enabled" render={({ field }) => (
          <label className="flex items-start gap-3 text-sm">
            <Checkbox className="mt-0.5" checked={field.value} onCheckedChange={(c) => field.onChange(!!c)} />
            <span className="flex flex-col">
              <span className="font-medium">{t("enabled")}</span>
              <span className="text-muted-foreground text-xs">{t("enabledHint")}</span>
            </span>
          </label>
        )} />
        <div className="flex items-center gap-2">
          <code className="bg-muted flex-1 truncate rounded-md px-3 py-1.5 text-xs">{link}</code>
          <Button type="button" variant="outline" size="icon-sm" aria-label={t("copyLink")} onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success(t("copied")))}>
            <Copy className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" aria-label={t("open")} nativeButton={false} render={<a href="/apply" target="_blank" rel="noopener noreferrer" />}>
            <ExternalLink className="size-4" />
          </Button>
        </div>
        <Field label={t("title")} error={err(errors.title?.message)}>
          <Input {...register("title")} />
        </Field>
        <Field label={t("description")}>
          <Textarea rows={2} {...register("description")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("submitLabel")} error={err(errors.submitLabel?.message)}>
            <Input {...register("submitLabel")} />
          </Field>
          <Field label={t("column")}>
            <Controller control={control} name="columnId" render={({ field }) => <SimpleSelect value={field.value ?? ""} onValueChange={field.onChange} placeholder={t("firstColumn")} options={[{ value: "", label: t("firstColumn") }, ...columns.map((c) => ({ value: c.id, label: c.name }))]} />} />
          </Field>
        </div>
        <Field label={t("successMessage")} error={err(errors.successMessage?.message)}>
          <Input {...register("successMessage")} />
        </Field>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("fields")}</span>
          <Controller
            control={control}
            name="fields"
            render={({ field }) => (
              <div className="flex flex-col divide-y rounded-md border">
                {normalizeLeadFormFields(field.value).map((f) => {
                  const locked = LOCKED.includes(f.key);
                  const update = (patch: Partial<typeof f>) => field.onChange(normalizeLeadFormFields(field.value).map((x) => (x.key === f.key ? { ...x, ...patch } : x)));
                  return (
                    <div key={f.key} className="flex flex-wrap items-center gap-3 p-3">
                      <label className="flex w-28 items-center gap-2 text-sm">
                        <Checkbox checked={f.enabled} disabled={locked} onCheckedChange={(c) => update({ enabled: !!c })} />
                        {ta(f.key)}
                      </label>
                      <label className="text-muted-foreground flex items-center gap-2 text-xs">
                        <Checkbox checked={f.required} disabled={locked || !f.enabled} onCheckedChange={(c) => update({ required: !!c })} />
                        {t("required")}
                      </label>
                      <Input className="h-8 min-w-32 flex-1" placeholder={t("customLabel")} value={f.label ?? ""} disabled={!f.enabled} onChange={(e) => update({ label: e.target.value || undefined })} />
                    </div>
                  );
                })}
              </div>
            )}
          />
          <p className="text-muted-foreground text-xs">{t("fieldsHint")}</p>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !isDirty}>
            {tc("save")}
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        <span className="text-muted-foreground text-sm">{t("preview")}</span>
        <div className="bg-muted/40 rounded-lg border p-6">
          <div className="bg-card mx-auto max-w-md rounded-xl border p-6">
            <LeadFormView preview courses={courses} config={{ title: v.title || "", description: v.description || null, submitLabel: v.submitLabel || "", successMessage: v.successMessage || "", fields: previewFields }} />
          </div>
        </div>
      </div>
    </div>
  );
}
