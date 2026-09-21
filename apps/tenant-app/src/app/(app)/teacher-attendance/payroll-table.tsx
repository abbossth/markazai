import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import type { TeacherPayrollDetail } from "@/lib/payroll";

/**
 * "Oylik maosh hisoblash": belgilangan oylik / to'liq ish kuni / keldi / asosiy maosh / qo'shimcha tushum / jami.
 * Foiz modelidagi o'qituvchilar uchun asosiy maosh — to'lovlardan foiz, qolgan ustunlar "—".
 */
export async function PayrollTable({ rows }: { rows: TeacherPayrollDetail[] }) {
  const t = await getTranslations("teacherAttendance");
  const dash = <span className="text-muted-foreground">—</span>;
  const total = rows.reduce((s, r) => s + r.payroll.total, 0);

  return (
    <div className="bg-card overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="px-3 py-2 font-medium">{t("teacher")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("fixedSalary")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("fullWorkDays")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("came")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("baseSalary")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("extraIncome")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("totalSalary")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const fixed = r.payroll.method === "FIXED";
            return (
              <tr key={r.teacherId} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.name}</div>
                  <Badge variant="outline" className="mt-1">
                    {fixed ? t("modelFixed") : t("percentOfPayments", { percent: r.percent ?? 0 })}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fixed ? formatMoney(r.fixedSalary ?? 0) : dash}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fixed ? r.payroll.fullWorkDays : dash}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fixed ? r.payroll.came : dash}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.payroll.base)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fixed ? `${formatMoney(r.payroll.extraIncome)}${r.payroll.extra ? ` (${r.payroll.extra})` : ""}` : dash}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatMoney(r.payroll.total)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t">
            <td className="px-3 py-2 font-medium" colSpan={6}>
              {t("total")}
            </td>
            <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatMoney(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
