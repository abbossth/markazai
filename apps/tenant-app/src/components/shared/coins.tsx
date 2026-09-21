"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Coins, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { coinAwardSchema, type CoinAwardInput } from "@markazai/types";
import { awardCoins } from "@/app/(app)/coins/actions";
import { Field } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CoinEntry = { id: string; amount: number; kind: "ATTENDANCE" | "MANUAL"; reason: string | null; date: string; groupName: string | null };

/** Coin berish/ayirish dialogi (musbat — berish, manfiy — ayirish). `groupId` — guruh doirasida berilganda. */
export function AwardCoinsDialog({ studentId, studentName, groupId, onClose }: { studentId: string; studentName: string; groupId?: string; onClose: () => void }) {
  const t = useTranslations("coins");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, setError, setValue, getValues, formState: { errors } } = useForm<CoinAwardInput>({
    resolver: zodResolver(coinAwardSchema),
    defaultValues: { amount: 1, reason: "", groupId },
  });
  const err = (m?: string) => (m ? (tv.has(m as "required") ? tv(m as "required") : t.has(`errors.${m}` as "errors.coinsBelowZero") ? t(`errors.${m}` as "errors.coinsBelowZero") : tv("invalid")) : undefined);

  const submit = (v: CoinAwardInput) =>
    startTransition(async () => {
      const res = await awardCoins(studentId, v);
      if (res.ok) {
        toast.success(tc("saved"));
        onClose();
        router.refresh();
      } else if (res.fieldErrors) {
        for (const [n, m] of Object.entries(res.fieldErrors)) setError(n as keyof CoinAwardInput, { message: m });
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t("awardTitle", { name: studentName })}</DialogTitle>
          </DialogHeader>
          <Field label={t("amount")} error={err(errors.amount?.message)}>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" aria-label="−" onClick={() => setValue("amount", -Math.abs(Number(getValues("amount")) || 1))}>
                <Minus className="size-4" />
              </Button>
              <Input type="number" step={1} inputMode="numeric" className="w-28" {...register("amount", { valueAsNumber: true })} />
              <Button type="button" variant="outline" size="icon" aria-label="+" onClick={() => setValue("amount", Math.abs(Number(getValues("amount")) || 1))}>
                <Plus className="size-4" />
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">{t("amountHint")}</p>
          </Field>
          <Field label={t("reason")} error={err(errors.reason?.message)}>
            <Input placeholder={t("reasonPlaceholder")} {...register("reason")} autoFocus />
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

/** Talaba profilidagi coin bloki: jami, tarix ro'yxati va (huquq bo'lsa) "Coin berish". */
export function StudentCoins({ studentId, studentName, total, history, canAward }: { studentId: string; studentName: string; total: number; history: CoinEntry[]; canAward: boolean }) {
  const t = useTranslations("coins");
  const [open, setOpen] = useState(false);
  const [awarding, setAwarding] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-left print:hidden" aria-label={t("history")}>
        <div className="text-muted-foreground text-xs">{t("title")}</div>
        <div className="flex items-center justify-end gap-1 text-2xl font-medium tabular-nums">
          <Coins className="size-5 text-amber-500" aria-hidden />
          {total}
        </div>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("historyTitle", { name: studentName, total })}</DialogTitle>
          </DialogHeader>
          {history.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">{t("empty")}</p>
          ) : (
            <ul className="divide-y text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex items-baseline gap-3 py-2">
                  <span className={cn("w-12 shrink-0 text-right font-semibold tabular-nums", h.amount < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{h.amount > 0 ? `+${h.amount}` : h.amount}</span>
                  <span className="flex-1">
                    {h.kind === "ATTENDANCE" ? t("forLesson", { date: formatDate(h.date) }) : h.reason}
                    {h.groupName && <span className="text-muted-foreground"> · {h.groupName}</span>}
                  </span>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">{formatDate(h.date)}</span>
                </li>
              ))}
            </ul>
          )}
          {canAward && (
            <DialogFooter>
              <Button onClick={() => setAwarding(true)}>
                <Coins className="size-4" />
                {t("award")}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      {awarding && <AwardCoinsDialog studentId={studentId} studentName={studentName} onClose={() => setAwarding(false)} />}
    </>
  );
}
