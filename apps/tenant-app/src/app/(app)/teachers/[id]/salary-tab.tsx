import { getTranslations } from "next-intl/server";
import { prisma } from "@markazai/db";
import { EmptyState } from "@/components/shared/empty-state";
import { MonthNav } from "@/components/shared/month-nav";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney } from "@/lib/format";
import { loadPayrolls } from "@/lib/payroll";

/** O'qituvchi profilidagi "Ish haqi" tabi: oylik davr, guruhlar bo'yicha jadval, jami va to'lovlar. */
export async function TeacherSalaryTab({ orgId, teacherId, period }: { orgId: string; teacherId: string; period: string }) {
  const t = await getTranslations("teacher.salaryTab");
  const [detail] = await loadPayrolls(orgId, period, { teacherId });
  const payments = await prisma.salaryPayment.findMany({ where: { organizationId: orgId, teacherId, period }, orderBy: { date: "desc" } });
  if (!detail) return <EmptyState title={t("empty")} />;

  const fixed = detail.payroll.method === "FIXED";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNav period={period} params={{ tab: "salary" }} />
        <dl className="flex flex-wrap gap-3">
          <div className="bg-card flex flex-col rounded-lg border px-4 py-2">
            <dt className="text-muted-foreground text-xs">{t("total")}</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatMoney(detail.payroll.total)}</dd>
          </div>
          <div className="bg-card flex flex-col rounded-lg border px-4 py-2">
            <dt className="text-muted-foreground text-xs">{t("paid")}</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatMoney(detail.paid)}</dd>
          </div>
          <div className="bg-card flex flex-col rounded-lg border px-4 py-2">
            <dt className="text-muted-foreground text-xs">{t("remaining")}</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatMoney(detail.remaining)}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-card overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="px-3 py-2 font-medium">{t("group")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("students")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("lessons")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("fixedAmount")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("calculated")}</th>
              <th className="px-3 py-2 font-medium">{t("method")}</th>
              <th className="px-3 py-2 font-medium">{t("salaryType")}</th>
            </tr>
          </thead>
          <tbody>
            {fixed && (
              <tr className="bg-muted/30 border-b">
                <td className="px-3 py-2 font-medium" colSpan={3}>
                  {t("monthlySalary")} ({t("attendanceBased", { came: detail.payroll.came, full: detail.payroll.fullWorkDays })})
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(detail.fixedSalary ?? 0)}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">{formatMoney(detail.payroll.total)}</td>
                <td className="px-3 py-2">{t("byAttendance")}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline">{t("typeFixed")}</Badge>
                </td>
              </tr>
            )}
            {detail.groups.map((g) => (
              <tr key={g.groupId} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <span className="font-medium">{g.groupName}</span> <span className="text-muted-foreground">· {g.courseName}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{g.students}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                  {g.lessons} · <span className="text-emerald-600 dark:text-emerald-400">{g.present}</span> · <span className="text-rose-600 dark:text-rose-400">{g.absent}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fixed ? "—" : `${detail.percent ?? 0}%`}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fixed ? "—" : formatMoney(g.amount)}</td>
                <td className="px-3 py-2">{fixed ? "—" : t("byPayments", { payments: formatMoney(g.payments) })}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline">{fixed ? t("typeFixed") : t("typePercent")}</Badge>
                </td>
              </tr>
            ))}
            {detail.groups.length === 0 && !fixed && (
              <tr>
                <td className="text-muted-foreground px-3 py-6 text-center" colSpan={7}>
                  {t("noGroups")}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t">
              <td className="px-3 py-2 font-semibold" colSpan={4}>
                {t("totalRow")}
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatMoney(detail.payroll.total)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-muted-foreground text-xs">{t("legend")}</p>

      {payments.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("payments")}</h3>
          <ul className="bg-card max-w-md divide-y rounded-lg border">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  {formatDate(p.date)} {p.note && <span className="text-muted-foreground">· {p.note}</span>}
                </span>
                <span className="font-medium tabular-nums">{formatMoney(p.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
