"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { FileSpreadsheet, Printer } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { DataTable, type AnyColumnDef } from "@/components/data-table/data-table";
import { ExpandableText } from "@/components/shared/expandable-text";
import { Money } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, formatPhone } from "@/lib/format";
import type { AttendanceRow, CallLogRow, ChurnRow, CoinRow, LeadReportRow, RatingRow, SmsLogRow } from "./queries";

type TableProps<R> = { rows: R[]; total: number; page: number; pageSize: number; sort?: { key: string; dir: "asc" | "desc" } };

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
const col = (label: string, sortKey?: string, className?: string) => ({ header: label, meta: { label, sortKey, className } });

/** Excel — joriy hisobot va filtrlar bilan serverdan .xlsx; PDF — brauzerning chop etish oynasi. */
export function ExportButtons({ report }: { report: string }) {
  const t = useTranslations("reports.export");
  const searchParams = useSearchParams();
  const qs = new URLSearchParams(searchParams.toString());
  qs.set("report", report);
  qs.delete("page");
  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/reports/export?${qs.toString()}`} download />}>
        <FileSpreadsheet className="size-4" />
        {t("excel")}
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="size-4" />
        {t("pdf")}
      </Button>
    </div>
  );
}

export function RatingTable(props: TableProps<RatingRow>) {
  const t = useTranslations("reports.columns");
  const columns = useMemo<AnyColumnDef<RatingRow>[]>(
    () => [
      { id: "rank", ...col(t("rank"), "rank", "w-16"), cell: ({ row }) => <span className="font-semibold tabular-nums">{row.original.rank}</span> },
      {
        id: "student",
        ...col(t("student"), "name"),
        cell: ({ row }) => (
          <Link href={`/students/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      { id: "groups", ...col(t("groups")), cell: ({ row }) => (row.original.groups.length ? row.original.groups.join(", ") : "—") },
      { id: "avg", ...col(t("avgScore"), "avg", "text-right"), cell: ({ row }) => <span className="font-medium tabular-nums">{row.original.avgScore}</span> },
      { id: "grades", ...col(t("grades"), "grades", "text-right"), cell: ({ row }) => <span className="tabular-nums">{row.original.gradesCount}</span> },
      { id: "attendance", ...col(t("attendance"), "attendance", "text-right"), cell: ({ row }) => <span className="tabular-nums">{pct(row.original.attendancePct)}</span> },
    ],
    [t],
  );
  return <DataTable columns={columns} data={props.rows} total={props.total} page={props.page} pageSize={props.pageSize} sort={props.sort} getRowId={(r) => r.id} storageKey="report-rating" />;
}

export function CoinsTable(props: TableProps<CoinRow>) {
  const t = useTranslations("reports.columns");
  const columns = useMemo<AnyColumnDef<CoinRow>[]>(
    () => [
      { id: "rank", ...col(t("rank"), "rank", "w-16"), cell: ({ row }) => <span className="font-semibold tabular-nums">{row.original.rank}</span> },
      {
        id: "student",
        ...col(t("student"), "name"),
        cell: ({ row }) => (
          <Link href={`/students/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      { id: "groups", ...col(t("groups")), cell: ({ row }) => (row.original.groups.length ? row.original.groups.join(", ") : "—") },
      { id: "attendance", ...col(t("coinsAttendance"), "attendance", "text-right"), cell: ({ row }) => <span className="tabular-nums">{row.original.attendance}</span> },
      { id: "manual", ...col(t("coinsManual"), "manual", "text-right"), cell: ({ row }) => <span className="tabular-nums">{row.original.manual}</span> },
      { id: "total", ...col(t("coinsTotal"), "total", "text-right"), cell: ({ row }) => <span className="font-semibold tabular-nums">{row.original.total}</span> },
    ],
    [t],
  );
  return <DataTable columns={columns} data={props.rows} total={props.total} page={props.page} pageSize={props.pageSize} sort={props.sort} getRowId={(r) => r.id} storageKey="report-coins" />;
}

export function AttendanceTable(props: TableProps<AttendanceRow>) {
  const t = useTranslations("reports.columns");
  const columns = useMemo<AnyColumnDef<AttendanceRow>[]>(
    () => [
      {
        id: "group",
        ...col(t("group"), "name"),
        cell: ({ row }) => (
          <Link href={`/groups/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      { id: "course", ...col(t("course")), cell: ({ row }) => row.original.courseName },
      { id: "teacher", ...col(t("teacher")), cell: ({ row }) => row.original.teacherName },
      { id: "lessons", ...col(t("lessons"), "lessons", "text-right"), cell: ({ row }) => <span className="tabular-nums">{row.original.lessons}</span> },
      { id: "present", ...col(t("present"), "present", "text-right"), cell: ({ row }) => <span className="tabular-nums">{row.original.present}</span> },
      { id: "absent", ...col(t("absent"), "absent", "text-right"), cell: ({ row }) => <span className="tabular-nums">{row.original.absent}</span> },
      { id: "excused", ...col(t("excused"), undefined, "text-right"), cell: ({ row }) => <span className="tabular-nums">{row.original.excused}</span> },
      { id: "pct", ...col(t("attendance"), "pct", "text-right"), cell: ({ row }) => <span className="font-medium tabular-nums">{pct(row.original.pct)}</span> },
    ],
    [t],
  );
  return <DataTable columns={columns} data={props.rows} total={props.total} page={props.page} pageSize={props.pageSize} sort={props.sort} getRowId={(r) => r.id} storageKey="report-attendance" />;
}

export function LeadsReportTable(props: TableProps<LeadReportRow>) {
  const t = useTranslations("reports.columns");
  const te = useTranslations("enums");
  const tr = useTranslations("reports.leads");
  const columns = useMemo<AnyColumnDef<LeadReportRow>[]>(
    () => [
      {
        id: "name",
        ...col(t("name"), "name"),
        cell: ({ row }) => (
          <Link href={`/leads/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      { id: "phone", ...col(t("phone")), cell: ({ row }) => <span className="whitespace-nowrap">{formatPhone(row.original.phone)}</span> },
      { id: "source", ...col(t("source")), cell: ({ row }) => (row.original.source ? te(`leadSource.${row.original.source as "OTHER"}`) : "—") },
      { id: "stage", ...col(t("stage")), cell: ({ row }) => <Badge variant="outline">{row.original.stage}</Badge> },
      { id: "course", ...col(t("course")), cell: ({ row }) => row.original.course ?? "—" },
      { id: "assignee", ...col(t("assignee")), cell: ({ row }) => row.original.assignee ?? "—" },
      { id: "created", ...col(t("created"), "createdAt"), cell: ({ row }) => formatDate(row.original.createdAt) },
      { id: "converted", ...col(t("converted")), cell: ({ row }) => (row.original.converted ? <Badge>{tr("yes")}</Badge> : <span className="text-muted-foreground">{tr("no")}</span>) },
    ],
    [t, te, tr],
  );
  return <DataTable columns={columns} data={props.rows} total={props.total} page={props.page} pageSize={props.pageSize} sort={props.sort} getRowId={(r) => r.id} storageKey="report-leads" />;
}

export function ChurnTable(props: TableProps<ChurnRow> & { showBalance: boolean }) {
  const t = useTranslations("reports.columns");
  const te = useTranslations("enums");
  const columns = useMemo<AnyColumnDef<ChurnRow>[]>(
    () => [
      {
        id: "student",
        ...col(t("student"), "name"),
        cell: ({ row }) => (
          <Link href={`/students/${row.original.studentId}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      { id: "phone", ...col(t("phone")), cell: ({ row }) => <span className="whitespace-nowrap">{formatPhone(row.original.phone)}</span> },
      { id: "group", ...col(t("group")), cell: ({ row }) => row.original.groupName },
      { id: "teacher", ...col(t("teacher")), cell: ({ row }) => row.original.teacherName },
      { id: "joined", ...col(t("joined")), cell: ({ row }) => formatDate(row.original.joinedAt) },
      { id: "left", ...col(t("left"), "leftAt"), cell: ({ row }) => formatDate(row.original.leftAt) },
      { id: "days", ...col(t("days"), "days", "text-right"), cell: ({ row }) => <span className="tabular-nums">{row.original.days}</span> },
      { id: "status", ...col(t("status")), cell: ({ row }) => <Badge variant="outline">{te(`studentStatus.${row.original.status as "ACTIVE"}`)}</Badge> },
      ...(props.showBalance ? [{ id: "balance", ...col(t("balance"), "balance", "text-right"), cell: ({ row }: { row: { original: ChurnRow } }) => <Money value={row.original.balance} /> }] : []),
    ],
    [t, te, props.showBalance],
  );
  return <DataTable columns={columns} data={props.rows} total={props.total} page={props.page} pageSize={props.pageSize} sort={props.sort} getRowId={(r) => r.id} storageKey="report-churn" />;
}

function WhoCell({ kind, refId, name, phone }: { kind: "lead" | "student"; refId: string; name: string; phone: string }) {
  const t = useTranslations("reports.logs");
  return (
    <div className="flex flex-col">
      {refId ? (
        <Link href={kind === "lead" ? `/leads/${refId}` : `/students/${refId}`} className="font-medium hover:underline">
          {name}
        </Link>
      ) : (
        <span className="font-medium">{name}</span>
      )}
      <span className="text-muted-foreground text-xs whitespace-nowrap">
        {kind === "lead" ? t("lead") : t("student")}
        {phone && ` · ${formatPhone(phone)}`}
      </span>
    </div>
  );
}

export function CallsTable(props: TableProps<CallLogRow>) {
  const t = useTranslations("reports.columns");
  const te = useTranslations("enums");
  const tcalls = useTranslations("calls");
  const columns = useMemo<AnyColumnDef<CallLogRow>[]>(
    () => [
      { id: "date", ...col(t("date")), cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTime(row.original.at)}</span> },
      { id: "who", ...col(t("who")), cell: ({ row }) => <WhoCell kind={row.original.kind} refId={row.original.refId} name={row.original.who} phone={row.original.phone} /> },
      { id: "direction", ...col(t("direction")), cell: ({ row }) => te(`callDirection.${row.original.direction as "OUTGOING"}`) },
      { id: "outcome", ...col(t("outcome")), cell: ({ row }) => <Badge variant="outline">{te(`callOutcome.${row.original.outcome as "ANSWERED"}`)}</Badge> },
      { id: "duration", ...col(t("duration"), undefined, "text-right"), cell: ({ row }) => (row.original.durationSeconds ? <span className="tabular-nums">{tcalls("minutes", { count: Math.max(1, Math.round(row.original.durationSeconds / 60)) })}</span> : "—") },
      { id: "note", ...col(t("note")), cell: ({ row }) => (row.original.note ? <ExpandableText text={row.original.note} /> : "—") },
      { id: "staff", ...col(t("staff")), cell: ({ row }) => row.original.staff ?? "—" },
    ],
    [t, te, tcalls],
  );
  return <DataTable columns={columns} data={props.rows} total={props.total} page={props.page} pageSize={props.pageSize} getRowId={(r) => r.id} storageKey="report-calls" />;
}

export function SmsTable(props: TableProps<SmsLogRow>) {
  const t = useTranslations("reports.columns");
  const te = useTranslations("enums");
  const columns = useMemo<AnyColumnDef<SmsLogRow>[]>(
    () => [
      { id: "date", ...col(t("date")), cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTime(row.original.at)}</span> },
      { id: "who", ...col(t("who")), cell: ({ row }) => <WhoCell kind={row.original.kind} refId={row.original.refId} name={row.original.who} phone={row.original.phone} /> },
      { id: "text", ...col(t("text")), cell: ({ row }) => <ExpandableText text={row.original.text} /> },
      { id: "status", ...col(t("status")), cell: ({ row }) => <Badge variant="outline">{te(`smsStatus.${row.original.status as "SENT"}`)}</Badge> },
      { id: "provider", ...col(t("provider")), cell: ({ row }) => row.original.provider },
      { id: "staff", ...col(t("staff")), cell: ({ row }) => row.original.staff ?? "—" },
    ],
    [t, te],
  );
  return <DataTable columns={columns} data={props.rows} total={props.total} page={props.page} pageSize={props.pageSize} getRowId={(r) => r.id} storageKey="report-sms" />;
}
