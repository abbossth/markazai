import { getTranslations } from "next-intl/server";
import { isPeriod } from "@markazai/types";
import { prisma } from "@markazai/db";
import { MonthNav } from "@/components/shared/month-nav";
import { loadPayrolls } from "@/lib/payroll";
import { SalaryTable } from "./salary-table";
import { FilterBar, type FilterField } from "@/components/data-table/filter-bar";
import { can } from "@/lib/permissions";
import type { RawSearchParams } from "@/lib/search-params";
import type { SessionUser } from "@/lib/session";
import { formatMoney } from "@/lib/format";
import { ExportButtons } from "./export-buttons";
import { DebtorsTable, ExpensesTable, NewExpenseButton, NewWithdrawalButton, WithdrawalsTable } from "./ledger-tables";
import { PAGE_SIZE, listDebtors, listExpenses, listWithdrawals, loadExpenseCategories, loadPaymentLookups, resolveRange } from "./queries";
import { RangePresets } from "./range-presets";

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card flex w-fit items-baseline gap-3 rounded-lg border px-4 py-2">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{formatMoney(value)}</span>
    </div>
  );
}

export async function ExpensesSection({ user, sp }: { user: SessionUser; sp: RawSearchParams }) {
  const t = await getTranslations("finance");
  const range = resolveRange(sp);
  const [list, categories] = await Promise.all([listExpenses(user, sp, range), loadExpenseCategories(user)]);

  const fields: FilterField[] = [
    { name: "from", label: t("from"), type: "date" },
    { name: "to", label: t("to"), type: "date" },
    { name: "category", label: t("ledger.category"), type: "select", options: categories.map((c) => ({ value: c, label: c })) },
  ];
  const canWrite = can(user.roles, "expenses:write");

  return (
    <>
      <RangePresets from={range.from} to={range.to} today={range.today} />
      <Total label={t("ledger.totalExpenses")} value={list.sum} />
      <FilterBar
        searchPlaceholder={t("ledger.searchExpense")}
        fields={fields}
        actions={
          <>
            <ExportButtons tab="expenses" />
            {canWrite && <NewExpenseButton categories={categories} today={range.today} />}
          </>
        }
      />
      <ExpensesTable rows={list.rows} total={list.total} page={list.page} pageSize={PAGE_SIZE} sort={list.sort} categories={categories} today={range.today} canWrite={canWrite} />
    </>
  );
}

export async function WithdrawalsSection({ user, sp }: { user: SessionUser; sp: RawSearchParams }) {
  const t = await getTranslations("finance");
  const range = resolveRange(sp);
  const list = await listWithdrawals(user, sp, range);
  const fields: FilterField[] = [
    { name: "from", label: t("from"), type: "date" },
    { name: "to", label: t("to"), type: "date" },
  ];
  const canWrite = can(user.roles, "withdrawals:write");

  return (
    <>
      <RangePresets from={range.from} to={range.to} today={range.today} />
      <Total label={t("ledger.totalWithdrawals")} value={list.sum} />
      <FilterBar
        searchPlaceholder={t("ledger.searchNote")}
        fields={fields}
        actions={
          <>
            <ExportButtons tab="withdrawals" />
            {canWrite && <NewWithdrawalButton today={range.today} />}
          </>
        }
      />
      <WithdrawalsTable rows={list.rows} total={list.total} page={list.page} pageSize={PAGE_SIZE} sort={list.sort} canWrite={canWrite} />
    </>
  );
}

export async function DebtorsSection({ user, sp }: { user: SessionUser; sp: RawSearchParams }) {
  const t = await getTranslations("finance");
  const range = resolveRange(sp);
  const [list, lookups] = await Promise.all([listDebtors(user, sp), loadPaymentLookups(user)]);
  const fields: FilterField[] = [{ name: "groupId", label: t("columns.group"), type: "select", options: lookups.groups.map((g) => ({ value: g.id, label: g.name })) }];

  return (
    <>
      <Total label={t("ledger.totalDebt", { count: list.total })} value={list.totalDebt} />
      <FilterBar searchPlaceholder={t("searchPlaceholder")} fields={fields} actions={<ExportButtons tab="debtors" />} />
      <DebtorsTable rows={list.rows} total={list.total} page={list.page} pageSize={PAGE_SIZE} today={range.today} canPay={can(user.roles, "payments:write")} />
    </>
  );
}

export async function SalarySection({ user, sp }: { user: SessionUser; sp: RawSearchParams }) {
  const t = await getTranslations("finance.salary");
  const today = resolveRange(sp).today;
  const monthParam = Array.isArray(sp.month) ? sp.month[0] : sp.month;
  const period = isPeriod(monthParam) ? monthParam : today.slice(0, 7);

  const [payrolls, payments] = await Promise.all([
    loadPayrolls(user.orgId, period),
    prisma.salaryPayment.findMany({ where: { organizationId: user.orgId, period }, orderBy: { date: "desc" }, include: { teacher: { select: { name: true } } } }),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNav period={period} params={{ tab: "salary" }} />
        <p className="text-muted-foreground max-w-xl text-xs">{t("hint")}</p>
      </div>
      <SalaryTable
        period={period}
        today={today}
        canPay={can(user.roles, "salary:pay")}
        rows={payrolls.map((p) => ({ teacherId: p.teacherId, name: p.name, model: p.salaryType, percent: p.percent, calculated: p.payroll.total, paid: p.paid, remaining: p.remaining }))}
        payments={payments.map((p) => ({ id: p.id, teacherName: p.teacher.name, amount: p.amount, date: p.date.toISOString(), note: p.note }))}
      />
    </>
  );
}
