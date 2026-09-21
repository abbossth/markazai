"use client";

import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { toast } from "sonner";
import { PAYMENT_METHODS, paymentSchema, type PaymentInput } from "@markazai/types";
import { Field } from "@/components/shared/form-field";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { formatMoney, formatPhone } from "@/lib/format";
import { recordPayment, searchStudentsForPayment } from "./actions";

export type PayStudent = { id: string; name: string; phone?: string; balance: number; groups: { id: string; name: string }[] };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Berilsa — talaba oldindan tanlangan (talaba profilidan ochilganda). */
  student?: PayStudent;
  /** Markaz vaqti bo'yicha bugun ("YYYY-MM-DD"), serverdan. */
  today: string;
};

const NONE = "__none";

export function PaymentDialog({ open, onOpenChange, student, today }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open && <PaymentForm student={student} today={today} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function PaymentForm({ student: initial, today, onDone }: { student?: PayStudent; today: string; onDone: () => void }) {
  const t = useTranslations("finance.payment");
  const te = useTranslations("enums.paymentMethod");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [student, setStudent] = useState<PayStudent | undefined>(initial);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PayStudent[]>([]);

  const { register, control, handleSubmit, setValue, setError, formState: { errors } } = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      studentId: initial?.id ?? "",
      groupId: initial?.groups.length === 1 ? initial.groups[0]!.id : "",
      amount: undefined as unknown as number,
      method: "CASH",
      date: today,
      description: "",
    },
  });
  const errText = (msg?: string) => (msg ? (tv.has(msg as "required") ? tv(msg as "required") : tv("invalid")) : undefined);

  // Talaba qidiruvi (250ms debounce), natijalar server action'dan.
  useEffect(() => {
    if (student || q.trim().length < 2) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      const found = await searchStudentsForPayment(q);
      if (!cancelled) setResults(found);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [q, student]);

  const pick = (s: PayStudent | undefined) => {
    setStudent(s);
    setValue("studentId", s?.id ?? "", { shouldValidate: true });
    setValue("groupId", s?.groups.length === 1 ? s.groups[0]!.id : "");
    setQ("");
    setResults([]);
  };

  const submit = (values: PaymentInput) =>
    startTransition(async () => {
      const res = await recordPayment(values);
      if (res.ok) {
        toast.success(t("recorded"), { action: { label: t("printReceipt"), onClick: () => window.open(`/receipt/${res.id}`, "_blank", "noopener") } });
        onDone();
        router.refresh();
      } else if (res.fieldErrors) {
        for (const [name, message] of Object.entries(res.fieldErrors)) setError(name as keyof PaymentInput, { message });
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  const shown = student || q.trim().length < 2 ? [] : results;

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      <Field label={t("student")} error={errText(errors.studentId?.message)}>
        {student ? (
          <div className="bg-muted/50 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
            <div className="flex flex-col">
              <span className="font-medium">{student.name}</span>
              <span className="text-muted-foreground text-xs">
                {student.phone && `${formatPhone(student.phone)} · `}
                {t("balance")}: <Money value={student.balance} />
              </span>
            </div>
            {!initial && (
              <Button type="button" variant="ghost" size="icon-xs" aria-label={tc("delete")} onClick={() => pick(undefined)}>
                <X className="size-4" />
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchStudent")} autoFocus />
            {shown.length > 0 && (
              <ul className="max-h-44 divide-y overflow-auto rounded-lg border">
                {shown.map((s) => (
                  <li key={s.id}>
                    <button type="button" className="hover:bg-muted flex w-full items-center justify-between px-3 py-2 text-left text-sm" onClick={() => pick(s)}>
                      <span>{s.name}</span>
                      <Money value={s.balance} className="text-xs" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Field>

      {student && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("group")} error={errText(errors.groupId?.message)}>
              <Controller
                control={control}
                name="groupId"
                render={({ field: f }) => (
                  <SimpleSelect
                    value={f.value || NONE}
                    onValueChange={(v) => f.onChange(v === NONE ? "" : v)}
                    options={[{ value: NONE, label: "—" }, ...student.groups.map((g) => ({ value: g.id, label: g.name }))]}
                  />
                )}
              />
            </Field>
            <Field label={t("method")}>
              <Controller
                control={control}
                name="method"
                render={({ field: f }) => <SimpleSelect value={f.value} onValueChange={f.onChange} options={PAYMENT_METHODS.map((m) => ({ value: m, label: te(m) }))} />}
              />
            </Field>
          </div>

          <Field label={t("amount")} error={errText(errors.amount?.message)}>
            <Input type="number" min={1} step={1000} inputMode="numeric" {...register("amount", { valueAsNumber: true })} />
            {student.balance < 0 && (
              <button type="button" className="text-primary w-fit text-xs hover:underline" onClick={() => setValue("amount", -student.balance, { shouldValidate: true })}>
                {t("payDebt", { amount: formatMoney(-student.balance) })}
              </button>
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("date")} error={errText(errors.date?.message)}>
              <Input type="date" max={today} {...register("date")} />
            </Field>
            <Field label={t("comment")}>
              <Input {...register("description")} />
            </Field>
          </div>
        </>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={pending || !student}>
          {tc("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
