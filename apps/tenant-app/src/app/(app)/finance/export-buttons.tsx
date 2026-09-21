"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Eksport: Excel — joriy filtrlar bilan serverdan .xlsx; PDF — brauzerning chop etish oynasi ("PDF sifatida saqlash").
 * Yon panel va header chop etishda yashiriladi.
 */
export function ExportButtons({ tab }: { tab: string }) {
  const t = useTranslations("finance.export");
  const searchParams = useSearchParams();
  const qs = new URLSearchParams(searchParams.toString());
  qs.set("tab", tab);
  qs.delete("page");

  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/finance/export?${qs.toString()}`} download />}>
        <FileSpreadsheet className="size-4" />
        {t("excel")}
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="size-4" />
        {t("pdf")}
      </Button>
    </div>
  );
}
