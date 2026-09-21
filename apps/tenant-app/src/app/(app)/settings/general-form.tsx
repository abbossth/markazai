"use client";

import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LESSON_START_STEPS, LOCALES, generalSettingsSchema, type GeneralSettingsInput, type GeneralSettingsOutput } from "@markazai/types";
import { PhoneInput } from "@/components/layout/phone-input";
import { Field } from "@/components/shared/form-field";
import { ImageUpload } from "@/components/shared/image-upload";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Textarea } from "@/components/ui/textarea";
import { saveGeneralSettings } from "./actions";

const DEFAULT_COLOR = "#2563eb";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function GeneralForm({ initial }: { initial: GeneralSettingsInput }) {
  const t = useTranslations("settings.general");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const err = (m?: string) => (m ? (tv.has(m as "required") ? tv(m as "required") : tv("invalid")) : undefined);

  const { control, register, handleSubmit, setError, watch, setValue, formState: { errors, isDirty } } = useForm<GeneralSettingsInput, unknown, GeneralSettingsOutput>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: initial,
  });
  const color = watch("brandColor");
  const gamification = watch("gamificationEnabled");

  const submit = (values: GeneralSettingsOutput) =>
    startTransition(async () => {
      // Server tomoni xom kirishni qayta tekshiradi (schema transformlari serverda ham ishlaydi).
      const res = await saveGeneralSettings(values as unknown as GeneralSettingsInput);
      if (res.ok) {
        toast.success(tc("saved"));
        router.refresh();
      } else if (res.fieldErrors) {
        for (const [name, message] of Object.entries(res.fieldErrors)) setError(name as keyof GeneralSettingsInput, { message });
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  return (
    <form onSubmit={handleSubmit(submit)} className="flex max-w-3xl flex-col gap-4" noValidate>
      <Section title={t("sections.center")}>
        <Field label={t("name")} error={err(errors.name?.message)}>
          <Input {...register("name")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("phone")} error={err(errors.phone?.message)}>
            <Controller control={control} name="phone" render={({ field }) => <PhoneInput value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} />} />
          </Field>
          <Field label={t("workingHours")}>
            <Input placeholder={t("workingHoursHint")} {...register("workingHours")} />
          </Field>
        </div>
        <Field label={t("address")}>
          <Input {...register("address")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("telegram")}>
            <Input placeholder="@markaz" {...register("telegram")} />
          </Field>
          <Field label={t("instagram")}>
            <Input placeholder="@markaz" {...register("instagram")} />
          </Field>
        </div>
      </Section>

      <Section title={t("sections.lessons")}>
        <Field label={t("lessonStartStep")} error={err(errors.lessonStartStep?.message)}>
          <Controller
            control={control}
            name="lessonStartStep"
            render={({ field }) => <SimpleSelect value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))} options={LESSON_START_STEPS.map((s) => ({ value: String(s), label: String(s) }))} className="w-40" />}
          />
          <p className="text-muted-foreground text-xs">{t("lessonStartStepHint")}</p>
        </Field>
        <Field label={t("returningStudentRule")}>
          <Textarea rows={3} {...register("returningStudentRule")} />
          <p className="text-muted-foreground text-xs">{t("returningStudentRuleHint")}</p>
        </Field>
      </Section>

      <Section title={t("sections.brand")}>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label={t("logo")}>
            <Controller control={control} name="logoUrl" render={({ field }) => <ImageUpload value={field.value} onChange={(u) => field.onChange(u)} />} />
          </Field>
          <Field label={t("loginBanner")}>
            <Controller control={control} name="loginBannerUrl" render={({ field }) => <ImageUpload value={field.value} onChange={(u) => field.onChange(u)} shape="wide" />} />
          </Field>
        </div>
        <Field label={t("brandColor")} error={err(errors.brandColor?.message)}>
          <div className="flex items-center gap-2">
            <input type="color" aria-label={t("brandColor")} value={color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_COLOR} onChange={(e) => setValue("brandColor", e.target.value, { shouldDirty: true })} className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1" />
            <Input className="w-32 font-mono" placeholder="#2563eb" {...register("brandColor")} />
            {color && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setValue("brandColor", "", { shouldDirty: true })}>
                {t("brandReset")}
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-xs">{t("brandColorHint")}</p>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("defaultTheme")}>
            <Controller control={control} name="defaultTheme" render={({ field }) => <SimpleSelect value={field.value} onValueChange={field.onChange} options={(["light", "dark", "system"] as const).map((v) => ({ value: v, label: t(`themes.${v}`) }))} />} />
          </Field>
          <Field label={t("locales")} error={err(errors.locales?.message)}>
            <Controller
              control={control}
              name="locales"
              render={({ field }) => (
                <div className="flex flex-wrap gap-4 pt-1.5">
                  {LOCALES.map((l) => {
                    const on = field.value.includes(l);
                    return (
                      <label key={l} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={on} onCheckedChange={(c) => field.onChange(c ? [...field.value, l] : field.value.filter((x) => x !== l))} />
                        {l.toUpperCase()}
                      </label>
                    );
                  })}
                </div>
              )}
            />
            <p className="text-muted-foreground text-xs">{t("localesHint")}</p>
          </Field>
        </div>
      </Section>

      <Section title={t("sections.login")}>
        <Field label={t("loginWelcome")}>
          <Input {...register("loginWelcome")} />
        </Field>
      </Section>

      <Section title={t("sections.offer")}>
        <Field label={t("offerText")}>
          <Textarea rows={5} {...register("offerText")} />
          <p className="text-muted-foreground text-xs">{t("offerHint")}</p>
        </Field>
      </Section>

      <Section title={t("sections.modules")}>
        <Controller
          control={control}
          name="gamificationEnabled"
          render={({ field }) => (
            <label className="flex items-start gap-3 text-sm">
              <Checkbox className="mt-0.5" checked={field.value} onCheckedChange={(c) => field.onChange(!!c)} />
              <span className="flex flex-col">
                <span className="font-medium">{t("gamification")}</span>
                <span className="text-muted-foreground text-xs">{t("gamificationHint")}</span>
              </span>
            </label>
          )}
        />
        {gamification && (
          <Field label={t("coinsPerLesson")} error={err(errors.coinsPerLesson?.message)}>
            <Input type="number" min={0} max={100} inputMode="numeric" className="w-32" {...register("coinsPerLesson", { valueAsNumber: true })} />
            <p className="text-muted-foreground text-xs">{t("coinsPerLessonHint")}</p>
          </Field>
        )}
      </Section>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !isDirty}>
          {tc("save")}
        </Button>
      </div>
    </form>
  );
}
