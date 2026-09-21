import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { isPeriod, periodBounds, toCenterParts, toISODate } from "@markazai/types";
import { prisma } from "@markazai/db";
import { MonthNav } from "@/components/shared/month-nav";
import { can } from "@/lib/permissions";
import { loadPayrolls } from "@/lib/payroll";
import { param } from "@/lib/search-params";
import { requireModule } from "@/lib/session";
import { cn } from "@/lib/utils";
import { TeacherAttendanceGrid } from "./attendance-grid";
import { PayrollTable } from "./payroll-table";
import { ScheduleTable } from "./schedule-table";

const TABS = ["attendance", "schedule", "payroll"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("teacherAttendance");
  return { title: t("title") };
}

export default async function TeacherAttendancePage({ searchParams }: PageProps<"/teacher-attendance">) {
  const user = await requireModule("teachers");
  const sp = await searchParams;
  const t = await getTranslations("teacherAttendance");

  const canWrite = can(user.roles, "teachers:write");
  const canSalary = can(user.roles, "salary:read");
  const available = TABS.filter((k) => k !== "payroll" || canSalary);
  const requested = param(sp, "tab");
  const tab: Tab = (available as readonly string[]).includes(requested ?? "") ? (requested as Tab) : "attendance";

  const today = toCenterParts(new Date()).date;
  const monthParam = param(sp, "month");
  const period = isPeriod(monthParam) ? monthParam : today.slice(0, 7);
  const { from, to } = periodBounds(period);

  const days: string[] = [];
  for (let d = from.getTime(); d <= to.getTime(); d += 86_400_000) days.push(toISODate(new Date(d)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-muted-foreground text-sm print:hidden">
          <Link href="/teachers" className="hover:underline">
            {t("teachers")}
          </Link>{" "}
          / {t("title")}
        </div>
      </div>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="bg-muted inline-flex w-fit flex-wrap gap-1 rounded-lg p-1" aria-label={t("title")}>
          {available.map((k) => (
            <Link
              key={k}
              href={`/teacher-attendance?tab=${k}&month=${period}`}
              aria-current={k === tab ? "page" : undefined}
              className={cn("text-muted-foreground hover:text-foreground rounded-md px-3 py-1 text-sm transition-colors", k === tab && "bg-background text-foreground shadow-xs")}
            >
              {t(`tabs.${k}`)}
            </Link>
          ))}
        </nav>
        {tab !== "schedule" && <MonthNav period={period} />}
      </div>

      {tab === "attendance" && <AttendanceSection orgId={user.orgId} period={period} days={days} from={from} to={to} today={today} canEdit={canWrite} />}
      {tab === "schedule" && <ScheduleSection orgId={user.orgId} canWrite={canWrite} canSalary={canSalary} />}
      {tab === "payroll" && canSalary && <PayrollTable rows={await loadPayrolls(user.orgId, period)} />}
    </div>
  );
}

async function AttendanceSection({ orgId, period, days, from, to, today, canEdit }: { orgId: string; period: string; days: string[]; from: Date; to: Date; today: string; canEdit: boolean }) {
  const [teachers, records] = await Promise.all([
    prisma.teacher.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.teacherAttendance.findMany({ where: { organizationId: orgId, date: { gte: from, lte: to } }, select: { teacherId: true, date: true, status: true } }),
  ]);
  const withRecords = new Set(records.map((r) => r.teacherId));
  // Ish jadvali sozlangan yoki shu oyda davomat belgilangan o'qituvchilar ko'rsatiladi.
  const shown = teachers.filter((t) => t.workDays.length > 0 || withRecords.has(t.id));

  return (
    <TeacherAttendanceGrid
      period={period}
      days={days}
      today={today}
      canEdit={canEdit}
      teachers={shown.map((t) => ({ id: t.id, name: t.name, workDays: t.workDays, workStartDate: t.workStartDate ? toISODate(t.workStartDate) : null }))}
      records={records.map((r) => ({ teacherId: r.teacherId, date: toISODate(r.date), status: r.status }))}
    />
  );
}

async function ScheduleSection({ orgId, canWrite, canSalary }: { orgId: string; canWrite: boolean; canSalary: boolean }) {
  const teachers = await prisma.teacher.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { name: "asc" } });
  return (
    <ScheduleTable
      canWrite={canWrite}
      canSalary={canSalary}
      teachers={teachers.map((t) => ({
        id: t.id,
        name: t.name,
        salaryType: t.salaryType,
        workDays: t.workDays,
        workStart: t.workStart,
        workEnd: t.workEnd,
        fixedSalary: canSalary ? t.fixedSalary : null,
        workStartDate: t.workStartDate ? toISODate(t.workStartDate) : null,
      }))}
    />
  );
}

