"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type AnyColumnDef } from "@/components/data-table/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExpandableText } from "@/components/shared/expandable-text";
import { Money } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import { voidPayment } from "./actions";
import { PaymentDialog } from "./payment-dialog";
import type { PaymentRow } from "./queries";

type Props = {
  rows: PaymentRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: { key: string; dir: "asc" | "desc" };
  canVoid: boolean;
};

export function PaymentsTable({ rows, total, page, pageSize, sort, canVoid }: Props) {
  const t = useTranslations("finance.columns");
  const tf = useTranslations("finance");
  const te = useTranslations("enums");
  const tc = useTranslations("common");
  const router = useRouter();
  const [voiding, setVoiding] = useState<PaymentRow | null>(null);
  const [pending, startTransition] = useTransition();

  const columns = useMemo<AnyColumnDef<PaymentRow>[]>(
    () => [
      {
        id: "amount",
        header: t("amount"),
        meta: { sortKey: "amount", label: t("amount"), className: "text-right" },
        cell: ({ row }) => <Money value={row.original.amount} />,
      },
      {
        id: "student",
        header: t("student"),
        meta: { label: t("student") },
        cell: ({ row }) => (
          <Link href={`/students/${row.original.studentId}`} className="font-medium hover:underline">
            {row.original.studentName}
          </Link>
        ),
      },
      {
        id: "group",
        header: t("group"),
        meta: { label: t("group") },
        cell: ({ row }) => row.original.groupName ?? "—",
      },
      {
        id: "type",
        header: t("type"),
        meta: { label: t("type") },
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Badge variant={row.original.type === "SYSTEM" ? "outline" : "secondary"}>{te(`paymentType.${row.original.type}`)}</Badge>
            {row.original.type === "MANUAL" && <span className="text-muted-foreground text-xs">{te(`paymentMethod.${row.original.method as "CASH"}`)}</span>}
          </div>
        ),
      },
      { id: "teacher", header: t("teacher"), meta: { label: t("teacher") }, cell: ({ row }) => row.original.teacherName ?? "—" },
      {
        id: "comment",
        header: t("comment"),
        meta: { label: t("comment"), className: "max-w-56 whitespace-normal" },
        cell: ({ row }) => (row.original.type === "SYSTEM" && row.original.lessonDate ? tf("lessonCharge", { date: formatDate(row.original.lessonDate) }) : <ExpandableText text={row.original.description} />),
      },
      { id: "staff", header: t("staff"), meta: { label: t("staff") }, cell: ({ row }) => row.original.receivedByName ?? "—" },
      {
        id: "date",
        header: t("date"),
        meta: { sortKey: "date", label: t("date") },
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.date)}</span>,
      },
      {
        id: "actions",
        header: () => null,
        enableHiding: false,
        meta: { className: "w-10" },
        cell: ({ row }) =>
          row.original.type === "MANUAL" ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={tc("actions")} />}>
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem render={<a href={`/receipt/${row.original.id}?format=a4`} target="_blank" rel="noopener noreferrer" />}>
                  <Printer /> {tf("receiptA4")}
                </DropdownMenuItem>
                <DropdownMenuItem render={<a href={`/receipt/${row.original.id}?format=thermal`} target="_blank" rel="noopener noreferrer" />}>
                  <Printer /> {tf("receiptThermal")}
                </DropdownMenuItem>
                {canVoid && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setVoiding(row.original)}>
                      {tf("void")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null,
      },
    ],
    [t, tf, te, tc, canVoid],
  );

  const confirmVoid = () => {
    if (!voiding) return;
    startTransition(async () => {
      const res = await voidPayment(voiding.id);
      setVoiding(null);
      if (res.ok) {
        toast.success(tf("voided"));
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });
  };

  return (
    <>
      <DataTable columns={columns} data={rows} total={total} page={page} pageSize={pageSize} sort={sort} getRowId={(r) => r.id} storageKey="payments" />
      <ConfirmDialog
        open={!!voiding}
        onOpenChange={(o) => !o && setVoiding(null)}
        title={tf("voidTitle")}
        description={tf("voidHint")}
        confirmLabel={tf("void")}
        destructive
        pending={pending}
        onConfirm={confirmVoid}
      />
    </>
  );
}

export function NewPaymentButton({ today }: { today: string }) {
  const t = useTranslations("finance.payment");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t("title")}
      </Button>
      <PaymentDialog open={open} onOpenChange={setOpen} today={today} />
    </>
  );
}
