"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markReceiptPrinted } from "@/app/(app)/finance/actions";

/** Chop etish tugmasi: avval "chop etilgan" deb belgilanadi, keyin brauzer chop etish oynasi ochiladi. */
export function ReceiptActions({ paymentId }: { paymentId: string }) {
  const t = useTranslations("finance");
  const [pending, startTransition] = useTransition();

  return (
    <div className="mb-4 flex justify-end gap-2 print:hidden">
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await markReceiptPrinted(paymentId);
            window.print();
          })
        }
      >
        <Printer className="size-4" />
        {t("print")}
      </Button>
    </div>
  );
}
