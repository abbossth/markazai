"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { expenseSchema, withdrawalSchema, type ExpenseInput, type WithdrawalInput } from "@markazai/types";
import { DataTable, type AnyColumnDef } from "@/components/data-table/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExpandableText } from "@/components/shared/expandable-text";
import { Field } from "@/components/shared/form-field";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate, formatPhone } from "@/lib/format";
import { createWithdrawal, deleteExpense, deleteWithdrawal, saveExpense } from "./actions";
import { PaymentDialog } from "./payment-dialog";
import type { DebtorRow, ExpenseRow, WithdrawalRow } from "./queries";

type TableProps<R> = { rows: R[]; total: number; page: number; pageSize: number; sort?: { key: string; dir: "asc" | "desc" } };

function useErrText() {
  const tv = useTranslations("validation");
  return (msg?: string) => (msg ? (tv.has(msg as "required") ? tv(msg as "required") : tv("invalid")) : undefined);
}

/** O'chirish tugmasi + tasdiqlash dialogi (jadval qatorlari uchun umumiy). */
function RowDelete({ title, onDelete }: { title: string; onDelete: () => Promise<{ ok: boolean; error?: string }> }) {
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={tc("delete")} onClick={() => setOpen(true)}>
        <Trash2 className="size-4" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={tc("confirmDelete")}
        confirmLabel={tc("delete")}
        destructive
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const res = await onDelete();
            setOpen(false);
            if (res.ok) {
              toast.success(tc("deleted"));
              router.refresh();
            } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
          })
        }
      />
    </>
  );
}

// ───────────── Xarajatlar ─────────────

export function ExpensesTable({ rows, total, page, pageSize, sort, categories, today, canWrite }: TableProps<ExpenseRow> & { categories: string[]; today: string; canWrite: boolean }) {
  const t = useTranslations("finance.ledger");
  const tc = useTranslations("common");
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

  const columns = useMemo<AnyColumnDef<ExpenseRow>[]>(
    () => [
      { id: "category", header: t("category"), meta: { label: t("category") }, cell: ({ row }) => <span className="font-medium">{row.original.category}</span> },
      { id: "amount", header: t("amount"), meta: { sortKey: "amount", label: t("amount"), className: "text-right" }, cell: ({ row }) => <Money value={-row.original.amount} /> },
      { id: "comment", header: t("comment"), meta: { label: t("comment"), className: "max-w-72 whitespace-normal" }, cell: ({ row }) => <ExpandableText text={row.original.description} /> },
      { id: "staff", header: t("staff"), meta: { label: t("staff") }, cell: ({ row }) => row.original.createdByName ?? "—" },
      { id: "date", header: t("date"), meta: { sortKey: "date", label: t("date") }, cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.date)}</span> },
      {
        id: "actions",
        header: () => null,
        enableHiding: false,
        meta: { className: "w-24" },
        cell: ({ row }) =>
          canWrite ? (
            <div className="flex">
              <Button variant="ghost" size="icon-sm" aria-label={tc("edit")} onClick={() => setEditing(row.original)}>
                <Pencil className="size-4" />
              </Button>
              <RowDelete title={t("deleteExpense", { category: row.original.category })} onDelete={() => deleteExpense(row.original.id)} />
            </div>
          ) : null,
      },
    ],
    [t, tc, canWrite],
  );

  return (
    <>
      <DataTable columns={columns} data={rows} total={total} page={page} pageSize={pageSize} sort={sort} getRowId={(r) => r.id} storageKey="expenses" />
      {editing && <ExpenseDialog open onOpenChange={(o) => !o && setEditing(null)} expense={editing} categories={categories} today={today} />}
    </>
  );
}

export function NewExpenseButton({ categories, today }: { categories: string[]; today: string }) {
  const t = useTranslations("finance.ledger");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t("addExpense")}
      </Button>
      {open && <ExpenseDialog open onOpenChange={setOpen} categories={categories} today={today} />}
    </>
  );
}

function ExpenseDialog({ open, onOpenChange, expense, categories, today }: { open: boolean; onOpenChange: (o: boolean) => void; expense?: ExpenseRow; categories: string[]; today: string }) {
  const t = useTranslations("finance.ledger");
  const tc = useTranslations("common");
  const err = useErrText();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, setError, formState: { errors } } = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: expense?.category ?? "",
      amount: (expense?.amount ?? undefined) as unknown as number,
      date: expense ? expense.date.slice(0, 10) : today,
      description: expense?.description ?? "",
    },
  });

  const submit = (values: ExpenseInput) =>
    startTransition(async () => {
      const res = await saveExpense(expense?.id ?? null, values);
      if (res.ok) {
        toast.success(tc("saved"));
        onOpenChange(false);
        router.refresh();
      } else if (res.fieldErrors) {
        for (const [name, message] of Object.entries(res.fieldErrors)) setError(name as keyof ExpenseInput, { message });
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{expense ? t("editExpense") : t("addExpense")}</DialogTitle>
          </DialogHeader>
          <Field label={t("category")} error={err(errors.category?.message)}>
            <Input list="expense-categories" {...register("category")} autoFocus />
            <datalist id="expense-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("amount")} error={err(errors.amount?.message)}>
              <Input type="number" min={1} step={1000} inputMode="numeric" {...register("amount", { valueAsNumber: true })} />
            </Field>
            <Field label={t("date")} error={err(errors.date?.message)}>
              <Input type="date" max={today} {...register("date")} />
            </Field>
          </div>
          <Field label={t("comment")}>
            <Input {...register("description")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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

// ───────────── Yechib olish ─────────────

export function WithdrawalsTable({ rows, total, page, pageSize, sort, canWrite }: TableProps<WithdrawalRow> & { canWrite: boolean }) {
  const t = useTranslations("finance.ledger");

  const columns = useMemo<AnyColumnDef<WithdrawalRow>[]>(
    () => [
      { id: "amount", header: t("amount"), meta: { sortKey: "amount", label: t("amount"), className: "text-right" }, cell: ({ row }) => <Money value={-row.original.amount} /> },
      { id: "note", header: t("comment"), meta: { label: t("comment"), className: "max-w-72 whitespace-normal" }, cell: ({ row }) => <ExpandableText text={row.original.note} /> },
      { id: "staff", header: t("staff"), meta: { label: t("staff") }, cell: ({ row }) => row.original.createdByName ?? "—" },
      { id: "date", header: t("date"), meta: { sortKey: "date", label: t("date") }, cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.date)}</span> },
      {
        id: "actions",
        header: () => null,
        enableHiding: false,
        meta: { className: "w-12" },
        cell: ({ row }) => (canWrite ? <RowDelete title={t("deleteWithdrawal")} onDelete={() => deleteWithdrawal(row.original.id)} /> : null),
      },
    ],
    [t, canWrite],
  );

  return <DataTable columns={columns} data={rows} total={total} page={page} pageSize={pageSize} sort={sort} getRowId={(r) => r.id} storageKey="withdrawals" />;
}

export function NewWithdrawalButton({ today }: { today: string }) {
  const t = useTranslations("finance.ledger");
  const tc = useTranslations("common");
  const err = useErrText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<WithdrawalInput>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: { amount: undefined as unknown as number, date: today, note: "" },
  });

  const submit = (values: WithdrawalInput) =>
    startTransition(async () => {
      const res = await createWithdrawal(values);
      if (res.ok) {
        toast.success(tc("saved"));
        setOpen(false);
        reset();
        router.refresh();
      } else if (res.fieldErrors) {
        for (const [name, message] of Object.entries(res.fieldErrors)) setError(name as keyof WithdrawalInput, { message });
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t("addWithdrawal")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>{t("addWithdrawal")}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("amount")} error={err(errors.amount?.message)}>
                <Input type="number" min={1} step={1000} inputMode="numeric" {...register("amount", { valueAsNumber: true })} autoFocus />
              </Field>
              <Field label={t("date")} error={err(errors.date?.message)}>
                <Input type="date" max={today} {...register("date")} />
              </Field>
            </div>
            <Field label={t("comment")}>
              <Input {...register("note")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ───────────── Qarzdorlar ─────────────

export function DebtorsTable({ rows, total, page, pageSize, today, canPay }: TableProps<DebtorRow> & { today: string; canPay: boolean }) {
  const t = useTranslations("finance.ledger");
  const [paying, setPaying] = useState<DebtorRow | null>(null);

  const columns = useMemo<AnyColumnDef<DebtorRow>[]>(
    () => [
      {
        id: "student",
        header: t("student"),
        meta: { label: t("student") },
        cell: ({ row }) => (
          <Link href={`/students/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      { id: "phone", header: t("phone"), meta: { label: t("phone") }, cell: ({ row }) => <span className="whitespace-nowrap">{formatPhone(row.original.phone)}</span> },
      {
        id: "groups",
        header: t("group"),
        meta: { label: t("group") },
        cell: ({ row }) => (row.original.groups.length ? row.original.groups.map((g) => g.name).join(", ") : "—"),
      },
      { id: "balance", header: t("debt"), meta: { label: t("debt"), className: "text-right" }, cell: ({ row }) => <Money value={row.original.balance} /> },
      { id: "last", header: t("lastPayment"), meta: { label: t("lastPayment") }, cell: ({ row }) => (row.original.lastPaymentDate ? formatDate(row.original.lastPaymentDate) : t("never")) },
      {
        id: "actions",
        header: () => null,
        enableHiding: false,
        meta: { className: "w-32" },
        cell: ({ row }) =>
          canPay ? (
            <Button size="sm" variant="outline" onClick={() => setPaying(row.original)}>
              <Wallet className="size-4" />
              {t("pay")}
            </Button>
          ) : null,
      },
    ],
    [t, canPay],
  );

  return (
    <>
      <DataTable columns={columns} data={rows} total={total} page={page} pageSize={pageSize} getRowId={(r) => r.id} storageKey="debtors" />
      {paying && (
        <PaymentDialog
          open
          onOpenChange={(o) => !o && setPaying(null)}
          today={today}
          student={{ id: paying.id, name: paying.name, phone: paying.phone, balance: paying.balance, groups: paying.groups }}
        />
      )}
    </>
  );
}
