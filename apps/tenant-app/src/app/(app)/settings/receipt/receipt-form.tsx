"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { receiptTemplateSchema, type ReceiptTemplateInput } from "@markazai/types";
import { Field } from "@/components/shared/form-field";
import { ReceiptView } from "@/components/shared/receipt-view";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { saveReceiptTemplate } from "../template-actions";

type Props = { initial: ReceiptTemplateInput; center: { name: string; phone: string | null; logoUrl: string | null }; branch: { name: string; address: string | null } | null };

/** Chek shabloni: chapda sozlamalar, o'ngda jonli ko'rinish (haqiqiy chek bilan bir xil komponent, namunaviy ma'lumot bilan). */
export function ReceiptForm({ initial, center, branch }: Props) {
  const t = useTranslations("settings.receipt");
  const tr = useTranslations("finance.receipt");
  const tc = useTranslations("common");
  const router = useRouter();
  const [thermal, setThermal] = useState(false);
  const [pending, startTransition] = useTransition();
  const { control, register, handleSubmit, watch, formState: { isDirty } } = useForm<ReceiptTemplateInput>({ resolver: zodResolver(receiptTemplateSchema), defaultValues: initial });
  const v = watch();

  const submit = (values: ReceiptTemplateInput) =>
    startTransition(async () => {
      const res = await saveReceiptTemplate(values);
      if (res.ok) {
        toast.success(tc("saved"));
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  const toggle = (name: "receiptShowLogo" | "receiptShowBranch" | "receiptShowCashier", label: string) => (
    <Controller control={control} name={name} render={({ field }) => (
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={!!field.value} onCheckedChange={(c) => field.onChange(!!c)} />
        {label}
      </label>
    )} />
  );

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,26rem)_1fr]">
      <form onSubmit={handleSubmit(submit)} className="bg-card flex flex-col gap-4 rounded-lg border p-5" noValidate>
        <Field label={t("header")}>
          <Input {...register("receiptHeader")} placeholder={t("headerPlaceholder")} />
        </Field>
        <Field label={t("footer")}>
          <Textarea rows={3} {...register("receiptFooter")} placeholder={tr("thanks")} />
        </Field>
        <div className="flex flex-col gap-2">
          {toggle("receiptShowLogo", t("showLogo"))}
          {toggle("receiptShowBranch", t("showBranch"))}
          {toggle("receiptShowCashier", t("showCashier"))}
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !isDirty}>
            {tc("save")}
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">{t("preview")}</span>
          <div className="bg-muted ml-auto inline-flex gap-1 rounded-lg p-1">
            {[false, true].map((th) => (
              <button key={String(th)} type="button" aria-pressed={thermal === th} onClick={() => setThermal(th)} className={cn("text-muted-foreground rounded-md px-3 py-1 text-sm", thermal === th && "bg-background text-foreground shadow-xs")}>
                {th ? t("thermal") : "A4"}
              </button>
            ))}
          </div>
        </div>
        <div className={cn("bg-background mx-auto w-full rounded-lg border p-4", thermal ? "max-w-[80mm] text-xs" : "max-w-[190mm] text-sm")}>
          <ReceiptView
            thermal={thermal}
            center={{ ...center, header: v.receiptHeader, footer: v.receiptFooter, showLogo: !!v.receiptShowLogo, showBranch: !!v.receiptShowBranch, showCashier: !!v.receiptShowCashier }}
            branch={branch}
            number="A1B2C3D4"
            rows={[
              [tr("student"), t("sample.student")],
              [tr("phone"), "+998 90 123 45 67"],
              [tr("group"), "A-3 · Ingliz tili"],
              [tr("teacher"), "Nodira Yusupova"],
              [tr("method"), t("sample.method")],
              [tr("date"), "22.09.2026"],
            ]}
            amount={450_000}
            balance={-50_000}
            cashier={t("sample.cashier")}
            labels={{ title: tr("title"), amount: tr("amount"), balanceAfter: tr("balanceAfter"), cashier: tr("cashier"), thanks: tr("thanks") }}
          />
        </div>
      </div>
    </div>
  );
}
