"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact, formatMoney } from "@/lib/format";

type Point = { key: string; label: string; title: string; revenue: number; expenses: number };

/**
 * Recharts shu faylga ajratilgan va `widgets.tsx`da `next/dynamic` orqali yuklanadi — dashboard'ning
 * boshlang'ich JS bog'lamiga kirmaydi (Lighthouse: mobil tarmoqda "Render Delay"ni kamaytirish uchun).
 * Guruhlangan ustunlar: tushum (`--viz-1`) va xarajat (`--viz-2`); hammasi 0 bo'lsa ham o'qlar/to'r ko'rinadi.
 */
export default function PaymentsChart({ data, units, labels }: { data: Point[]; units: { million: string; thousand: string }; labels: { revenue: string; expenses: string } }) {
  return (
    <div className="h-56 w-full" role="img" aria-label={`${labels.revenue} / ${labels.expenses}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barGap={2} barCategoryGap="20%">
          <CartesianGrid stroke="var(--border)" strokeOpacity={0.6} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval="preserveStartEnd" minTickGap={8} />
          <YAxis
            domain={[0, (max: number) => Math.max(max, 100_000)]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v: number) => formatCompact(v, units)}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
                  <div className="text-muted-foreground mb-1">{(payload[0]?.payload as Point).title}</div>
                  {[
                    { name: labels.revenue, value: (payload[0]?.payload as Point).revenue, color: "var(--viz-1)" },
                    { name: labels.expenses, value: (payload[0]?.payload as Point).expenses, color: "var(--viz-2)" },
                  ].map((row) => (
                    <div key={row.name} className="flex items-center gap-2">
                      <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: row.color }} aria-hidden />
                      <span className="text-muted-foreground">{row.name}</span>
                      <span className="ml-auto pl-3 font-semibold tabular-nums">{formatMoney(row.value)}</span>
                    </div>
                  ))}
                </div>
              ) : null
            }
          />
          <Bar dataKey="revenue" fill="var(--viz-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="expenses" fill="var(--viz-2)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
