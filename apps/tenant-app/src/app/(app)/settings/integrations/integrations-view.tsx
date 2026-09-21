"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Field } from "@/components/shared/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { saveIntegration } from "../template-actions";

export type IntegrationItem = {
  kind: string;
  group: string;
  fields: { key: string; secret: boolean }[];
  enabled: boolean;
  values: Record<string, string>;
  /** Sir maydonlarining maskalangan qiymati ("••••1234"); bo'sh — hali kiritilmagan. */
  masked: Record<string, string>;
};

const GROUPS = ["payment", "marketing", "staff"] as const;

export function IntegrationsView({ items }: { items: IntegrationItem[] }) {
  const t = useTranslations("settings.integrations");
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <p className="text-muted-foreground text-sm">{t("hint")}</p>
      {GROUPS.map((g) => (
        <section key={g} className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">{t(`groups.${g}`)}</h2>
          {items.filter((i) => i.group === g).map((i) => (
            <IntegrationCard key={i.kind} item={i} />
          ))}
        </section>
      ))}
    </div>
  );
}

function IntegrationCard({ item }: { item: IntegrationItem }) {
  const t = useTranslations("settings.integrations");
  const tc = useTranslations("common");
  const router = useRouter();
  const [enabled, setEnabled] = useState(item.enabled);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(item.fields.map((f) => [f.key, f.secret ? "" : (item.values[f.key] ?? "")])));
  const [pending, startTransition] = useTransition();
  const configured = item.fields.every((f) => (f.secret ? !!item.masked[f.key] : !!item.values[f.key]));

  const save = () =>
    startTransition(async () => {
      const res = await saveIntegration(item.kind, enabled, values);
      if (res.ok) {
        toast.success(tc("saved"));
        // Sir maydonlari tozalanadi (saqlangan qiymat maskalangan holda qaytadi).
        setValues((cur) => Object.fromEntries(Object.entries(cur).map(([k, v]) => [k, item.fields.find((f) => f.key === k)?.secret ? "" : v])));
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  return (
    <div className="bg-card flex flex-col gap-4 rounded-lg border p-5">
      <div className="flex items-center gap-3">
        <h3 className="font-semibold">{t(`kinds.${item.kind}` as "kinds.PAYME")}</h3>
        {item.enabled && configured ? <Badge>{t("connected")}</Badge> : <Badge variant="outline">{t("notConnected")}</Badge>}
        <label className="ml-auto flex items-center gap-2 text-sm">
          <Checkbox checked={enabled} onCheckedChange={(c) => setEnabled(!!c)} />
          {t("enable")}
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {item.fields.map((f) => (
          <Field key={f.key} label={t(`fields.${f.key}` as "fields.merchantId")}>
            <Input
              type={f.secret ? "password" : "text"}
              autoComplete="off"
              value={values[f.key] ?? ""}
              placeholder={f.secret && item.masked[f.key] ? `${item.masked[f.key]} ${t("keepHint")}` : ""}
              onChange={(e) => setValues((cur) => ({ ...cur, [f.key]: e.target.value }))}
            />
          </Field>
        ))}
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {tc("save")}
        </Button>
      </div>
    </div>
  );
}
