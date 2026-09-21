import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PAYMENT_METHODS } from "@markazai/types";
import { FilterBar, type FilterField } from "@/components/data-table/filter-bar";
import { can } from "@/lib/permissions";
import { param } from "@/lib/search-params";
import { requireModule, type SessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { FinanceChart } from "./finance-chart";
import { NewPaymentButton, PaymentsTable } from "./payments-table";
import { FINANCE_TABS, PAGE_SIZE, listPayments, loadPaymentLookups, loadSummary, loadTrend, resolveRange, type FinanceTab } from "./queries";
import { RangePresets } from "./range-presets";
import { SummaryCards } from "./summary-cards";
import type { RawSearchParams } from "@/lib/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("finance") };
}

export default async function FinancePage({ searchParams }: PageProps<"/finance">) {
  const user = await requireModule("finance");
  const sp = await searchParams;
  const t = await getTranslations("finance");
  const requested = param(sp, "tab");
  const tab: FinanceTab = (FINANCE_TABS as readonly string[]).includes(requested ?? "") ? (requested as FinanceTab) : "payments";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <nav className="bg-muted inline-flex w-fit flex-wrap gap-1 rounded-lg p-1" aria-label={t("title")}>
        {FINANCE_TABS.map((k) => (
          <Link
            key={k}
            href={`/finance?tab=${k}`}
            aria-current={k === tab ? "page" : undefined}
            className={cn("text-muted-foreground hover:text-foreground rounded-md px-3 py-1 text-sm transition-colors", k === tab && "bg-background text-foreground shadow-xs")}
          >
            {t(`tabs.${k}`)}
          </Link>
        ))}
      </nav>

      {tab === "payments" ? <PaymentsSection user={user} sp={sp} /> : <p className="text-muted-foreground py-10 text-center text-sm">{t("comingSoon")}</p>}
    </div>
  );
}

async function PaymentsSection({ user, sp }: { user: SessionUser; sp: RawSearchParams }) {
  const t = await getTranslations("finance");
  const te = await getTranslations("enums");
  const range = resolveRange(sp);

  const [summary, trend, list, lookups] = await Promise.all([loadSummary(user, range), loadTrend(user, range), listPayments(user, sp, range), loadPaymentLookups(user)]);

  const fields: FilterField[] = [
    { name: "from", label: t("from"), type: "date" },
    { name: "to", label: t("to"), type: "date" },
    { name: "groupId", label: t("columns.group"), type: "select", options: lookups.groups.map((g) => ({ value: g.id, label: g.name })) },
    { name: "teacherId", label: t("columns.teacher"), type: "select", options: lookups.teachers.map((x) => ({ value: x.id, label: x.name })) },
    { name: "type", label: t("columns.type"), type: "select", options: (["SYSTEM", "MANUAL"] as const).map((v) => ({ value: v, label: te(`paymentType.${v}`) })) },
    { name: "method", label: t("payment.method"), type: "select", options: PAYMENT_METHODS.map((m) => ({ value: m, label: te(`paymentMethod.${m}`) })) },
    { name: "min", label: t("minAmount"), type: "text" },
    { name: "max", label: t("maxAmount"), type: "text" },
  ];

  return (
    <>
      <RangePresets from={range.from} to={range.to} today={range.today} />
      <SummaryCards summary={summary} />
      <FinanceChart granularity={trend.granularity} points={trend.points} />
      <FilterBar searchPlaceholder={t("searchPlaceholder")} fields={fields} actions={can(user.roles, "payments:write") ? <NewPaymentButton today={range.today} /> : null} />
      <PaymentsTable rows={list.rows} total={list.total} page={list.page} pageSize={PAGE_SIZE} sort={list.sort} canVoid={can(user.roles, "payments:void")} />
    </>
  );
}
