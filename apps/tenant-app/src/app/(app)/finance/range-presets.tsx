"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useUrlState } from "@/components/data-table/use-url-state";

const shift = (iso: string, days: number) => new Date(new Date(`${iso}T00:00:00.000Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

/** Tayyor sana oraliqlari (bugun, 7/30 kun, bu oy, o'tgan oy). "today" serverdan keladi (markaz vaqti). */
export function RangePresets({ from, to, today }: { from: string; to: string; today: string }) {
  const t = useTranslations("finance.presets");
  const { update, pending } = useUrlState();

  const monthStart = `${today.slice(0, 7)}-01`;
  const prevMonthEnd = shift(monthStart, -1);
  const presets = [
    { key: "today", from: today, to: today },
    { key: "d7", from: shift(today, -6), to: today },
    { key: "d30", from: shift(today, -29), to: today },
    { key: "month", from: monthStart, to: today },
    { key: "prevMonth", from: `${prevMonthEnd.slice(0, 7)}-01`, to: prevMonthEnd },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("label")}>
      {presets.map((p) => {
        const active = p.from === from && p.to === to;
        return (
          <Button key={p.key} size="sm" variant={active ? "secondary" : "outline"} aria-pressed={active} disabled={pending} onClick={() => update({ from: p.from, to: p.to })}>
            {t(p.key as "today")}
          </Button>
        );
      })}
    </div>
  );
}
