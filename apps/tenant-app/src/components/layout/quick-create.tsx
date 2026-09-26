"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Banknote, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PaymentDialog } from "@/app/(app)/finance/payment-dialog";
import { loadQuickStudentLookups } from "@/app/(app)/students/actions";
import { StudentSheet } from "@/app/(app)/students/student-form";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Lookups = NonNullable<Awaited<ReturnType<typeof loadQuickStudentLookups>>>;

/**
 * Sarlavhadagi "+" tugmasi: istalgan sahifadan yangi talaba qo'shish yoki to'lov qabul qilish (modme kabi).
 * Talaba formasi uchun teg/guruhlar faqat ochilganda yuklanadi — har sahifa ochilishida qo'shimcha so'rov yo'q.
 */
export function QuickCreate({ canStudent, canPayment, today }: { canStudent: boolean; canPayment: boolean; today: string }) {
  const t = useTranslations("common");
  const ts = useTranslations("student");
  const tp = useTranslations("finance.payment");
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [studentOpen, setStudentOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [loading, startTransition] = useTransition();

  if (!canStudent && !canPayment) return null;

  const openStudent = () =>
    startTransition(async () => {
      const res = lookups ?? (await loadQuickStudentLookups());
      if (!res) {
        toast.error(t("forbidden"));
        return;
      }
      setLookups(res);
      setStudentOpen(true);
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="rounded-full" aria-label={t("create")} title={t("create")} disabled={loading} />}>
          <Plus className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canStudent && (
            <DropdownMenuItem onClick={openStudent}>
              <UserPlus /> {ts("new")}
            </DropdownMenuItem>
          )}
          {canPayment && (
            <DropdownMenuItem onClick={() => setPaymentOpen(true)}>
              <Banknote /> {tp("quick")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {lookups && <StudentSheet open={studentOpen} onOpenChange={setStudentOpen} lookups={lookups} />}
      {canPayment && <PaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} today={today} />}
    </>
  );
}
