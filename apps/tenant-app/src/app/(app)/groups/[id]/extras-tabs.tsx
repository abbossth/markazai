"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  discountSchema,
  examSchema,
  onlineLessonSchema,
  toISODate,
  type DiscountInput,
  type ExamInput,
  type OnlineLessonInput,
} from "@markazai/types";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money } from "@/components/shared/money";
import { formatDate, formatMoney } from "@/lib/format";
import { addDiscount, addExam, addOnlineLesson, deleteDiscount, deleteExam, deleteOnlineLesson } from "./actions";

type ActionRes = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

/** Barcha modal formalar uchun umumiy: xato xabarlarini tarjima qiladi va saqlashdan keyin yangilaydi. */
function useSubmit<T>(run: (values: T) => Promise<ActionRes>, onSuccess: () => void, setFieldError: (name: never, message: string) => void) {
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const submit = (values: T) =>
    startTransition(async () => {
      const res = await run(values);
      if (res.ok) {
        toast.success(tc("saved"));
        onSuccess();
        router.refresh();
      } else if (res.fieldErrors) {
        for (const [name, message] of Object.entries(res.fieldErrors)) setFieldError(name as never, message);
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });
  return { submit, pending };
}

function useDelete(run: () => Promise<ActionRes>) {
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const confirm = () =>
    startTransition(async () => {
      const res = await run();
      setConfirming(false);
      if (res.ok) {
        toast.success(tc("deleted"));
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });
  return { confirming, setConfirming, confirm, pending };
}

function DeleteButton({ onDelete, title }: { onDelete: () => Promise<ActionRes>; title: string }) {
  const tc = useTranslations("common");
  const { confirming, setConfirming, confirm, pending } = useDelete(onDelete);
  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={tc("delete")} onClick={() => setConfirming(true)}>
        <Trash2 className="size-4" />
      </Button>
      <ConfirmDialog open={confirming} onOpenChange={setConfirming} title={title} description={tc("confirmDelete")} confirmLabel={tc("delete")} destructive pending={pending} onConfirm={confirm} />
    </>
  );
}

function useErr() {
  const tv = useTranslations("validation");
  return (msg?: string) => (msg ? (tv.has(msg as "required") ? tv(msg as "required") : tv("invalid")) : undefined);
}

// ───────────── Onlayn darslar va materiallar ─────────────

export type OnlineLessonItem = { id: string; title: string; url: string };

export function OnlineLessonsTab({ groupId, items, canWrite }: { groupId: string; items: OnlineLessonItem[]; canWrite: boolean }) {
  const t = useTranslations("group.online");
  const tc = useTranslations("common");
  const err = useErr();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<OnlineLessonInput>({ resolver: zodResolver(onlineLessonSchema), defaultValues: { title: "", url: "" } });
  const { submit, pending } = useSubmit((v: OnlineLessonInput) => addOnlineLesson(groupId, v), () => { setOpen(false); reset(); }, (n, m) => setError(n, { message: m }));

  return (
    <div className="flex flex-col gap-4">
      {canWrite && (
        <Button className="w-fit" size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      )}
      {items.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="bg-card max-w-2xl divide-y rounded-lg border">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-2 px-4 py-2.5">
              <a href={i.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-2 text-sm hover:underline">
                <ExternalLink className="text-muted-foreground size-4 shrink-0" />
                <span className="truncate font-medium">{i.title}</span>
              </a>
              {canWrite && <DeleteButton title={i.title} onDelete={() => deleteOnlineLesson(groupId, i.id)} />}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>{t("add")}</DialogTitle>
            </DialogHeader>
            <Field label={t("title")} error={err(errors.title?.message)}>
              <Input {...register("title")} autoFocus />
            </Field>
            <Field label={t("url")} error={err(errors.url?.message)}>
              <Input type="url" placeholder="https://" {...register("url")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
              <Button type="submit" disabled={pending}>{tc("save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ───────────── Chegirmali narx ─────────────

export type DiscountItem = { id: string; studentName: string; amount: number; fromDate: string; toDate: string | null; reason: string | null };

export function DiscountsTab({ groupId, groupPrice, items, members, canWrite }: { groupId: string; groupPrice: number; items: DiscountItem[]; members: { id: string; name: string }[]; canWrite: boolean }) {
  const t = useTranslations("group.discounts");
  const tc = useTranslations("common");
  const err = useErr();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, setError, setValue, watch, formState: { errors } } = useForm<DiscountInput>({
    resolver: zodResolver(discountSchema),
    defaultValues: { studentId: "", amount: 0, fromDate: toISODate(new Date()), toDate: "", reason: "" },
  });
  const { submit, pending } = useSubmit((v: DiscountInput) => addDiscount(groupId, v), () => { setOpen(false); reset(); }, (n, m) => setError(n, { message: m }));
  const amount = Number(watch("amount")) || 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{t("basePrice")}: <span className="text-foreground font-medium">{formatMoney(groupPrice)}</span></p>
      {canWrite && members.length > 0 && (
        <Button className="w-fit" size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      )}
      {items.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("student")}</TableHead>
                <TableHead className="text-right">{t("discount")}</TableHead>
                <TableHead className="text-right">{t("finalPrice")}</TableHead>
                <TableHead>{t("period")}</TableHead>
                <TableHead>{t("reason")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.studentName}</TableCell>
                  <TableCell className="text-right"><Money value={-d.amount} /></TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(groupPrice - d.amount)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(d.fromDate)} – {formatDate(d.toDate)}</TableCell>
                  <TableCell>{d.reason ?? "—"}</TableCell>
                  <TableCell>{canWrite && <DeleteButton title={d.studentName} onDelete={() => deleteDiscount(groupId, d.id)} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>{t("add")}</DialogTitle>
            </DialogHeader>
            <Field label={t("student")} error={err(errors.studentId?.message)}>
              <SimpleSelect value={watch("studentId")} onValueChange={(v) => setValue("studentId", v, { shouldValidate: true })} placeholder={t("selectStudent")} options={members.map((m) => ({ value: m.id, label: m.name }))} />
            </Field>
            <Field label={t("discount")} error={err(errors.amount?.message)}>
              <Input type="number" min={1} step={1000} {...register("amount", { valueAsNumber: true })} />
            </Field>
            <p className="text-muted-foreground -mt-2 text-xs">{t("finalPrice")}: {formatMoney(Math.max(0, groupPrice - amount))}</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("from")} error={err(errors.fromDate?.message)}><Input type="date" {...register("fromDate")} /></Field>
              <Field label={t("to")} error={err(errors.toDate?.message)}><Input type="date" {...register("toDate")} /></Field>
            </div>
            <Field label={t("reason")}><Input {...register("reason")} /></Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
              <Button type="submit" disabled={pending}>{tc("save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ───────────── Imtihonlar ─────────────

export type ExamItem = { id: string; name: string; date: string; durationMinutes: number; maxScore: number; passScore: number; fileUrl: string | null };

export function ExamsTab({ groupId, items, canWrite }: { groupId: string; items: ExamItem[]; canWrite: boolean }) {
  const t = useTranslations("group.exams");
  const tc = useTranslations("common");
  const err = useErr();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<ExamInput>({
    resolver: zodResolver(examSchema),
    defaultValues: { name: "", date: toISODate(new Date()), durationMinutes: 60, maxScore: 100, passScore: 60, fileUrl: "" },
  });
  const { submit, pending } = useSubmit((v: ExamInput) => addExam(groupId, v), () => { setOpen(false); reset(); }, (n, m) => setError(n, { message: m }));

  return (
    <div className="flex flex-col gap-4">
      {canWrite && (
        <Button className="w-fit" size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      )}
      {items.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("duration")}</TableHead>
                <TableHead className="text-right">{t("maxScore")}</TableHead>
                <TableHead className="text-right">{t("passScore")}</TableHead>
                <TableHead>{t("file")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell>{formatDate(e.date)}</TableCell>
                  <TableCell>{t("minutes", { count: e.durationMinutes })}</TableCell>
                  <TableCell className="text-right tabular-nums">{e.maxScore}</TableCell>
                  <TableCell className="text-right tabular-nums">{e.passScore}</TableCell>
                  <TableCell>
                    {e.fileUrl ? (
                      <a href={e.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                        <ExternalLink className="size-3.5" /> {t("open")}
                      </a>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{canWrite && <DeleteButton title={e.name} onDelete={() => deleteExam(groupId, e.id)} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>{t("add")}</DialogTitle>
            </DialogHeader>
            <Field label={t("name")} error={err(errors.name?.message)}><Input {...register("name")} autoFocus /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("date")} error={err(errors.date?.message)}><Input type="date" {...register("date")} /></Field>
              <Field label={t("durationMinutes")} error={err(errors.durationMinutes?.message)}><Input type="number" min={5} {...register("durationMinutes", { valueAsNumber: true })} /></Field>
              <Field label={t("maxScore")} error={err(errors.maxScore?.message)}><Input type="number" min={1} {...register("maxScore", { valueAsNumber: true })} /></Field>
              <Field label={t("passScore")} error={err(errors.passScore?.message)}><Input type="number" min={0} {...register("passScore", { valueAsNumber: true })} /></Field>
            </div>
            <Field label={t("fileUrl")} error={err(errors.fileUrl?.message)}><Input type="url" placeholder="https://" {...register("fileUrl")} /></Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
              <Button type="submit" disabled={pending}>{tc("save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
