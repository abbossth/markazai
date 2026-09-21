"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarCheck2 } from "lucide-react";
import { toast } from "sonner";
import { fromISODate, isoWeekday } from "@markazai/types";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markFullWorkDays, setTeacherAttendance } from "./actions";

type Status = "PRESENT" | "ABSENT" | "EXTRA";
export type GridTeacher = { id: string; name: string; workDays: number[]; workStartDate: string | null };
export type GridRecord = { teacherId: string; date: string; status: Status };

const SYMBOL: Record<Status, string> = { PRESENT: "✓", ABSENT: "✕", EXTRA: "+" };
const TONE: Record<Status, string> = {
  PRESENT: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  ABSENT: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
  EXTRA: "bg-sky-500/20 text-sky-700 dark:text-sky-300",
};

type Props = { period: string; days: string[]; teachers: GridTeacher[]; records: GridRecord[]; today: string; canEdit: boolean };

/**
 * Ustozlar davomati: kun-kun jadval. Ish kunida katak: bo'sh → keldi → kelmadi → bo'sh.
 * Ish jadvalidan tashqari kunda: bo'sh → qo'shimcha → bo'sh. Belgilar optimistik yangilanadi; xatoda qaytariladi.
 */
export function TeacherAttendanceGrid({ period, days, teachers, records, today, canEdit }: Props) {
  const t = useTranslations("teacherAttendance");
  const tc = useTranslations("common");
  const tw = useTranslations("enums.weekdaysShort");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [values, setValues] = useState(() => new Map<string, Status>(records.map((r) => [`${r.teacherId}|${r.date}`, r.status])));
  // Server yangi ma'lumot yuborganda (davr o'zgarishi, "to'liq ish kuni") lokal holat almashtiriladi.
  const [seen, setSeen] = useState(records);
  if (records !== seen) {
    setSeen(records);
    setValues(new Map(records.map((r) => [`${r.teacherId}|${r.date}`, r.status])));
  }

  if (teachers.length === 0) return <EmptyState title={t("noTeachers")} hint={t("noTeachersHint")} />;

  const next = (current: Status | undefined, scheduled: boolean): Status | null => {
    if (!scheduled) return current ? null : "EXTRA";
    return current === undefined ? "PRESENT" : current === "PRESENT" ? "ABSENT" : null;
  };

  const change = (teacherId: string, date: string, status: Status | null) => {
    const key = `${teacherId}|${date}`;
    const prev = values.get(key);
    setValues((m) => {
      const c = new Map(m);
      if (status) c.set(key, status);
      else c.delete(key);
      return c;
    });
    startTransition(async () => {
      const res = await setTeacherAttendance(teacherId, date, status);
      if (!res.ok) {
        setValues((m) => {
          const c = new Map(m);
          if (prev) c.set(key, prev);
          else c.delete(key);
          return c;
        });
        toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
      }
    });
  };

  const fullMonth = (teacherId: string) =>
    startTransition(async () => {
      const res = await markFullWorkDays(teacherId, period);
      if (res.ok) {
        toast.success(t("fullMarked", { count: res.marked ?? 0 }));
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  return (
    <div className="bg-card overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="bg-card sticky left-0 z-10 min-w-44 px-3 py-2 text-left font-medium">{t("teacher")}</th>
            {days.map((d) => (
              <th key={d} className={cn("min-w-9 px-0.5 py-2 text-center text-xs font-normal", d === today && "text-primary font-semibold")}>
                <div>{Number(d.slice(8, 10))}</div>
                <div className="text-muted-foreground">{tw(String(isoWeekday(fromISODate(d))) as "1")}</div>
              </th>
            ))}
            <th className="px-3 py-2 text-center font-medium whitespace-nowrap">{t("came")}</th>
            <th className="px-3 py-2 text-center font-medium whitespace-nowrap">{t("absent")}</th>
            <th className="px-3 py-2 text-center font-medium whitespace-nowrap">{t("extra")}</th>
            {canEdit && <th className="px-2" />}
          </tr>
        </thead>
        <tbody>
          {teachers.map((teacher) => {
            const count = (s: Status) => days.filter((d) => values.get(`${teacher.id}|${d}`) === s).length;
            return (
              <tr key={teacher.id} className="border-b last:border-0">
                <td className="bg-card sticky left-0 z-10 px-3 py-1.5 font-medium">{teacher.name}</td>
                {days.map((d) => {
                  const key = `${teacher.id}|${d}`;
                  const value = values.get(key);
                  const scheduled = teacher.workDays.includes(isoWeekday(fromISODate(d)));
                  const beforeStart = !!teacher.workStartDate && d < teacher.workStartDate;
                  const editable = canEdit && d <= today && !beforeStart;
                  return (
                    <td key={d} className={cn("p-0.5 text-center", scheduled ? "bg-muted/40" : "")}>
                      <button
                        type="button"
                        disabled={!editable}
                        aria-label={`${teacher.name} ${d}: ${value ? t(value) : scheduled ? t("empty") : t("dayOff")}`}
                        onClick={() => change(teacher.id, d, next(value, scheduled))}
                        className={cn(
                          "size-8 rounded-md text-xs font-semibold transition-colors",
                          value ? TONE[value] : scheduled && d <= today && !beforeStart ? "border-border border border-dashed" : "",
                          editable && "hover:ring-primary/50 hover:ring-2",
                          !editable && "cursor-default",
                        )}
                      >
                        {value ? SYMBOL[value] : ""}
                      </button>
                    </td>
                  );
                })}
                <td className="px-3 text-center tabular-nums">{count("PRESENT")}</td>
                <td className="px-3 text-center tabular-nums">{count("ABSENT")}</td>
                <td className="px-3 text-center tabular-nums">{count("EXTRA")}</td>
                {canEdit && (
                  <td className="px-2">
                    <Button size="xs" variant="outline" title={t("fullHint")} onClick={() => fullMonth(teacher.id)}>
                      <CalendarCheck2 className="size-3.5" />
                      {t("fullDays")}
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-muted-foreground border-t px-3 py-2 text-xs">{t("legend")}</p>
    </div>
  );
}
