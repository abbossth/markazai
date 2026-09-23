"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact, formatMoney } from "@/lib/format";

/**
 * Recharts shu faylga ajratilgan va `widgets.tsx`da `next/dynamic` orqali yuklanadi — dashboard'ning
 * boshlang'ich JS bog'lamiga kirmaydi (Lighthouse: mobil tarmoqda "Render Delay"ni kamaytirish uchun,
 * chunki grafik odatda LCP elementi emas — sarlavha/statistika kartochkalari birinchi ko'rinadi).
 */
export default function PaymentsChart({ data, units, label }: { data: { key: string; revenue: number; label: string }[]; units: { million: string; thousand: string }; label: string }) {
  return (
    <div className="h-56 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeOpacity={0.6} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={24} />
          <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => formatCompact(v, units)} />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "3 3" }}
            content={({ active, payload, label: pointLabel }) =>
              active && payload?.length ? (
                <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
                  <div className="text-muted-foreground mb-1">{String(pointLabel)}</div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-0.5 w-3 rounded" style={{ backgroundColor: "var(--viz-1)" }} aria-hidden />
                    <span className="font-semibold tabular-nums">{formatMoney(Number(payload[0]?.value ?? 0))}</span>
                  </div>
                </div>
              ) : null
            }
          />
          <Line type="linear" dataKey="revenue" stroke="var(--viz-1)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2, fill: "var(--viz-1)" }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
