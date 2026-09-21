import ExcelJS from "exceljs";
import { getTranslations } from "next-intl/server";
import { CONVERSION_GROUPINGS, LOG_KEYS, REPORT_KEYS, type ReportKey } from "@markazai/types";
import { prisma } from "@markazai/db";
import { resolveRange } from "@/lib/date-range";
import { canAccess, isTeacherOnly } from "@/lib/permissions";
import type { RawSearchParams } from "@/lib/search-params";
import { getSessionUser } from "@/lib/session";
import { visibleReports } from "../access";
import { listAttendance, listCallLog, listChurn, listLeadsReport, listRating, listSmsLog, loadConversion } from "../queries";

// exceljs Node API'lariga tayanadi.
export const runtime = "nodejs";

type Cell = string | number | null;
type Col = { header: string; key: string; width: number; fmt?: string };

/** Excel (.xlsx) eksport: joriy hisobot va filtrlar bilan. Ruxsat — sahifadagi bilan bir xil (`visibleReports`). */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { roles } = user;
  if (!canAccess(roles, "reports")) return new Response("Forbidden", { status: 403 });
  // Faqat-o'qituvchi uchun o'z guruhlari ko'lami: sahifadagi requireModule kabi Teacher yozuvini topamiz.
  if (isTeacherOnly(roles)) user.teacherId = (await prisma.teacher.findFirst({ where: { organizationId: user.orgId, userId: user.id }, select: { id: true } }))?.id;

  const sp: RawSearchParams = Object.fromEntries(new URL(request.url).searchParams.entries());
  const report = REPORT_KEYS.find((k) => k === sp.report) as ReportKey | undefined;
  if (!report) return new Response("Bad request", { status: 400 });
  if (!visibleReports(roles).includes(report)) return new Response("Forbidden", { status: 403 });

  const range = resolveRange(sp);
  const [t, tc, te, tcalls] = await Promise.all([getTranslations("reports"), getTranslations("reports.columns"), getTranslations("enums"), getTranslations("calls")]);
  const iso = (d: string | null) => (d ? d.slice(0, 10) : "");
  const dt = (d: string) => `${d.slice(0, 10)} ${new Date(d).toISOString().slice(11, 16)}`;
  const pct = (v: number | null): Cell => (v === null ? null : v / 100);

  let columns: Col[] = [];
  let rows: Record<string, Cell>[] = [];
  let sheetName = t(`tabs.${report}`);

  if (report === "rating") {
    const list = await listRating(user, sp, range, { all: true });
    columns = [
      { header: tc("rank"), key: "rank", width: 8 },
      { header: tc("student"), key: "student", width: 28 },
      { header: tc("groups"), key: "groups", width: 28 },
      { header: tc("avgScore"), key: "avg", width: 14 },
      { header: tc("grades"), key: "grades", width: 12 },
      { header: tc("attendance"), key: "att", width: 12, fmt: "0.0%" },
    ];
    rows = list.rows.map((r) => ({ rank: r.rank, student: r.name, groups: r.groups.join(", "), avg: r.avgScore, grades: r.gradesCount, att: pct(r.attendancePct) }));
  } else if (report === "attendance") {
    const list = await listAttendance(user, sp, range, { all: true });
    columns = [
      { header: tc("group"), key: "group", width: 16 },
      { header: tc("course"), key: "course", width: 22 },
      { header: tc("teacher"), key: "teacher", width: 24 },
      { header: tc("lessons"), key: "lessons", width: 10 },
      { header: tc("present"), key: "present", width: 10 },
      { header: tc("absent"), key: "absent", width: 10 },
      { header: tc("excused"), key: "excused", width: 10 },
      { header: tc("attendance"), key: "pct", width: 12, fmt: "0.0%" },
    ];
    rows = list.rows.map((r) => ({ group: r.name, course: r.courseName, teacher: r.teacherName, lessons: r.lessons, present: r.present, absent: r.absent, excused: r.excused, pct: pct(r.pct) }));
  } else if (report === "conversion") {
    const grouping = CONVERSION_GROUPINGS.find((g) => g === sp.by) ?? "source";
    const data = await loadConversion(user, sp, range, grouping);
    sheetName = `${t("tabs.conversion")} · ${t(`conversion.by.${grouping}`)}`;
    columns = [
      { header: t(`conversion.by.${grouping}`), key: "key", width: 26 },
      { header: t("conversion.leads"), key: "leads", width: 10 },
      { header: t("conversion.convertedCount"), key: "converted", width: 16 },
      { header: t("conversion.rate"), key: "rate", width: 12, fmt: "0.0%" },
      { header: t("conversion.paid"), key: "paid", width: 14 },
      { header: t("conversion.paidRate"), key: "paidRate", width: 16, fmt: "0.0%" },
    ];
    rows = data.rows.map((r) => ({
      key: r.key === null ? (grouping === "source" ? t("conversion.noSource") : grouping === "course" ? t("conversion.noCourse") : t("conversion.unassigned")) : grouping === "source" ? te(`leadSource.${r.key as "OTHER"}`) : (r.name ?? ""),
      leads: r.leads,
      converted: r.converted,
      rate: pct(r.rate),
      paid: r.paid,
      paidRate: pct(r.paidRate),
    }));
  } else if (report === "leads") {
    const list = await listLeadsReport(user, sp, range, { all: true });
    columns = [
      { header: tc("name"), key: "name", width: 26 },
      { header: tc("phone"), key: "phone", width: 18 },
      { header: tc("source"), key: "source", width: 14 },
      { header: tc("stage"), key: "stage", width: 18 },
      { header: tc("course"), key: "course", width: 22 },
      { header: tc("assignee"), key: "assignee", width: 22 },
      { header: tc("created"), key: "created", width: 12 },
      { header: tc("converted"), key: "converted", width: 14 },
    ];
    rows = list.rows.map((r) => ({ name: r.name, phone: `+${r.phone}`, source: r.source ? te(`leadSource.${r.source as "OTHER"}`) : "", stage: r.stage, course: r.course ?? "", assignee: r.assignee ?? "", created: iso(r.createdAt), converted: r.converted ? t("leads.yes") : t("leads.no") }));
  } else if (report === "churn") {
    const list = await listChurn(user, sp, range, { all: true });
    columns = [
      { header: tc("student"), key: "student", width: 28 },
      { header: tc("phone"), key: "phone", width: 18 },
      { header: tc("group"), key: "group", width: 16 },
      { header: tc("teacher"), key: "teacher", width: 24 },
      { header: tc("joined"), key: "joined", width: 12 },
      { header: tc("left"), key: "left", width: 12 },
      { header: tc("days"), key: "days", width: 8 },
      { header: tc("status"), key: "status", width: 22 },
      { header: tc("balance"), key: "balance", width: 14, fmt: "#,##0" },
    ];
    rows = list.rows.map((r) => ({ student: r.name, phone: `+${r.phone}`, group: r.groupName, teacher: r.teacherName, joined: r.joinedAt, left: r.leftAt, days: r.days, status: te(`studentStatus.${r.status as "ACTIVE"}`), balance: r.balance }));
  } else {
    const log = LOG_KEYS.find((k) => k === sp.log) ?? "calls";
    if (log === "workly") return new Response("Bad request", { status: 400 });
    sheetName = `${t("tabs.logs")} · ${t(`logs.${log}`)}`;
    if (log === "calls") {
      const list = await listCallLog(user, sp, range, { all: true });
      columns = [
        { header: tc("date"), key: "date", width: 18 },
        { header: tc("who"), key: "who", width: 26 },
        { header: tc("phone"), key: "phone", width: 18 },
        { header: tc("direction"), key: "direction", width: 12 },
        { header: tc("outcome"), key: "outcome", width: 16 },
        { header: tc("duration"), key: "duration", width: 14 },
        { header: tc("note"), key: "note", width: 36 },
        { header: tc("staff"), key: "staff", width: 22 },
      ];
      rows = list.rows.map((r) => ({
        date: dt(r.at),
        who: r.who,
        phone: r.phone ? `+${r.phone}` : "",
        direction: te(`callDirection.${r.direction as "OUTGOING"}`),
        outcome: te(`callOutcome.${r.outcome as "ANSWERED"}`),
        duration: r.durationSeconds ? tcalls("minutes", { count: Math.max(1, Math.round(r.durationSeconds / 60)) }) : "",
        note: r.note ?? "",
        staff: r.staff ?? "",
      }));
    } else {
      const list = await listSmsLog(user, sp, range, { all: true });
      columns = [
        { header: tc("date"), key: "date", width: 18 },
        { header: tc("who"), key: "who", width: 26 },
        { header: tc("phone"), key: "phone", width: 18 },
        { header: tc("text"), key: "text", width: 50 },
        { header: tc("status"), key: "status", width: 14 },
        { header: tc("provider"), key: "provider", width: 14 },
        { header: tc("staff"), key: "staff", width: 22 },
      ];
      rows = list.rows.map((r) => ({ date: dt(r.at), who: r.who, phone: r.phone ? `+${r.phone}` : "", text: r.text, status: te(`smsStatus.${r.status as "SENT"}`), provider: r.provider, staff: r.staff ?? "" }));
    }
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Markazai";
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  columns.forEach((c, i) => {
    if (c.fmt) sheet.getColumn(i + 1).numFmt = c.fmt;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="markazai-report-${report}-${range.from}_${range.to}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
