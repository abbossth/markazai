"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftPeriod } from "@markazai/types";
import { Button } from "@/components/ui/button";

/** Oy tanlagich (`?month=YYYY-MM`): boshqa query parametrlar saqlanadi; `params` — majburan qo'yiladiganlar (masalan, tab). */
export function MonthNav({ period, params }: { period: string; params?: Record<string, string> }) {
  const tm = useTranslations("enums.months");
  const t = useTranslations("attendance");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const href = (month: string) => {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("month", month);
    for (const [k, v] of Object.entries(params ?? {})) qs.set(k, v);
    return `${pathname}?${qs.toString()}`;
  };
  const label = `${tm(String(Number(period.slice(5, 7))) as "1")} ${period.slice(0, 4)}`;

  return (
    <div className="flex items-center gap-1 print:hidden">
      <Button variant="ghost" size="icon-sm" aria-label={t("prevMonth")} nativeButton={false} render={<Link href={href(shiftPeriod(period, -1))} scroll={false} />}>
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-36 text-center text-sm font-medium">{label}</span>
      <Button variant="ghost" size="icon-sm" aria-label={t("nextMonth")} nativeButton={false} render={<Link href={href(shiftPeriod(period, 1))} scroll={false} />}>
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
