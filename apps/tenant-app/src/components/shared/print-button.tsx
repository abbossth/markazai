"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Brauzerning chop etish oynasini ochadi (yon panel va header chop etilmaydi). */
export function PrintButton() {
  const t = useTranslations("common");
  return (
    <Button variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
      <Printer className="size-4" />
      {t("print")}
    </Button>
  );
}
