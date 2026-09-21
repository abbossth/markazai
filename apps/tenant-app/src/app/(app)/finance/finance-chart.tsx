"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { formatCompact, formatMoney } from "@/lib/format";
import type { TrendPoint } from "./queries";

type Props = { granularity: "day" | "month"; points: TrendPoint[] };

const SERIES = [
  { key: "revenue", color: "var(--viz-1)" },
  { key: "expenses", color: "var(--viz-2)" },
] as const;

/**
 * Tushum va xarajat dinamikasi. Bitta o'q (ikkalasi ham so'm), 2px chiziqlar, recessiv setka,
 * crosshair + bitta tooltip (ikkala seriya), legenda va "Jadval" ko'rinishi (faqat rangga tayanmaslik uchun).
 */
export function FinanceChart({ granularity, points }: Props) {
  const t = useTranslations("finance");
  const tm = useTranslations("enums.months");
  const [view, setView] = useState<"chart" | "table">("chart");

  const label = (key: string) => (granularity === "month" ? `${tm(String(Number(key.slice(5, 7))) as "1")} ${key.slice(0, 4)}` : `${key.slice(8, 10)}.${key.slice(5, 7)}`);
  const units = { million: t("unitMillion"), thousand: t("unitThousand") };
  const data = points.map((p) => ({ ...p, label: label(p.key) }));
  const empty = points.every((p) => p.revenue === 0 && p.expenses === 0);

  return (
    <section className="bg-card flex flex-col gap-3 rounded-lg border p-4" aria-label={t("trendTitle")}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold">{t("trendTitle")}</h2>
        {/* Legenda: 2 seriya uchun doim ko'rinadi; matn — matn rangida, belgi — seriya rangida */}
        <ul className="text-muted-foreground flex items-center gap-4 text-xs">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: s.color }} aria-hidden />
              {t(s.key)}
            </li>
          ))}
        </ul>
        <div className="ml-auto flex gap-1">
          <Button size="xs" variant={view === "chart" ? "secondary" : "ghost"} onClick={() => setView("chart")}>
            {t("viewChart")}
          </Button>
          <Button size="xs" variant={view === "table" ? "secondary" : "ghost"} onClick={() => setView("table")}>
            {t("viewTable")}
          </Button>
        </div>
      </div>

      {empty ? (
        <p className="text-muted-foreground py-10 text-center text-sm">{t("trendEmpty")}</p>
      ) : view === "chart" ? (
        <div className="h-64 w-full" role="img" aria-label={t("trendTitle")}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.6} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={24} />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v: number) => formatCompact(v, units)}
              />
              <Tooltip
                cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "3 3" }}
                content={({ active, payload, label: l }) =>
                  active && payload?.length ? (
                    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
                      <div className="text-muted-foreground mb-1">{String(l)}</div>
                      {SERIES.map((s) => {
                        const value = Number(payload.find((p) => p.dataKey === s.key)?.value ?? 0);
                        return (
                          <div key={s.key} className="flex items-center gap-2 py-0.5">
                            <span className="inline-block h-0.5 w-3 rounded" style={{ backgroundColor: s.color }} aria-hidden />
                            <span className="font-semibold tabular-nums">{formatMoney(value)}</span>
                            <span className="text-muted-foreground">{t(s.key)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null
                }
              />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2, fill: s.color }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-left text-xs">
              <tr>
                <th className="py-1 font-normal">{t("period")}</th>
                <th className="py-1 text-right font-normal">{t("revenue")}</th>
                <th className="py-1 text-right font-normal">{t("expenses")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.key} className="border-t">
                  <td className="py-1">{p.label}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(p.revenue)}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(p.expenses)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
