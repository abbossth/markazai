"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Coins, Eye, EyeOff, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  attendanceStats,
  fromISODate,
  isoWeekday,
  lessonDatesInMonth,
  type AttendanceValue,
  type DaysPattern,
} from "@markazai/types";
import { Button } from "@/components/ui/button";
import { AwardCoinsDialog } from "@/components/shared/coins";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { setAttendance, setGrade } from "./actions";

type Member = { studentId: string; name: string; joinedAt: string; leftAt: string | null };
type GroupSchedule = { id: string; days: DaysPattern; customDays: number[]; startDate: string; endDate: string | null; holidays: string[] };

type Props =
  | { mode: "attendance"; records: { studentId: string; date: string; value: AttendanceValue }[] }
  | { mode: "grades"; records: { studentId: string; date: string; value: number }[] };

/** Gamifikatsiya (faqat davomat tabida): talabaning shu guruhdagi coin jami va berish huquqi. */
type CoinsProp = { totals: Record<string, number>; canAward: boolean };
type CommonProps = { group: GroupSchedule; members: Member[]; today: string; canEdit: boolean; coins?: CoinsProp };

const COINS_PREF_KEY = "markazai.showCoins";

const NEXT: Record<string, AttendanceValue | null> = { "": "PRESENT", PRESENT: "ABSENT", ABSENT: "EXCUSED", EXCUSED: null };
const SYMBOL: Record<AttendanceValue, string> = { PRESENT: "✓", ABSENT: "✕", EXCUSED: "С" };
const TONE: Record<AttendanceValue, string> = {
  PRESENT: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  ABSENT: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
  EXCUSED: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
};

export function LessonGrid(props: Props & CommonProps) {
  const t = useTranslations("attendance");
  const tc = useTranslations("common");
  const tw = useTranslations("enums.weekdaysShort");
  const tm = useTranslations("enums.months");
  const { group, members, today, canEdit, coins } = props;
  const [showCoins, setShowCoins] = useState(true);
  const [awarding, setAwarding] = useState<Member | null>(null);
  // "Show/Hide coins" tanlovi brauzerda eslab qolinadi (boshlang'ich qiymat serverdagi bilan bir xil — hydration mos).
  useEffect(() => {
    try {
      if (localStorage.getItem(COINS_PREF_KEY) === "0") setShowCoins(false);
    } catch {}
  }, []);
  const toggleCoins = () =>
    setShowCoins((v) => {
      try {
        localStorage.setItem(COINS_PREF_KEY, v ? "0" : "1");
      } catch {}
      return !v;
    });
  const coinsVisible = props.mode === "attendance" && !!coins && showCoins;
  const [, startTransition] = useTransition();
  const [cursor, setCursor] = useState({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });
  // Optimistik holat: "studentId|date" → qiymat
  const [values, setValues] = useState<Map<string, string | number>>(
    () => new Map(props.records.map((r) => [`${r.studentId}|${r.date}`, r.value])),
  );

  const dates = useMemo(
    () =>
      lessonDatesInMonth(
        { days: group.days, customDays: group.customDays, startDate: fromISODate(group.startDate), endDate: group.endDate ? fromISODate(group.endDate) : null, holidays: group.holidays },
        cursor.y,
        cursor.m,
      ),
    [group, cursor],
  );

  const monthStart = `${cursor.y}-${String(cursor.m).padStart(2, "0")}-01`;
  const monthEnd = `${cursor.y}-${String(cursor.m).padStart(2, "0")}-31`;
  const rows = members.filter((m) => m.joinedAt <= monthEnd && (!m.leftAt || m.leftAt >= monthStart));
  const monthName = `${tm(String(cursor.m) as "1")} ${cursor.y}`;

  const shift = (delta: number) =>
    setCursor(({ y, m }) => {
      const d = new Date(Date.UTC(y, m - 1 + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
    });

  const commit = (studentId: string, date: string, next: string | number | null, save: () => Promise<{ ok: boolean; error?: string }>) => {
    const key = `${studentId}|${date}`;
    const prev = values.get(key);
    setValues((m) => {
      const c = new Map(m);
      if (next === null) c.delete(key);
      else c.set(key, next);
      return c;
    });
    startTransition(async () => {
      const res = await save();
      if (!res.ok) {
        // Xatolikda oldingi qiymatga qaytariladi.
        setValues((m) => {
          const c = new Map(m);
          if (prev === undefined) c.delete(key);
          else c.set(key, prev);
          return c;
        });
        toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
      }
    });
  };

  const editable = (member: Member, date: string) => canEdit && date <= today && member.joinedAt <= date && (!member.leftAt || member.leftAt >= date);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => shift(-1)} aria-label={t("prevMonth")}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-36 text-center text-sm font-medium">{monthName}</span>
        <Button variant="ghost" size="icon-sm" onClick={() => shift(1)} aria-label={t("nextMonth")}>
          <ChevronRight className="size-4" />
        </Button>
        {props.mode === "attendance" && coins && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={toggleCoins} aria-pressed={showCoins}>
            {showCoins ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            <Coins className="size-4 text-amber-500" />
            {showCoins ? t("hideCoins") : t("showCoins")}
          </Button>
        )}
      </div>

      {dates.length === 0 ? (
        <EmptyState title={t("noLessons")} />
      ) : rows.length === 0 ? (
        <EmptyState title={t("noStudents")} />
      ) : (
        <div className="bg-card overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="bg-card sticky left-0 z-10 min-w-44 px-3 py-2 text-left font-medium">{t("student")}</th>
                {dates.map((d) => (
                  <th key={d} className={cn("min-w-11 px-1 py-2 text-center text-xs font-normal", d === today && "text-primary font-semibold")}>
                    <div>{Number(d.slice(8, 10))}</div>
                    <div className="text-muted-foreground">{tw(String(isoWeekday(fromISODate(d))) as "1")}</div>
                  </th>
                ))}
                {props.mode === "attendance" && <th className="px-3 py-2 text-center font-medium">%</th>}
                {coinsVisible && <th className="px-3 py-2 text-center font-medium">{t("coins")}</th>}
                {props.mode === "grades" && <th className="px-3 py-2 text-center font-medium">{t("average")}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((member) => {
                const cellKey = (d: string) => `${member.studentId}|${d}`;
                const attMap = new Map<string, AttendanceValue>();
                const scores: number[] = [];
                for (const d of dates) {
                  const v = values.get(cellKey(d));
                  if (props.mode === "attendance" && typeof v === "string") attMap.set(d, v as AttendanceValue);
                  if (props.mode === "grades" && typeof v === "number") scores.push(v);
                }
                const pct = props.mode === "attendance" ? attendanceStats(dates, attMap, today).percent : null;
                const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

                return (
                  <tr key={member.studentId} className="border-b last:border-0">
                    <td className="bg-card sticky left-0 z-10 px-3 py-1.5 font-medium">{member.name}</td>
                    {dates.map((d) => {
                      const value = values.get(cellKey(d));
                      const can = editable(member, d);
                      const inactive = !(member.joinedAt <= d && (!member.leftAt || member.leftAt >= d));

                      return (
                        <td key={d} className={cn("p-0.5 text-center", inactive && "bg-muted/50")}>
                          {props.mode === "attendance" ? (
                            <button
                              type="button"
                              disabled={!can}
                              aria-label={`${member.name} ${d}: ${value ? t(value as "PRESENT") : t("empty")}`}
                              onClick={() => {
                                const next = NEXT[(value as string) ?? ""] ?? null;
                                commit(member.studentId, d, next, () => setAttendance(group.id, member.studentId, d, next));
                              }}
                              className={cn(
                                "size-8 rounded-md text-xs font-semibold transition-colors",
                                value ? TONE[value as AttendanceValue] : d <= today && !inactive ? "border-border border border-dashed" : "",
                                can && "hover:ring-primary/50 hover:ring-2",
                                !can && "cursor-default",
                              )}
                            >
                              {value ? SYMBOL[value as AttendanceValue] : ""}
                            </button>
                          ) : (
                            <ScoreCell
                              value={typeof value === "number" ? value : null}
                              disabled={!can}
                              label={`${member.name} ${d}`}
                              onSave={(score) => commit(member.studentId, d, score, () => setGrade(group.id, member.studentId, d, score))}
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="text-muted-foreground px-3 text-center text-xs tabular-nums">
                      {props.mode === "attendance" ? (pct === null ? "—" : `${pct}%`) : avg === null ? "—" : avg}
                    </td>
                    {coinsVisible && (
                      <td className="px-3 text-center text-xs tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <span className="font-medium">{coins?.totals[member.studentId] ?? 0}</span>
                          {coins?.canAward && (
                            <Button variant="ghost" size="icon-xs" aria-label={t("awardCoins")} onClick={() => setAwarding(member)}>
                              <Plus className="size-3.5" />
                            </Button>
                          )}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {awarding && <AwardCoinsDialog studentId={awarding.studentId} studentName={awarding.name} groupId={group.id} onClose={() => setAwarding(null)} />}
    </div>
  );
}

/** 0–100 oralig'idagi ball; bo'sh qoldirilsa baho olib tashlanadi. Noto'g'ri qiymat oldingisiga qaytadi. */
function ScoreCell({ value, disabled, label, onSave }: { value: number | null; disabled: boolean; label: string; onSave: (score: number | null) => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  const finish = () => {
    if (draft === null) return;
    const raw = draft.trim();
    setDraft(null);
    if (raw === "") return value !== null ? onSave(null) : undefined;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 100) return;
    if (n !== value) onSave(n);
  };

  return (
    <input
      inputMode="numeric"
      aria-label={label}
      disabled={disabled}
      value={draft ?? (value === null ? "" : String(value))}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 3))}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(null);
      }}
      className={cn(
        "focus:ring-primary size-8 w-10 rounded-md bg-transparent text-center text-xs tabular-nums outline-none focus:ring-2 disabled:cursor-default",
        value !== null && "bg-primary/10 font-semibold",
      )}
    />
  );
}
