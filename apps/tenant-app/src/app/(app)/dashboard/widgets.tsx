"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Banknote,
  Funnel,
  Gauge,
  MonitorPlay,
  UserMinus,
  Users,
  UsersRound,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { TIMETABLE_TABS, timeRange, timetableTab, type TimetableTab } from "@markazai/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartSkeleton } from "@/components/shared/skeletons";
import { EmptyState } from "@/components/shared/empty-state";
import { useDaysLabel } from "@/components/shared/days-label";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MetricValue, ScheduleGroup } from "./queries";

// recharts — alohida chunk (payments-chart.tsx), dashboard ochilganda darhol yuklanmaydi.
const PaymentsChart = dynamic(() => import("./payments-chart"), { loading: () => <ChartSkeleton />, ssr: false });

// Har bir metrika uchun ikonka — skanerlashni osonlashtiradi (modme-uslubidagi dashboard'dan ilhomlanib).
// Rang — semantik: neytral ko'k (odatiy), qizil (qarzdorlar/muddati o'tganlar).
const METRIC_ICON: Record<string, { icon: LucideIcon; tone: "brand" | "destructive" }> = {
  activeStudents: { icon: Users, tone: "brand" },
  groups: { icon: UsersRound, tone: "brand" },
  debtors: { icon: AlertTriangle, tone: "destructive" },
  activeLeads: { icon: Funnel, tone: "brand" },
  trial: { icon: MonitorPlay, tone: "brand" },
  paidThisMonth: { icon: Banknote, tone: "brand" },
  leftActiveGroup: { icon: UserMinus, tone: "destructive" },
  trialOverdue: { icon: UserX, tone: "destructive" },
  centerLoad: { icon: Gauge, tone: "brand" },
};

/** Metrika kartochkasi: ikonka, qiymat, yorliq va (tahrirlash rejimida bo'lmasa) tegishli ro'yxatga havola. */
export function MetricWidget({ id, metric, edit, primary }: { id: string; metric: MetricValue; edit: boolean; primary?: boolean }) {
  const t = useTranslations("dashboard");
  const isLoad = id === "centerLoad";
  const title = t(`widgets.${id}` as "widgets.groups");
  const iconInfo = METRIC_ICON[id];
  const Icon = iconInfo?.icon;
  return (
    <div className={cn("flex h-full flex-col justify-between gap-2", primary && "-m-3 rounded-lg bg-brand-500/[0.06] p-3")}>
      <div className="flex items-center gap-2">
        {Icon && (
          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", iconInfo.tone === "destructive" ? "bg-destructive/10 text-destructive" : "bg-brand-500/10 text-brand-500")}>
            <Icon className="size-4" />
          </span>
        )}
        <span className="text-muted-foreground text-xs">{title}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-semibold tabular-nums">{metric.value === null ? "—" : isLoad ? `${metric.value}%` : formatMoney(metric.value)}</span>
        {isLoad && metric.of && (
          <span className="text-muted-foreground text-xs tabular-nums">
            {metric.of.students} / {metric.of.capacity}
          </span>
        )}
      </div>
      {/* Butun kartochka havola (tahrirlash rejimida sudrash bilan to'qnashmasligi uchun o'chiriladi). */}
      {!edit && <Link href={metric.href} className="hover:bg-muted/40 absolute inset-0 rounded-lg transition-colors" aria-label={title} />}
    </div>
  );
}

/**
 * Oy davomidagi to'lovlar (bitta seriya → legenda yo'q, sarlavha nomlaydi). Crosshair + tooltip; "Jadval" ko'rinishi bor.
 * Rang — validatsiya qilingan kategorik 1-slot (`--viz-1`).
 */
export function PaymentsWidget({ points }: { points: { key: string; revenue: number }[] }) {
  const t = useTranslations("dashboard");
  const tf = useTranslations("finance");
  const tm = useTranslations("enums.monthsShort");
  const [view, setView] = useState<"chart" | "table">("chart");
  // `key` — "YYYY-MM" (oylik trend). Yorliq: "Sen 26" uslubida.
  const data = points.map((p) => ({ ...p, label: `${tm(String(Number(p.key.slice(5, 7))) as "1")} ${p.key.slice(2, 4)}` }));
  const total = points.reduce((s, p) => s + p.revenue, 0);
  const units = { million: tf("unitMillion"), thousand: tf("unitThousand") };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-muted-foreground text-sm">{t("widgets.paymentsChart")}</span>
        <span className="font-semibold tabular-nums">{formatMoney(total)}</span>
        <div className="ml-auto flex gap-1">
          <Button size="xs" variant={view === "chart" ? "secondary" : "ghost"} onClick={() => setView("chart")}>
            {tf("viewChart")}
          </Button>
          <Button size="xs" variant={view === "table" ? "secondary" : "ghost"} onClick={() => setView("table")}>
            {tf("viewTable")}
          </Button>
        </div>
      </div>
      {total === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">{tf("trendEmpty")}</p>
      ) : view === "chart" ? (
        <PaymentsChart data={data} units={units} label={t("widgets.paymentsChart")} />
      ) : (
        <div className="max-h-56 overflow-auto">
          <table className="w-full text-sm">
            <tbody>
              {data.filter((p) => p.revenue > 0).map((p) => (
                <tr key={p.key} className="border-t first:border-0">
                  <td className="py-1">{p.label}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Dars jadvali: Toq / Juft / Boshqa tablari; ustunlar — xonalar, qatorlar — dars boshlanish vaqti.
 * Katakda: guruh kodi, kurs, o'qituvchi, talabalar/sig'im va tugashigacha "N kun qoldi".
 */
export function ScheduleWidget({ groups }: { groups: ScheduleGroup[] }) {
  const t = useTranslations("dashboard.schedule");
  const daysLabel = useDaysLabel();
  const [tab, setTab] = useState<TimetableTab>("ODD");

  const counts = useMemo(() => Object.fromEntries(TIMETABLE_TABS.map((k) => [k, groups.filter((g) => timetableTab(g.days) === k).length])) as Record<TimetableTab, number>, [groups]);
  const shown = groups.filter((g) => timetableTab(g.days) === tab);
  const rooms = [...new Set(shown.map((g) => g.roomName ?? ""))].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, undefined, { numeric: true })));
  const times = [...new Set(shown.map((g) => g.startTime))].sort();

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">{t("title")}</span>
        <div className="bg-muted ml-auto inline-flex gap-1 rounded-lg p-1" role="tablist">
          {TIMETABLE_TABS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn("text-muted-foreground hover:text-foreground rounded-md px-3 py-1 text-sm transition-colors", tab === k && "bg-background text-foreground shadow-xs")}
            >
              {t(`tabs.${k}`)} <span className="text-muted-foreground text-xs">({counts[k]})</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="text-muted-foreground w-16 text-left text-xs font-normal">{t("time")}</th>
                {rooms.map((r) => (
                  <th key={r || "none"} className="text-left text-xs font-medium">
                    {r || t("noRoom")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {times.map((time) => (
                <tr key={time} className="align-top">
                  <td className="text-muted-foreground pt-1 text-xs tabular-nums">{time}</td>
                  {rooms.map((room) => {
                    const cell = shown.filter((g) => g.startTime === time && (g.roomName ?? "") === room);
                    return (
                      <td key={room || "none"} className="min-w-44">
                        <div className="flex flex-col gap-1">
                          {cell.map((g) => (
                            <Link key={g.id} href={`/groups/${g.id}`} className="bg-card hover:bg-muted/50 block rounded-md border-l-4 border py-1.5 pr-2 pl-2.5 transition-colors" style={{ borderLeftColor: g.courseColor }}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold">{g.name}</span>
                                <span className="text-muted-foreground text-xs tabular-nums">
                                  {g.students}
                                  {g.capacity !== null && `/${g.capacity}`}
                                </span>
                              </div>
                              <div className="text-muted-foreground truncate text-xs">
                                {g.courseName} · {g.teacherName}
                              </div>
                              <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                                <span className="tabular-nums">{timeRange(g.startTime, g.durationMinutes)}</span>
                                {g.days === "OTHER" || g.days === "EVERY_DAY" || g.days === "WEEKEND" ? <span>{daysLabel(g.days, g.customDays)}</span> : null}
                                {g.daysLeft !== null && <Badge variant="outline">{t("daysLeft", { count: g.daysLeft })}</Badge>}
                              </div>
                            </Link>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
