"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react";
import {
  attendanceStats,
  fromISODate,
  isoWeekday,
  lessonDatesBetween,
  lessonDatesInMonth,
  type AttendanceValue,
  type DaysPattern,
} from "@markazai/types";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "@/components/ui/simple-select";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type GroupInfo = { id: string; name: string; days: DaysPattern; customDays: number[]; startDate: string; endDate: string | null };
type Record = { groupId: string; date: string; status: AttendanceValue };

const STATUS_STYLE: { [K in AttendanceValue]: string } = {
  PRESENT: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  ABSENT: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
  EXCUSED: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
};

export function AttendanceTab({ groups, records, today }: { groups: GroupInfo[]; records: Record[]; today: string }) {
  const t = useTranslations("attendance");
  const locale = useLocale();
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }));

  const group = groups.find((g) => g.id === groupId);

  const { byDate, allDates, stats } = useMemo(() => {
    if (!group) return { byDate: new Map<string, AttendanceValue>(), allDates: [] as string[], stats: null };
    const byDate = new Map<string, AttendanceValue>(records.filter((r) => r.groupId === group.id).map((r) => [r.date, r.status]));
    const schedule = { days: group.days, customDays: group.customDays, startDate: fromISODate(group.startDate), endDate: group.endDate ? fromISODate(group.endDate) : null };
    const end = group.endDate && group.endDate < today ? group.endDate : today;
    const allDates = group.startDate <= end ? lessonDatesBetween(schedule, fromISODate(group.startDate), fromISODate(end)) : [];
    return { byDate, allDates, stats: attendanceStats(allDates, byDate, today) };
  }, [group, records, today]);

  if (groups.length === 0) return <EmptyState title={t("noGroups")} />;

  const monthDates = new Set(
    group
      ? lessonDatesInMonth({ days: group.days, customDays: group.customDays, startDate: fromISODate(group.startDate), endDate: group.endDate ? fromISODate(group.endDate) : null }, cursor.y, cursor.m)
      : [],
  );
  const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m, 0)).getUTCDate();
  const offset = isoWeekday(new Date(Date.UTC(cursor.y, cursor.m - 1, 1))) - 1;
  const iso = (d: number) => `${cursor.y}-${String(cursor.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const shift = (delta: number) =>
    setCursor(({ y, m }) => {
      const d = new Date(Date.UTC(y, m - 1 + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
    });
  const monthName = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(cursor.y, cursor.m - 1, 1)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-56">
          <SimpleSelect value={groupId} onValueChange={setGroupId} options={groups.map((g) => ({ value: g.id, label: g.name }))} />
        </div>
        <div className="ml-auto flex gap-1">
          <Button variant={view === "calendar" ? "secondary" : "outline"} size="sm" onClick={() => setView("calendar")}>
            <CalendarDays className="size-4" />
            {t("calendar")}
          </Button>
          <Button variant={view === "list" ? "secondary" : "outline"} size="sm" onClick={() => setView("list")}>
            <List className="size-4" />
            {t("list")}
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label={t("present")} value={stats.present} tone="text-emerald-600" />
          <Stat label={t("absent")} value={stats.absent} tone="text-rose-600" />
          <Stat label={t("excused")} value={stats.excused} tone="text-amber-600" />
          <Stat label={t("empty")} value={stats.empty} />
          <Stat label={t("percent")} value={stats.percent === null ? "—" : `${stats.percent}%`} />
        </div>
      )}

      {view === "calendar" ? (
        <div className="bg-card max-w-md rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between">
            <Button variant="ghost" size="icon-sm" onClick={() => shift(-1)} aria-label={t("prevMonth")}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-medium capitalize">{monthName}</span>
            <Button variant="ghost" size="icon-sm" onClick={() => shift(1)} aria-label={t("nextMonth")}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="text-muted-foreground grid grid-cols-7 gap-1 text-center text-xs">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <WeekdayHead key={d} day={d} />
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: offset }).map((_, i) => (
              <span key={`o${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const key = iso(d);
              const lesson = monthDates.has(key);
              const status = byDate.get(key);
              const past = key <= today;
              return (
                <div
                  key={key}
                  title={lesson ? (status ? t(status) : past ? t("empty") : t("upcoming")) : undefined}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md text-sm",
                    !lesson && "text-muted-foreground/60",
                    lesson && !status && past && "border-border border border-dashed",
                    lesson && !status && !past && "bg-muted",
                    lesson && status && STATUS_STYLE[status],
                    key === today && "ring-primary ring-2",
                  )}
                >
                  {d}
                </div>
              );
            })}
          </div>
        </div>
      ) : allDates.length === 0 ? (
        <EmptyState title={t("noLessons")} />
      ) : (
        <ul className="bg-card max-w-md divide-y rounded-lg border">
          {[...allDates].reverse().map((d) => {
            const status = byDate.get(d);
            return (
              <li key={d} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{formatDate(d)}</span>
                {status ? <Badge className={STATUS_STYLE[status]}>{t(status)}</Badge> : <Badge variant="outline">{t("empty")}</Badge>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function WeekdayHead({ day }: { day: number }) {
  const t = useTranslations("enums.weekdaysShort");
  return <span>{t(String(day) as "1")}</span>;
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="bg-card rounded-lg border p-3">
      <div className={cn("text-2xl font-semibold tabular-nums", tone)}>{value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}
