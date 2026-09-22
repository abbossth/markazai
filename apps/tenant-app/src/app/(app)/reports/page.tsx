import type { Metadata } from "next";
import { gamificationActive } from "@/lib/plan";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CONVERSION_GROUPINGS, LOG_KEYS, type LogKey, type ReportKey } from "@markazai/types";
import { FilterBar, type FilterField } from "@/components/data-table/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { resolveRange } from "@/lib/date-range";
import { canAccess } from "@/lib/permissions";
import { param, type RawSearchParams } from "@/lib/search-params";
import { requireModule, type SessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { RangePresets } from "../finance/range-presets";
import { visibleReports } from "./access";
import { ConversionSection } from "./conversion-section";
import { prisma } from "@markazai/db";
import { PAGE_SIZE, listAttendance, listCallLog, listChurn, listCoins, listLeadsReport, listRating, listSmsLog, loadReportLookups, type ReportLookups } from "./queries";
import { AttendanceTable, CallsTable, ChurnTable, CoinsTable, ExportButtons, LeadsReportTable, RatingTable, SmsTable } from "./report-tables";
import { SummaryTiles } from "./summary-tiles";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("reports") };
}

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const user = await requireModule("reports");
  const sp = await searchParams;
  const t = await getTranslations("reports");
  const gamification = await gamificationActive((await prisma.centerSettings.findUnique({ where: { organizationId: user.orgId }, select: { gamificationEnabled: true } }))?.gamificationEnabled);
  const tabs = visibleReports(user.roles, gamification);
  const requested = param(sp, "report");
  const report: ReportKey | undefined = tabs.find((k) => k === requested) ?? tabs[0];
  const range = resolveRange(sp);
  const lookups = await loadReportLookups(user);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <nav className="bg-muted inline-flex w-fit flex-wrap gap-1 rounded-lg p-1 print:hidden" aria-label={t("title")}>
        {tabs.map((k) => (
          <Link
            key={k}
            href={`/reports?report=${k}`}
            aria-current={k === report ? "page" : undefined}
            className={cn("text-muted-foreground hover:text-foreground rounded-md px-3 py-1 text-sm transition-colors", k === report && "bg-background text-foreground shadow-xs")}
          >
            {t(`tabs.${k}`)}
          </Link>
        ))}
      </nav>

      {!report ? (
        <EmptyState title={t("logs.empty")} />
      ) : (
        <>
          <div className="print:hidden">
            <RangePresets from={range.from} to={range.to} today={range.today} />
          </div>
          {report === "rating" && <RatingSection user={user} sp={sp} lookups={lookups} />}
          {report === "attendance" && <AttendanceSection user={user} sp={sp} lookups={lookups} />}
          {report === "conversion" && <ConversionSection user={user} sp={sp} grouping={CONVERSION_GROUPINGS.find((g) => g === param(sp, "by")) ?? "source"} />}
          {report === "leads" && <LeadsSection user={user} sp={sp} lookups={lookups} />}
          {report === "churn" && <ChurnSection user={user} sp={sp} lookups={lookups} />}
          {report === "logs" && <LogsSection user={user} sp={sp} />}
          {report === "coins" && <CoinsSection user={user} sp={sp} lookups={lookups} />}
        </>
      )}
    </div>
  );
}

type SectionProps = { user: SessionUser; sp: RawSearchParams };
type WithLookups = SectionProps & { lookups: ReportLookups };

async function dateFields() {
  const t = await getTranslations("reports");
  return [
    { name: "from", label: t("from"), type: "date" },
    { name: "to", label: t("to"), type: "date" },
  ] satisfies FilterField[];
}

/** Guruh/kurs/o'qituvchi filtrlari (o'qituvchi filtri faqat ko'lami cheklanmagan foydalanuvchilarga). */
async function groupFields(lookups: ReportLookups) {
  const t = await getTranslations("reports.columns");
  const fields: FilterField[] = [
    { name: "groupId", label: t("group"), type: "select", options: lookups.groups.map((g) => ({ value: g.id, label: g.name })) },
    { name: "courseId", label: t("course"), type: "select", options: lookups.courses.map((c) => ({ value: c.id, label: c.name })) },
  ];
  if (lookups.teachers.length) fields.push({ name: "teacherId", label: t("teacher"), type: "select", options: lookups.teachers.map((x) => ({ value: x.id, label: x.name })) });
  return fields;
}

async function RatingSection({ user, sp, lookups }: WithLookups) {
  const t = await getTranslations("reports");
  const list = await listRating(user, sp, resolveRange(sp));
  return (
    <>
      <p className="text-muted-foreground text-sm">{t("rating.hint")}</p>
      <FilterBar searchPlaceholder={t("search.student")} fields={[...(await dateFields()), ...(await groupFields(lookups))]} actions={<ExportButtons report="rating" />} />
      <RatingTable rows={list.rows} total={list.total} page={list.page} pageSize={PAGE_SIZE} sort={list.sort} />
    </>
  );
}

async function AttendanceSection({ user, sp, lookups }: WithLookups) {
  const t = await getTranslations("reports");
  const list = await listAttendance(user, sp, resolveRange(sp));
  const s = list.summary;
  return (
    <>
      <SummaryTiles
        items={[
          { label: t("attendance.groups"), value: String(s.groups) },
          { label: t("columns.present"), value: String(s.present) },
          { label: t("columns.absent"), value: String(s.absent) },
          { label: t("columns.excused"), value: String(s.excused) },
          { label: t("attendance.overall"), value: s.pct === null ? "—" : `${s.pct}%` },
        ]}
      />
      <p className="text-muted-foreground text-sm">{t("attendance.hint")}</p>
      <FilterBar searchPlaceholder="" hideSearch fields={[...(await dateFields()), ...(await groupFields(lookups))]} actions={<ExportButtons report="attendance" />} />
      <AttendanceTable rows={list.rows} total={list.total} page={list.page} pageSize={PAGE_SIZE} sort={list.sort} />
    </>
  );
}

async function LeadsSection({ user, sp, lookups }: WithLookups) {
  const t = await getTranslations("reports");
  const te = await getTranslations("enums");
  const tc = await getTranslations("reports.columns");
  const list = await listLeadsReport(user, sp, resolveRange(sp));
  const fields: FilterField[] = [
    ...(await dateFields()),
    { name: "source", label: tc("source"), type: "select", options: (["INSTAGRAM", "TELEGRAM", "FACEBOOK", "WEBSITE", "REFERRAL", "WALK_IN", "PHONE", "OTHER"] as const).map((v) => ({ value: v, label: te(`leadSource.${v}`) })) },
    { name: "columnId", label: tc("stage"), type: "select", options: lookups.columns.map((c) => ({ value: c.id, label: c.name })) },
    { name: "courseId", label: tc("course"), type: "select", options: lookups.courses.map((c) => ({ value: c.id, label: c.name })) },
    { name: "assignedToId", label: tc("assignee"), type: "select", options: lookups.staff.map((u) => ({ value: u.id, label: u.name })) },
    { name: "converted", label: t("leads.converted"), type: "select", options: [{ value: "yes", label: t("leads.yes") }, { value: "no", label: t("leads.no") }] },
  ];
  return (
    <>
      <SummaryTiles items={[{ label: t("leads.total"), value: String(list.total) }, ...list.stages.map((s) => ({ label: s.name, value: String(s.count) }))]} />
      <FilterBar searchPlaceholder={t("search.lead")} fields={fields} actions={<ExportButtons report="leads" />} />
      <LeadsReportTable rows={list.rows} total={list.total} page={list.page} pageSize={PAGE_SIZE} sort={list.sort} />
    </>
  );
}

async function CoinsSection({ user, sp, lookups }: WithLookups) {
  const t = await getTranslations("reports");
  const list = await listCoins(user, sp, resolveRange(sp));
  return (
    <>
      <p className="text-muted-foreground text-sm">{t("coins.hint")}</p>
      <FilterBar searchPlaceholder={t("search.student")} fields={[...(await dateFields()), ...(await groupFields(lookups))]} actions={<ExportButtons report="coins" />} />
      <CoinsTable rows={list.rows} total={list.total} page={list.page} pageSize={PAGE_SIZE} sort={list.sort} />
    </>
  );
}

async function ChurnSection({ user, sp, lookups }: WithLookups) {
  const t = await getTranslations("reports");
  const list = await listChurn(user, sp, resolveRange(sp));
  return (
    <>
      <SummaryTiles items={[{ label: t("churn.count"), value: String(list.summary.count) }, { label: t("churn.avgDays"), value: list.summary.avgDays === null ? "—" : String(list.summary.avgDays) }]} />
      <p className="text-muted-foreground text-sm">{t("churn.hint")}</p>
      <FilterBar searchPlaceholder={t("search.student")} fields={[...(await dateFields()), ...(await groupFields(lookups))]} actions={<ExportButtons report="churn" />} />
      <ChurnTable rows={list.rows} total={list.total} page={list.page} pageSize={PAGE_SIZE} sort={list.sort} showBalance={canAccess(user.roles, "students")} />
    </>
  );
}

async function LogsSection({ user, sp }: SectionProps) {
  const t = await getTranslations("reports");
  const te = await getTranslations("enums");
  const tc = await getTranslations("reports.columns");
  const log: LogKey = LOG_KEYS.find((k) => k === param(sp, "log")) ?? "calls";
  const range = resolveRange(sp);

  // Ichki tab: qidiruv/filtr parametrlari almashganda saqlanmaydi (har tab o'z filtriga ega).
  const nav = (
    <nav className="inline-flex w-fit gap-1 print:hidden" aria-label={t("tabs.logs")}>
      {LOG_KEYS.map((k) => (
        <Link key={k} href={`/reports?report=logs&log=${k}`} aria-current={k === log ? "page" : undefined} className={cn("text-muted-foreground hover:text-foreground rounded-md border px-3 py-1 text-sm", k === log && "bg-secondary text-foreground")}>
          {t(`logs.${k}`)}
        </Link>
      ))}
    </nav>
  );

  if (log === "workly") {
    return (
      <>
        {nav}
        <EmptyState title={t("logs.worklyTitle")} hint={t("logs.worklyHint")} />
      </>
    );
  }

  const dates = await dateFields();
  if (log === "calls") {
    const list = await listCallLog(user, sp, range);
    const fields: FilterField[] = [
      ...dates,
      { name: "direction", label: tc("direction"), type: "select", options: (["OUTGOING", "INCOMING"] as const).map((v) => ({ value: v, label: te(`callDirection.${v}`) })) },
      { name: "outcome", label: tc("outcome"), type: "select", options: (["ANSWERED", "NO_ANSWER", "BUSY", "WRONG_NUMBER"] as const).map((v) => ({ value: v, label: te(`callOutcome.${v}`) })) },
    ];
    return (
      <>
        {nav}
        <FilterBar searchPlaceholder={t("search.log")} fields={fields} actions={<ExportButtons report="logs" />} />
        <CallsTable rows={list.rows} total={list.total} page={list.page} pageSize={PAGE_SIZE} />
      </>
    );
  }

  const list = await listSmsLog(user, sp, range);
  const fields: FilterField[] = [...dates, { name: "status", label: t("logs.smsStatus"), type: "select", options: (["SENT", "FAILED", "MOCK"] as const).map((v) => ({ value: v, label: te(`smsStatus.${v}`) })) }];
  return (
    <>
      {nav}
      <FilterBar searchPlaceholder={t("search.log")} fields={fields} actions={<ExportButtons report="logs" />} />
      <SmsTable rows={list.rows} total={list.total} page={list.page} pageSize={PAGE_SIZE} />
    </>
  );
}
