import { getTranslations } from "next-intl/server";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Summary } from "./queries";

/** Ko'rsatkich kartochkalari. Qiymat — asosiy ohang, yorliq — ikkinchi darajali; qizil faqat salbiy holatni bildiradi. */
export async function SummaryCards({ summary }: { summary: Summary }) {
  const t = await getTranslations("finance");
  const cards: { label: string; value: number; hint?: string; bad?: boolean }[] = [
    { label: t("revenue"), value: summary.revenue },
    { label: t("accrued"), value: summary.accrued, hint: t("accruedHint") },
    { label: t("expenses"), value: summary.expenses },
    { label: t("profit"), value: summary.profit, bad: summary.profit < 0 },
    { label: t("withdrawals"), value: summary.withdrawals },
    { label: t("cashOnHand"), value: summary.cashOnHand, bad: summary.cashOnHand < 0 },
    { label: t("totalDebt"), value: summary.totalDebt, hint: t("debtorsCount", { count: summary.debtors }), bad: summary.totalDebt > 0 },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      {cards.map((c) => (
        <div key={c.label} className="bg-card flex flex-col gap-1 rounded-lg border p-3">
          <dt className="text-muted-foreground text-xs">{c.label}</dt>
          <dd className={cn("text-lg font-semibold tabular-nums", c.bad && "text-rose-600 dark:text-rose-400")}>{formatMoney(c.value)}</dd>
          {c.hint && <span className="text-muted-foreground text-xs">{c.hint}</span>}
        </div>
      ))}
    </dl>
  );
}
