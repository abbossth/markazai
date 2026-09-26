"use client";

import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  Banknote,
  Columns3,
  Funnel,
  Gauge,
  MonitorPlay,
  Rows3,
  UserMinus,
  Users,
  UsersRound,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { fromISODate, isoWeekday, TIMETABLE_TABS, timeRange, timetableTab, type TimetableTab } from "@markazai/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartSkeleton } from "@/components/shared/skeletons";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDaysLabel } from "@/components/shared/days-label";
import { useLocalPref } from "@/hooks/use-local-pref";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { saveCenterCapacity } from "./actions";
import type { MetricValue, ScheduleGroup, TrendPoint } from "./queries";

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
export function MetricWidget({ id, metric, edit }: { id: string; metric: MetricValue; edit: boolean }) {
  const t = useTranslations("dashboard");
  const title = t(`widgets.${id}` as "widgets.groups");
  const iconInfo = METRIC_ICON[id];
  const Icon = iconInfo?.icon;
  return (
    <div className="flex h-full flex-col justify-between gap-2">
      <div className="flex items-center gap-2">
        {Icon && (
          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", iconInfo.tone === "destructive" ? "bg-destructive/10 text-destructive" : "bg-brand-500/10 text-brand-500")}>
            <Icon className="size-4" />
          </span>
        )}
        <span className="text-muted-foreground text-xs">{title}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums">{metric.value === null ? "—" : formatMoney(metric.value)}</span>
      </div>
      {/* Butun kartochka havola (tahrirlash rejimida sudrash bilan to'qnashmasligi uchun o'chiriladi). */}
      {!edit && <Link href={metric.href} className="hover:bg-muted/40 absolute inset-0 rounded-lg transition-colors" aria-label={title} />}
    </div>
  );
}

/**
 * "Markaz yuklamasi": sig'im (o'rinlar) endi xonalardan avtomatik emas, qo'lda kiritiladi — kiritilmagan bo'lsa
 * foiz o'rniga faqat faol o'quvchilar soni va "Sig'imni kiritish" tugmasi ko'rsatiladi (modme-uslubidan).
 */
export function CenterLoadWidget({ metric, edit, canManage }: { metric: MetricValue; edit: boolean; canManage: boolean }) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const students = metric.of?.students ?? 0;
  const capacity = metric.of?.capacity ?? null;
  const iconInfo = METRIC_ICON.centerLoad;
  const Icon = iconInfo.icon;

  const save = (raw: string) => {
    const trimmed = raw.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) {
      toast.error(tc("error"));
      return;
    }
    startTransition(async () => {
      const res = await saveCenterCapacity(parsed);
      if (res.ok) {
        toast.success(tc("saved"));
        setOpen(false);
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });
  };

  return (
    <div className="flex h-full flex-col justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="bg-brand-500/10 text-brand-500 flex size-7 shrink-0 items-center justify-center rounded-md">
          <Icon className="size-4" />
        </span>
        <span className="text-muted-foreground text-xs">{t("widgets.centerLoad")}</span>
      </div>
      {capacity ? (
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tabular-nums">{metric.value}%</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {students} / {capacity}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-2xl font-semibold tabular-nums">{students}</span>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs">{t("capacityHint")}</span>
              <Button size="xs" variant="outline" disabled={edit} onClick={() => setOpen(true)}>
                {t("enterCapacity")}
              </Button>
            </div>
          )}
        </div>
      )}
      {canManage && capacity && !edit && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-muted-foreground hover:text-foreground absolute top-2 right-2 text-xs underline-offset-2 hover:underline"
        >
          {t("enterCapacity")}
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("capacityDialogTitle")}</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save(new FormData(e.currentTarget).get("capacity") as string);
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="capacity">{t("capacityFieldLabel")}</Label>
              {/* `key` — sig'im serverdan yangilanganda (saqlangach) input o'zining ichki (uncontrolled)
                  holatini toza qayta boshlaydi, aks holda Base UI "default qiymat init'dan keyin o'zgardi"
                  deb ogohlantirar edi. */}
              <Input key={capacity ?? "empty"} id="capacity" name="capacity" type="number" min={0} defaultValue={capacity ?? ""} autoFocus />
            </div>
            <DialogDescription>{t("capacityFieldHint")}</DialogDescription>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Tushum va xarajat (ikki seriya → legenda bor). Oylik (oxirgi 6 oy) va kunlik (joriy oy) ko'rinish; ma'lumot
 * bo'lmasa ham diagramma nollar bilan ko'rinadi. "Jadval" ko'rinishi bor. Ranglar — `--viz-1` (tushum), `--viz-2` (xarajat).
 */
export function PaymentsWidget({ data }: { data: { monthly: TrendPoint[]; daily: TrendPoint[] } }) {
  const t = useTranslations("dashboard");
  const tf = useTranslations("finance");
  const tm = useTranslations("enums.monthsShort");
  const [view, setView] = useState<"chart" | "table">("chart");
  const [range, setRange] = useState<"monthly" | "daily">("monthly");
  const points = data[range].map((p) => ({
    ...p,
    // Oylik: "YYYY-MM" → "Sen 26"; kunlik: "YYYY-MM-DD" → "26".
    label: range === "monthly" ? `${tm(String(Number(p.key.slice(5, 7))) as "1")} ${p.key.slice(2, 4)}` : String(Number(p.key.slice(8, 10))),
    title: range === "monthly" ? `${tm(String(Number(p.key.slice(5, 7))) as "1")} ${p.key.slice(0, 4)}` : `${p.key.slice(8, 10)}.${p.key.slice(5, 7)}.${p.key.slice(0, 4)}`,
  }));
  const revenue = points.reduce((s, p) => s + p.revenue, 0);
  const expenses = points.reduce((s, p) => s + p.expenses, 0);
  const units = { million: tf("unitMillion"), thousand: tf("unitThousand") };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-muted-foreground text-sm">{t("widgets.paymentsChart")}</span>
        <span className="flex items-center gap-1.5 text-sm">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: "var(--viz-1)" }} aria-hidden />
          {tf("revenue")} <span className="font-semibold tabular-nums">{formatMoney(revenue)}</span>
        </span>
        <span className="flex items-center gap-1.5 text-sm">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: "var(--viz-2)" }} aria-hidden />
          {tf("expenses")} <span className="font-semibold tabular-nums">{formatMoney(expenses)}</span>
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          <Button size="xs" variant={range === "monthly" ? "secondary" : "ghost"} onClick={() => setRange("monthly")}>
            {t("rangeMonthly")}
          </Button>
          <Button size="xs" variant={range === "daily" ? "secondary" : "ghost"} onClick={() => setRange("daily")}>
            {t("rangeDaily")}
          </Button>
          <Button size="xs" variant={view === "chart" ? "secondary" : "ghost"} onClick={() => setView("chart")}>
            {tf("viewChart")}
          </Button>
          <Button size="xs" variant={view === "table" ? "secondary" : "ghost"} onClick={() => setView("table")}>
            {tf("viewTable")}
          </Button>
        </div>
      </div>
      {view === "chart" ? (
        <PaymentsChart data={points} units={units} labels={{ revenue: tf("revenue"), expenses: tf("expenses") }} />
      ) : (
        <div className="max-h-56 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-xs">
                <th className="py-1 text-left font-normal" />
                <th className="py-1 text-right font-normal">{tf("revenue")}</th>
                <th className="py-1 text-right font-normal">{tf("expenses")}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.key} className="border-t">
                  <td className="py-1">{p.title}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(p.revenue)}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(p.expenses)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Bugungi kunga mos tab: ISO hafta kuni [1,3,5]=Du/Chor/Ju → "Toq", [2,4,6]=Se/Pay/Sha → "Juft"; Yakshanba → "Toq". */
function defaultTabFor(today: string): TimetableTab {
  const weekday = isoWeekday(fromISODate(today));
  if (weekday === 2 || weekday === 4 || weekday === 6) return "EVEN";
  return "ODD";
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
const toTimeLabel = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/**
 * Dars jadvali: Toq / Juft / Boshqa tablari (sukut — bugungi kunga mos keladigani); ustunlar — xonalar,
 * qatorlar — dars boshlanish vaqti. Katakda: guruh kodi, kurs, o'qituvchi, talabalar/sig'im va "N kun qoldi".
 */
export function ScheduleWidget({ groups, today }: { groups: ScheduleGroup[]; today: string }) {
  const t = useTranslations("dashboard.schedule");
  const daysLabel = useDaysLabel();
  const [tab, setTab] = useState<TimetableTab>(() => defaultTabFor(today));
  // Jadval ko'rinishi: sukut — "gorizontal" (xona qatorda, vaqt ustunda) — barcha markazlar uchun; foydalanuvchi
  // "vertikal"ga o'zgartirsa, faqat shu brauzerda (localStorage) saqlanadi, boshqa markaz/xodimga ta'sir qilmaydi.
  const [horizontal, setHorizontal] = useLocalPref("markazai.scheduleHorizontal", true);

  const counts = useMemo(() => Object.fromEntries(TIMETABLE_TABS.map((k) => [k, groups.filter((g) => timetableTab(g.days) === k).length])) as Record<TimetableTab, number>, [groups]);
  const shown = groups.filter((g) => timetableTab(g.days) === tab);
  const rooms = [...new Set(shown.map((g) => g.roomName ?? ""))].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, undefined, { numeric: true })));
  const times = [...new Set(shown.map((g) => g.startTime))].sort();

  // Gorizontal (vaqt chizig'i): 30 daqiqalik ustunlar, har bir dars o'z davomiyligicha bir necha ustunni
  // egallaydi (colSpan) — modme-uslubidagi taqvim ko'rinishi. Vertikal — sodda ro'yxat (o'zgarmadi).
  // Ro'yxat har renderda qayta hisoblanadi (`shown` filtrlash natijasi — o'zi ham har safar yangi massiv,
  // shuning uchun `useMemo`ning foydasi yo'q); guruhlar soni kichik, hisoblash arzon.
  // Katta bo'sh oraliqlar (masalan 10:30–15:00 orasida hech narsa yo'q) butunlay olib tashlanadi — har bir
  // darsning boshlanishidan ~1 soat oldin va tugashidan ~1 soat keyingi vaqt saqlanadi, xolos.
  const slotMinutes: number[] = [];
  if (horizontal && shown.length > 0) {
    const starts = shown.map((g) => toMinutes(g.startTime));
    const ends = shown.map((g) => toMinutes(g.startTime) + g.durationMinutes);
    const from = Math.floor(Math.min(...starts) / 30) * 30;
    const to = Math.ceil(Math.max(...ends) / 30) * 30;
    const all: number[] = [];
    for (let m = from; m < to; m += 30) all.push(m);
    const BUFFER = 60; // daqiqa
    const near = (m: number) => shown.some((g) => {
      const s = toMinutes(g.startTime);
      return m >= s - BUFFER && m < s + g.durationMinutes + BUFFER;
    });
    slotMinutes.push(...all.filter(near));
  }

  /** Bitta xona qatori: har bir 30 daq. slot — yo bo'sh (colSpan 1), yo dars boshlanish nuqtasi (colSpan = davomiyligi / 30). */
  // `slotMinutes`da katta oraliqlar olib tashlangani uchun ba'zi qo'shni ustunlar orasida real vaqt sakrab
  // qolishi mumkin — shu joyga vizual belgi (uzuq chegara) qo'yiladi, aks holda "10:30"dan keyin bevosita
  // "15:00" kelishi tushunarsiz bo'lib qolardi.
  const isTimeJump = (i: number) => i > 0 && slotMinutes[i] - slotMinutes[i - 1] > 30;

  const segmentsFor = (room: string) => {
    const segments: ({ kind: "lesson"; group: ScheduleGroup; span: number; colStart: number } | { kind: "gap"; colStart: number })[] = [];
    let col = 0;
    while (col < slotMinutes.length) {
      const slotStart = slotMinutes[col];
      const group = shown.find((g) => (g.roomName ?? "") === room && toMinutes(g.startTime) >= slotStart && toMinutes(g.startTime) < slotStart + 30);
      if (group) {
        const span = Math.min(Math.max(1, Math.round(group.durationMinutes / 30)), slotMinutes.length - col);
        segments.push({ kind: "lesson", group, span, colStart: col });
        col += span;
      } else {
        segments.push({ kind: "gap", colStart: col });
        col += 1;
      }
    }
    return segments;
  };

  // Vertikal rejim uchun (o'zgarmagan): qatorlar — vaqt, ustunlar — xona.
  const rows = times;
  const cols = rooms;
  const cell = (time: string, room: string) => shown.filter((g) => g.startTime === time && (g.roomName ?? "") === room);

  const lessonCard = (g: ScheduleGroup) => (
    <Link
      key={g.id}
      href={`/groups/${g.id}`}
      className="hover:bg-muted/50 block h-full rounded-md border-l-4 border py-1.5 pr-2 pl-2.5 transition-colors"
      style={{ borderLeftColor: g.courseColor, backgroundColor: `color-mix(in srgb, ${g.courseColor} 16%, var(--card))` }}
    >
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
  );

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
        {/* Ikkita alohida tugma o'rniga bitta ikonka — "Toq/Juft/Boshqa" qatoriga qo'shilib, tugmalar
            ko'payib ketmasligi uchun (foydalanuvchi fikri bilan minimallashtirildi). */}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={horizontal ? t("vertical") : t("horizontal")}
          title={horizontal ? t("vertical") : t("horizontal")}
          onClick={() => setHorizontal(!horizontal)}
        >
          {horizontal ? <Rows3 className="size-4" /> : <Columns3 className="size-4" />}
        </Button>
      </div>

      {shown.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : horizontal ? (
        <div className="overflow-x-auto pb-4">
          <table className="w-full rounded-lg border border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="bg-[color-mix(in_srgb,var(--muted)_60%,var(--card))] text-muted-foreground sticky left-0 z-10 w-16 border-b p-2 text-left text-xs font-normal">{t("room")}</th>
                {slotMinutes.map((m, i) => (
                  <th
                    key={m}
                    className={cn(
                      "bg-[color-mix(in_srgb,var(--muted)_60%,var(--card))] text-muted-foreground min-w-20 border-b border-l p-2 text-left text-xs font-normal tabular-nums",
                      m % 60 === 0 && "text-foreground border-l-border/80 border-l-2 font-medium",
                      isTimeJump(i) && "border-l-2 border-dashed border-l-amber-500",
                    )}
                  >
                    {toTimeLabel(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room || "none"}>
                  <td className="bg-card sticky left-0 z-10 border-b p-2 text-xs font-medium">{room || t("noRoom")}</td>
                  {segmentsFor(room).map((seg, i) =>
                    seg.kind === "gap" ? (
                      <td key={i} className={cn("h-16 border-b border-l", isTimeJump(seg.colStart) && "border-l-2 border-dashed border-l-amber-500")} />
                    ) : (
                      <td
                        key={seg.group.id}
                        colSpan={seg.span}
                        className={cn("border-b border-l p-0.5 align-top", isTimeJump(seg.colStart) && "border-l-2 border-dashed border-l-amber-500")}
                      >
                        {lessonCard(seg.group)}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <table className="w-full rounded-lg border border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="bg-[color-mix(in_srgb,var(--muted)_60%,var(--card))] text-muted-foreground sticky left-0 z-10 w-16 border-b p-2 text-left text-xs font-normal">{t("time")}</th>
                {cols.map((c) => (
                  <th key={c || "none"} className="bg-[color-mix(in_srgb,var(--muted)_60%,var(--card))] min-w-44 border-b border-l p-2 text-left text-xs font-medium">
                    {c || t("noRoom")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row || "none"}>
                  <td className="bg-card text-muted-foreground sticky left-0 z-10 border-b p-2 text-xs font-medium tabular-nums">{row}</td>
                  {cols.map((col) => (
                    <td key={col || "none"} className="h-16 border-b border-l p-0.5 align-top">
                      <div className="flex h-full flex-col gap-1">{cell(row, col).map((g) => lessonCard(g))}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
