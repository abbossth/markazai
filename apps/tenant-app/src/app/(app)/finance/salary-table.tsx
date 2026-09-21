"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { salaryPaymentSchema, type SalaryPaymentInput } from "@markazai/types";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field } from "@/components/shared/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate, formatMoney } from "@/lib/format";
import { deleteSalaryPayment, paySalary } from "./actions";

export type SalaryRow = { teacherId: string; name: string; model: "PERCENT" | "FIXED"; percent: number | null; calculated: number; paid: number; remaining: number };
export type SalaryPaymentRow = { id: string; teacherName: string; amount: number; date: string; note: string | null };

type Props = { period: string; today: string; rows: SalaryRow[]; payments: SalaryPaymentRow[]; canPay: boolean };

export function SalaryTable({ period, today, rows, payments, canPay }: Props) {
  const t = useTranslations("finance.salary");
  const tt = useTranslations("teacherAttendance");
  const tc = useTranslations("common");
  const router = useRouter();
  const [paying, setPaying] = useState<SalaryRow | null>(null);
  const [deleting, setDeleting] = useState<SalaryPaymentRow | null>(null);
  const [pending, startTransition] = useTransition();

  const confirmDelete = () => {
    if (!deleting) return;
    startTransition(async () => {
      const res = await deleteSalaryPayment(deleting.id);
      setDeleting(null);
      if (res.ok) {
        toast.success(tc("deleted"));
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="px-3 py-2 font-medium">{t("teacher")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("calculated")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("paid")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("remaining")}</th>
              {canPay && <th className="px-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teacherId} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/teachers/${r.teacherId}?tab=salary&month=${period}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                  <div>
                    <Badge variant="outline" className="mt-1">
                      {r.model === "FIXED" ? tt("modelFixed") : tt("percentOfPayments", { percent: r.percent ?? 0 })}
                    </Badge>
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.calculated)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.paid)}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">{r.remaining < 0 ? <span className="text-amber-600 dark:text-amber-400">{formatMoney(r.remaining)}</span> : formatMoney(r.remaining)}</td>
                {canPay && (
                  <td className="px-2 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => setPaying(r)}>
                      <Wallet className="size-4" />
                      {t("pay")}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="text-muted-foreground px-3 py-6 text-center" colSpan={5}>
                  {t("empty")}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t">
              <td className="px-3 py-2 font-semibold">{t("total")}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatMoney(rows.reduce((s, r) => s + r.calculated, 0))}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatMoney(rows.reduce((s, r) => s + r.paid, 0))}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatMoney(rows.reduce((s, r) => s + r.remaining, 0))}</td>
              {canPay && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {payments.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("payments")}</h3>
          <ul className="bg-card max-w-xl divide-y rounded-lg border">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1">
                  <span className="font-medium">{p.teacherName}</span> <span className="text-muted-foreground">· {formatDate(p.date)}{p.note ? ` · ${p.note}` : ""}</span>
                </span>
                <span className="font-medium tabular-nums">{formatMoney(p.amount)}</span>
                {canPay && (
                  <Button variant="ghost" size="icon-xs" aria-label={tc("delete")} onClick={() => setDeleting(p)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {paying && <PayDialog row={paying} period={period} today={today} onClose={() => setPaying(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("deletePayment")}
        description={t("deletePaymentHint")}
        confirmLabel={tc("delete")}
        destructive
        pending={pending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function PayDialog({ row, period, today, onClose }: { row: SalaryRow; period: string; today: string; onClose: () => void }) {
  const t = useTranslations("finance.salary");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, setError, formState: { errors } } = useForm<SalaryPaymentInput>({
    resolver: zodResolver(salaryPaymentSchema),
    defaultValues: { teacherId: row.teacherId, period, amount: (row.remaining > 0 ? row.remaining : undefined) as unknown as number, date: today, note: "" },
  });
  const err = (msg?: string) => (msg ? (tv.has(msg as "required") ? tv(msg as "required") : tv("invalid")) : undefined);

  const submit = (values: SalaryPaymentInput) =>
    startTransition(async () => {
      const res = await paySalary(values);
      if (res.ok) {
        toast.success(t("paidToast"));
        onClose();
        router.refresh();
      } else if (res.fieldErrors) {
        for (const [name, message] of Object.entries(res.fieldErrors)) setError(name as keyof SalaryPaymentInput, { message });
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t("payTitle", { name: row.name })}</DialogTitle>
            <DialogDescription>{t("payHint", { remaining: formatMoney(Math.max(0, row.remaining)) })}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("amount")} error={err(errors.amount?.message)}>
              <Input type="number" min={1} step={1000} inputMode="numeric" {...register("amount", { valueAsNumber: true })} autoFocus />
            </Field>
            <Field label={t("date")} error={err(errors.date?.message)}>
              <Input type="date" max={today} {...register("date")} />
            </Field>
          </div>
          <Field label={t("note")}>
            <Input {...register("note")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
