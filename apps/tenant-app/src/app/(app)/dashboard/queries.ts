import { prisma, type Prisma } from "@markazai/db";
import {
  TRIAL_DAYS,
  WIDGETS,
  buildDailyTrend,
  buildMonthlyTrend,
  daysLeft,
  defaultLayout,
  fromISODate,
  isTrialOverdue,
  loadPercent,
  sanitizeLayout,
  toCenterParts,
  toISODate,
  type DaysPattern,
  type LayoutItem,
} from "@markazai/types";
import { canAccess, isTeacherOnly } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";

/** Foydalanuvchi ko'ra oladigan vidjetlar: vidjet talab qilgan modulga ruxsat bo'lsa. */
export function allowedWidgetIds(user: SessionUser): Set<string> {
  return new Set(WIDGETS.filter((w) => canAccess(user.roles, w.requires)).map((w) => w.id));
}

export type MetricValue = {
  value: number | null;
  /** "centerLoad" uchun: joylashtirilgan o'quvchilar va jami sig'im. `capacity: null` — hali kiritilmagan. */
  of?: { students: number; capacity: number | null };
  href: string;
};

export type ScheduleGroup = {
  id: string;
  name: string;
  courseName: string;
  courseColor: string;
  teacherName: string;
  roomName: string | null;
  capacity: number | null;
  students: number;
  days: DaysPattern;
  customDays: number[];
  startTime: string;
  durationMinutes: number;
  daysLeft: number | null;
};

/** Tushum va xarajat: `key` — oylik uchun "YYYY-MM", kunlik uchun "YYYY-MM-DD". */
export type TrendPoint = { key: string; revenue: number; expenses: number };

export type DashboardData = {
  generatedAt: string;
  today: string;
  metrics: Record<string, MetricValue>;
  payments: { monthly: TrendPoint[]; daily: TrendPoint[] } | null;
  schedule: ScheduleGroup[] | null;
};

export async function loadLayout(user: SessionUser): Promise<LayoutItem[]> {
  const allowed = allowedWidgetIds(user);
  const saved = await prisma.dashboardLayout.findUnique({ where: { userId: user.id } });
  return saved ? sanitizeLayout(saved.widgets, allowed) : defaultLayout(allowed);
}

/**
 * Dashboard ma'lumotlari. Faqat ruxsat etilgan vidjetlar uchun hisoblanadi (bo'lmagani serverdan chiqmaydi).
 * O'qituvchi roli uchun hamma ko'rsatkich faqat o'z guruhlari bo'yicha.
 */
export async function loadDashboard(user: SessionUser): Promise<DashboardData> {
  const allowed = allowedWidgetIds(user);
  const today = toCenterParts(new Date()).date;
  const monthStart = `${today.slice(0, 7)}-01`;
  const org = user.orgId;

  const teacherId = isTeacherOnly(user.roles) ? (user.teacherId ?? "none") : undefined;
  // Talaba/guruh so'rovlari uchun o'qituvchi doirasi.
  const studentScope: Prisma.StudentWhereInput = teacherId ? { enrollments: { some: { group: { teacherId } } } } : {};
  const groupScope: Prisma.GroupWhereInput = teacherId ? { teacherId } : {};
  const has = (id: string) => allowed.has(id);
  const range = { gte: fromISODate(monthStart), lte: fromISODate(today) };
  // To'lovlar grafigi — joriy oy emas, oxirgi 6 oy (joriy oy bilan birga): bitta oylik "qator" o'rniga
  // trend ko'rinadi (modme-uslubidagi dashboard'dan ilhomlanib — 2026-09-26).
  const [chartFromY, chartFromM] = (() => {
    const [y, m] = today.slice(0, 7).split("-").map(Number);
    const idx = y * 12 + (m - 1) - 5;
    return [Math.floor(idx / 12), (idx % 12) + 1];
  })();
  const chartFrom = `${chartFromY}-${String(chartFromM).padStart(2, "0")}-01`;
  const chartRange = { gte: fromISODate(chartFrom), lte: fromISODate(today) };

  const [activeStudents, groups, debtors, activeLeads, trial, paidThisMonth, leftActiveGroup, trialStudents, loadStudents, centerCapacity, paymentRows, expenseRows, scheduleGroups] = await Promise.all([
    has("activeStudents") ? prisma.student.count({ where: { organizationId: org, status: "ACTIVE", ...studentScope } }) : null,
    has("groups") ? prisma.group.count({ where: { organizationId: org, status: "ACTIVE", ...groupScope } }) : null,
    has("debtors") ? prisma.student.count({ where: { organizationId: org, balance: { lt: 0 } } }) : null,
    has("activeLeads") ? prisma.lead.count({ where: { organizationId: org, convertedStudentId: null, archivedAt: null } }) : null,
    has("trial") ? prisma.student.count({ where: { organizationId: org, status: "TRIAL", ...studentScope } }) : null,
    has("paidThisMonth")
      ? prisma.payment.findMany({ where: { organizationId: org, type: "MANUAL", amount: { gt: 0 }, date: range }, distinct: ["studentId"], select: { studentId: true } })
      : null,
    has("leftActiveGroup") ? prisma.student.count({ where: { organizationId: org, status: "LEFT_ACTIVE_GROUP", ...studentScope } }) : null,
    has("trialOverdue")
      ? prisma.student.findMany({
          where: { organizationId: org, status: "TRIAL", ...studentScope },
          select: { enrollments: { where: { leftAt: null, ...(teacherId && { group: { teacherId } }) }, select: { joinedAt: true } } },
        })
      : null,
    // Sig'im endi xonalardan emas, qo'lda kiritilgan qiymatdan olinadi (Sozlash → "Sig'imni kiritish") — shu
    // sabab bu yerda faqat FAOL o'quvchilar soni kerak, xona/sig'imi bo'lmagan guruhlar ham hisoblanadi.
    has("centerLoad") ? prisma.groupStudent.count({ where: { organizationId: org, leftAt: null, group: { status: "ACTIVE", ...groupScope } } }) : null,
    has("centerLoad") ? prisma.centerSettings.findUnique({ where: { organizationId: org }, select: { capacity: true } }) : null,
    has("paymentsChart") ? prisma.payment.groupBy({ by: ["date"], where: { organizationId: org, type: "MANUAL", date: chartRange }, _sum: { amount: true } }) : null,
    has("paymentsChart") ? prisma.expense.groupBy({ by: ["date"], where: { organizationId: org, date: chartRange }, _sum: { amount: true } }) : null,
    has("schedule")
      ? prisma.group.findMany({
          where: { organizationId: org, status: "ACTIVE", ...groupScope },
          orderBy: [{ startTime: "asc" }, { name: "asc" }],
          include: {
            course: { select: { name: true, color: true } },
            teacher: { select: { name: true } },
            room: { select: { name: true, capacity: true } },
            _count: { select: { enrollments: { where: { leftAt: null } } } },
          },
        })
      : null,
  ]);

  const metrics: Record<string, MetricValue> = {};
  const set = (id: string, value: number | null, href: string, of?: MetricValue["of"]) => {
    if (value !== null || of) metrics[id] = { value, href, ...(of && { of }) };
  };
  set("activeStudents", activeStudents, "/students?status=ACTIVE");
  set("groups", groups, "/groups?status=ACTIVE");
  set("debtors", debtors, "/finance?tab=debtors");
  set("activeLeads", activeLeads, "/leads");
  set("trial", trial, "/students?status=TRIAL");
  set("paidThisMonth", paidThisMonth ? paidThisMonth.length : null, "/students?finance=paidThisMonth");
  set("leftActiveGroup", leftActiveGroup, "/students?status=LEFT_ACTIVE_GROUP");
  set("trialOverdue", trialStudents ? trialStudents.filter((s) => s.enrollments.some((e) => isTrialOverdue(toISODate(e.joinedAt), today, TRIAL_DAYS))).length : null, "/students?status=TRIAL");
  if (loadStudents !== null) {
    const capacity = centerCapacity?.capacity ?? null;
    set("centerLoad", capacity ? loadPercent(loadStudents, capacity) : null, "/groups?status=ACTIVE", { students: loadStudents, capacity });
  }

  return {
    generatedAt: new Date().toISOString(),
    today,
    metrics,
    payments: paymentRows && expenseRows ? buildPaymentsTrend(paymentRows, expenseRows, chartFrom, monthStart, today) : null,
    schedule: scheduleGroups
      ? scheduleGroups.map((g) => ({
          id: g.id,
          name: g.name,
          courseName: g.course.name,
          courseColor: g.course.color,
          teacherName: g.teacher.name,
          roomName: g.room?.name ?? null,
          capacity: g.room?.capacity ?? null,
          students: g._count.enrollments,
          days: g.days,
          customDays: g.customDays,
          startTime: g.startTime,
          durationMinutes: g.durationMinutes,
          daysLeft: daysLeft(g.endDate ? toISODate(g.endDate) : null, today),
        }))
      : null,
  };
}

/** 6 oylik (oylik nuqtalar) va joriy oy (kunlik nuqtalar) tushum/xarajat; ma'lumot bo'lmasa ham nollar bilan to'liq qator. */
function buildPaymentsTrend(
  payments: { date: Date; _sum: { amount: number | null } }[],
  expenses: { date: Date; _sum: { amount: number | null } }[],
  chartFrom: string,
  monthStart: string,
  today: string,
): { monthly: TrendPoint[]; daily: TrendPoint[] } {
  const toMap = (rows: typeof payments) => new Map(rows.map((r) => [toISODate(r.date), r._sum.amount ?? 0]));
  const rev = toMap(payments);
  const exp = toMap(expenses);
  const revMonths = buildMonthlyTrend(chartFrom, today, rev);
  const expMonths = buildMonthlyTrend(chartFrom, today, exp);
  return {
    monthly: revMonths.map((m, i) => ({ key: m.key, revenue: m.revenue, expenses: expMonths[i]?.revenue ?? 0 })),
    daily: buildDailyTrend(monthStart, today, rev, exp).map((d) => ({ key: d.date, revenue: d.revenue, expenses: d.expenses })),
  };
}
