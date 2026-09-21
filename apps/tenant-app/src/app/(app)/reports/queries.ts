import { prisma, type Prisma } from "@markazai/db";
import {
  attendancePercent,
  averageScore,
  centerDayRange,
  conversionSummary,
  daysBetween,
  fromISODate,
  groupConversion,
  rankByCoins,
  rankByRating,
  toCenterParts,
  toISODate,
  type ConversionGrouping,
  type ConversionLead,
} from "@markazai/types";
import type { Range } from "@/lib/date-range";
import { canAccess, isTeacherOnly } from "@/lib/permissions";
import { intParam, param, sortParam, type RawSearchParams } from "@/lib/search-params";
import type { SessionUser } from "@/lib/session";

export const PAGE_SIZE = 20;
export const EXPORT_LIMIT = 20_000;

type Sort = { key: string; dir: "asc" | "desc" };
type Opts = { all?: boolean };

/** DB darajasida sahifalash; `all` (eksport) bo'lsa — sahifalarsiz, EXPORT_LIMIT bilan cheklangan. */
function pageArgs(page: number, all?: boolean): { skip?: number; take: number } {
  return all ? { take: EXPORT_LIMIT } : { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE };
}

const dateRange = (r: Range) => ({ gte: fromISODate(r.from), lte: fromISODate(r.to) });
/** Vaqt tamg'asi ustunlari (createdAt) uchun: markaz vaqti bo'yicha [from 00:00, to 23:59:59]. */
const instantRange = (r: Range) => ({ gte: centerDayRange(r.from).start, lte: centerDayRange(r.to).end });

/** Faqat-o'qituvchi foydalanuvchi faqat o'z guruhlarini ko'radi ("none" — bog'langan o'qituvchi yo'q → hech narsa). */
const teacherScope = (user: SessionUser) => (isTeacherOnly(user.roles) ? (user.teacherId ?? "none") : undefined);

/** Guruh filtri (guruh/kurs/o'qituvchi) + o'qituvchi ko'lami. Ko'lam filtrdan ustun turadi. */
function groupWhere(user: SessionUser, sp: RawSearchParams): Prisma.GroupWhereInput {
  const scope = teacherScope(user);
  const groupId = param(sp, "groupId");
  const courseId = param(sp, "courseId");
  const teacherId = scope ?? param(sp, "teacherId");
  return { organizationId: user.orgId, ...(groupId && { id: groupId }), ...(courseId && { courseId }), ...(teacherId && { teacherId }) };
}

function studentSearch(q: string | undefined): Prisma.StudentWhereInput {
  if (!q) return {};
  const digits = q.replace(/\D/g, "");
  return { OR: [{ name: { contains: q, mode: "insensitive" } }, ...(digits.length >= 2 ? [{ phone: { contains: digits } }] : [])] };
}

/** Xotiradagi qatorlarni saralab, sahifalaydi (`all` — eksport uchun to'liq, EXPORT_LIMIT bilan). */
function paginate<T>(rows: T[], sp: RawSearchParams, sort: Sort, value: (row: T, key: string) => string | number | null, opts: Opts) {
  const dir = sort.dir === "asc" ? 1 : -1;
  const sorted = [...rows].sort((a, b) => {
    const x = value(a, sort.key);
    const y = value(b, sort.key);
    if (x === y) return 0;
    if (x === null) return 1; // bo'sh qiymatlar doim oxirida
    if (y === null) return -1;
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * dir;
  });
  const page = intParam(sp, "page", 1);
  return { rows: opts.all ? sorted.slice(0, EXPORT_LIMIT) : sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: sorted.length, page, sort };
}

// ───────────── Filtr uchun ro'yxatlar ─────────────

export async function loadReportLookups(user: SessionUser) {
  const scope = teacherScope(user);
  const [groups, teachers, courses, columns, staff] = await Promise.all([
    prisma.group.findMany({ where: { organizationId: user.orgId, ...(scope && { teacherId: scope }) }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    scope ? Promise.resolve([]) : prisma.teacher.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.course.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    canAccess(user.roles, "leads") ? prisma.leadColumn.findMany({ where: { organizationId: user.orgId }, orderBy: { position: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
    canAccess(user.roles, "leads") ? prisma.user.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  return { groups, teachers, courses, columns, staff };
}
export type ReportLookups = Awaited<ReturnType<typeof loadReportLookups>>;

// ───────────── Reyting ─────────────

export type RatingRow = { id: string; rank: number; name: string; groups: string[]; avgScore: number; gradesCount: number; attendancePct: number | null };

/**
 * Talabalar reytingi: davrdagi o'rtacha ball (talaba profilidagi "Reyting" bilan bir xil ta'rif), teng bo'lsa — davomat.
 * Faqat davrda kamida bitta bahosi bor talabalar kiradi.
 */
export async function listRating(user: SessionUser, sp: RawSearchParams, range: Range, opts: Opts = {}) {
  const sort = sortParam(sp, ["rank", "name", "avg", "attendance", "grades"] as const, { key: "rank", dir: "asc" });
  const where = { organizationId: user.orgId, date: dateRange(range), group: groupWhere(user, sp), student: studentSearch(param(sp, "q")) };

  const [grades, attendance] = await Promise.all([
    prisma.grade.groupBy({ by: ["studentId"], where, _sum: { score: true }, _count: { _all: true } }),
    prisma.attendance.groupBy({ by: ["studentId", "status"], where, _count: { _all: true } }),
  ]);
  const ids = grades.map((g) => g.studentId);
  const students = ids.length
    ? await prisma.student.findMany({
        where: { organizationId: user.orgId, id: { in: ids } },
        select: { id: true, name: true, enrollments: { where: { leftAt: null, group: groupWhere(user, sp) }, select: { group: { select: { name: true } } } } },
      })
    : [];
  const byId = new Map(students.map((s) => [s.id, s]));
  const counts = new Map<string, { present: number; absent: number }>();
  for (const a of attendance) {
    const c = counts.get(a.studentId) ?? { present: 0, absent: 0 };
    if (a.status === "PRESENT") c.present += a._count._all;
    if (a.status === "ABSENT") c.absent += a._count._all;
    counts.set(a.studentId, c);
  }

  const inputs = grades.flatMap((g) => {
    const avg = averageScore(g._sum.score ?? 0, g._count._all);
    const c = counts.get(g.studentId) ?? { present: 0, absent: 0 };
    return avg === null ? [] : [{ id: g.studentId, avgScore: avg, gradesCount: g._count._all, attendancePct: attendancePercent(c.present, c.absent) }];
  });
  const rows: RatingRow[] = rankByRating(inputs).map((r) => {
    const s = byId.get(r.id);
    return { ...r, name: s?.name ?? "—", groups: s?.enrollments.map((e) => e.group.name) ?? [] };
  });

  return paginate(rows, sp, sort, (r, k) => (k === "name" ? r.name : k === "avg" ? r.avgScore : k === "attendance" ? r.attendancePct : k === "grades" ? r.gradesCount : r.rank), opts);
}

// ───────────── Davomat ─────────────

export type AttendanceRow = { id: string; name: string; courseName: string; teacherName: string; lessons: number; present: number; absent: number; excused: number; pct: number | null };

/** Guruhlar kesimida davomat: o'tkazilgan darslar (belgilangan kunlar), kelgan/kelmagan/sababli, davomat foizi. */
export async function listAttendance(user: SessionUser, sp: RawSearchParams, range: Range, opts: Opts = {}) {
  const sort = sortParam(sp, ["name", "lessons", "present", "absent", "pct"] as const, { key: "pct", dir: "asc" });
  const where = { organizationId: user.orgId, date: dateRange(range), group: groupWhere(user, sp) };

  const [byStatus, days] = await Promise.all([
    prisma.attendance.groupBy({ by: ["groupId", "status"], where, _count: { _all: true } }),
    prisma.attendance.groupBy({ by: ["groupId", "date"], where }),
  ]);
  const ids = [...new Set(byStatus.map((b) => b.groupId))];
  const groups = ids.length
    ? await prisma.group.findMany({ where: { organizationId: user.orgId, id: { in: ids } }, select: { id: true, name: true, course: { select: { name: true } }, teacher: { select: { name: true } } } })
    : [];
  const lessons = new Map<string, number>();
  for (const d of days) lessons.set(d.groupId, (lessons.get(d.groupId) ?? 0) + 1);

  const rows: AttendanceRow[] = groups.map((g) => {
    const c = (status: string) => byStatus.find((b) => b.groupId === g.id && b.status === status)?._count._all ?? 0;
    const present = c("PRESENT");
    const absent = c("ABSENT");
    return { id: g.id, name: g.name, courseName: g.course.name, teacherName: g.teacher.name, lessons: lessons.get(g.id) ?? 0, present, absent, excused: c("EXCUSED"), pct: attendancePercent(present, absent) };
  });
  const total = rows.reduce((s, r) => ({ present: s.present + r.present, absent: s.absent + r.absent, excused: s.excused + r.excused }), { present: 0, absent: 0, excused: 0 });

  const page = paginate(rows, sp, sort, (r, k) => (k === "name" ? r.name : k === "lessons" ? r.lessons : k === "present" ? r.present : k === "absent" ? r.absent : r.pct), opts);
  return { ...page, summary: { ...total, groups: rows.length, pct: attendancePercent(total.present, total.absent) } };
}

// ───────────── Konversiya ─────────────

export type ConversionData = {
  grouping: ConversionGrouping;
  summary: ReturnType<typeof conversionSummary>;
  rows: (ReturnType<typeof groupConversion>[number] & { name: string | null })[];
};

/**
 * Davrda yaratilgan lidlar (kohorta): nechtasi talabaga aylangan, nechtasi keyin to'lov qilgan.
 * Guruhlash: manba / kurs / mas'ul xodim. `name` — kurs/xodim nomi (manba uchun kalitning o'zi, i18n sahifada).
 */
export async function loadConversion(user: SessionUser, sp: RawSearchParams, range: Range, grouping: ConversionGrouping): Promise<ConversionData> {
  const leads = await prisma.lead.findMany({
    where: { organizationId: user.orgId, createdAt: instantRange(range) },
    select: { source: true, courseId: true, assignedToId: true, convertedStudentId: true, createdAt: true, convertedAt: true },
  });
  const convertedIds = leads.flatMap((l) => (l.convertedStudentId ? [l.convertedStudentId] : []));
  const paid = convertedIds.length
    ? new Set((await prisma.payment.groupBy({ by: ["studentId"], where: { organizationId: user.orgId, studentId: { in: convertedIds }, type: "MANUAL" } })).map((p) => p.studentId))
    : new Set<string>();

  const items: ConversionLead[] = leads.map((l) => ({
    key: grouping === "source" ? l.source : grouping === "course" ? l.courseId : l.assignedToId,
    converted: !!l.convertedStudentId,
    paid: !!l.convertedStudentId && paid.has(l.convertedStudentId),
    daysToConvert: l.convertedAt ? daysBetween(toCenterParts(l.createdAt).date, toCenterParts(l.convertedAt).date) : null,
  }));
  const rows = groupConversion(items);

  const names = new Map<string, string>();
  if (grouping === "course") for (const c of await prisma.course.findMany({ where: { organizationId: user.orgId }, select: { id: true, name: true } })) names.set(c.id, c.name);
  if (grouping === "assignee") for (const u of await prisma.user.findMany({ where: { organizationId: user.orgId }, select: { id: true, name: true } })) names.set(u.id, u.name);

  return { grouping, summary: conversionSummary(items), rows: rows.map((r) => ({ ...r, name: r.key ? (grouping === "source" ? r.key : (names.get(r.key) ?? null)) : null })) };
}

// ───────────── Lidlar ─────────────

export type LeadReportRow = { id: string; name: string; phone: string; source: string | null; stage: string; course: string | null; assignee: string | null; createdAt: string; converted: boolean };

export async function listLeadsReport(user: SessionUser, sp: RawSearchParams, range: Range, opts: Opts = {}) {
  const q = param(sp, "q");
  const source = param(sp, "source");
  const columnId = param(sp, "columnId");
  const courseId = param(sp, "courseId");
  const assignedToId = param(sp, "assignedToId");
  const converted = param(sp, "converted");
  const page = intParam(sp, "page", 1);
  const sort = sortParam(sp, ["createdAt", "name"] as const, { key: "createdAt", dir: "desc" });
  const digits = q?.replace(/\D/g, "") ?? "";

  const where: Prisma.LeadWhereInput = {
    organizationId: user.orgId,
    createdAt: instantRange(range),
    ...(source && { source: source as never }),
    ...(columnId && { columnId }),
    ...(courseId && { courseId }),
    ...(assignedToId && { assignedToId }),
    ...(converted === "yes" && { convertedStudentId: { not: null } }),
    ...(converted === "no" && { convertedStudentId: null }),
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, ...(digits.length >= 2 ? [{ phone: { contains: digits } }] : [])] }),
  };

  const [total, list, stages] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: [{ [sort.key]: sort.dir }, { id: "asc" }],
      ...pageArgs(page, opts.all),
      include: { column: { select: { name: true } }, course: { select: { name: true } } },
    }),
    prisma.lead.groupBy({ by: ["columnId"], where, _count: { _all: true } }),
  ]);
  const staffIds = [...new Set(list.flatMap((l) => (l.assignedToId ? [l.assignedToId] : [])))];
  const staff = staffIds.length ? await prisma.user.findMany({ where: { organizationId: user.orgId, id: { in: staffIds } }, select: { id: true, name: true } }) : [];
  const staffNames = new Map(staff.map((s) => [s.id, s.name]));
  const columns = await prisma.leadColumn.findMany({ where: { organizationId: user.orgId }, orderBy: { position: "asc" }, select: { id: true, name: true } });

  const rows: LeadReportRow[] = list.map((l) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    source: l.source,
    stage: l.column.name,
    course: l.course?.name ?? null,
    assignee: l.assignedToId ? (staffNames.get(l.assignedToId) ?? null) : null,
    createdAt: l.createdAt.toISOString(),
    converted: !!l.convertedStudentId,
  }));
  const stageCounts = columns.flatMap((c) => {
    const n = stages.find((s) => s.columnId === c.id)?._count._all ?? 0;
    return n > 0 ? [{ id: c.id, name: c.name, count: n }] : [];
  });
  return { rows, total, page, sort, stages: stageCounts };
}

// ───────────── Churn ─────────────

export type ChurnRow = { id: string; studentId: string; name: string; phone: string; groupName: string; teacherName: string; joinedAt: string; leftAt: string; days: number; status: string; balance: number };

/**
 * Guruhni tark etganlar: davrda guruhdan chiqqan va hozir hech qaysi guruhda faol emas talabalar.
 * (Boshqa guruhga o'tkazilganlar churn hisoblanmaydi.)
 */
export async function listChurn(user: SessionUser, sp: RawSearchParams, range: Range, opts: Opts = {}) {
  const sort = sortParam(sp, ["leftAt", "name", "days", "balance"] as const, { key: "leftAt", dir: "desc" });
  const list = await prisma.groupStudent.findMany({
    where: {
      organizationId: user.orgId,
      leftAt: dateRange(range),
      group: groupWhere(user, sp),
      student: { ...studentSearch(param(sp, "q")), enrollments: { none: { leftAt: null } } },
    },
    take: EXPORT_LIMIT,
    include: { student: { select: { name: true, phone: true, status: true, balance: true } }, group: { select: { name: true, teacher: { select: { name: true } } } } },
  });
  const rows: ChurnRow[] = list.flatMap((e) =>
    e.leftAt
      ? [{ id: e.id, studentId: e.studentId, name: e.student.name, phone: e.student.phone, groupName: e.group.name, teacherName: e.group.teacher.name, joinedAt: toISODate(e.joinedAt), leftAt: toISODate(e.leftAt), days: daysBetween(toISODate(e.joinedAt), toISODate(e.leftAt)), status: e.student.status, balance: e.student.balance }]
      : [],
  );
  const page = paginate(rows, sp, sort, (r, k) => (k === "name" ? r.name : k === "days" ? r.days : k === "balance" ? r.balance : r.leftAt), opts);
  return { ...page, summary: { count: rows.length, avgDays: rows.length ? Math.round((rows.reduce((s, r) => s + r.days, 0) / rows.length) * 10) / 10 : null } };
}

// ───────────── Coin reytingi ─────────────

export type CoinRow = { id: string; rank: number; name: string; groups: string[]; attendance: number; manual: number; total: number };

/** Davrdagi coin reytingi: davomat va qo'lda berilgan coinlar alohida ko'rsatiladi. Guruh filtri (yoki o'qituvchi ko'lami) bo'lsa faqat guruhga bog'liq yozuvlar. */
export async function listCoins(user: SessionUser, sp: RawSearchParams, range: Range, opts: Opts = {}) {
  const sort = sortParam(sp, ["rank", "name", "attendance", "manual", "total"] as const, { key: "rank", dir: "asc" });
  const filtered = !!(teacherScope(user) || param(sp, "groupId") || param(sp, "courseId") || param(sp, "teacherId"));
  const where: Prisma.CoinLogWhereInput = {
    organizationId: user.orgId,
    date: dateRange(range),
    ...(filtered && { group: groupWhere(user, sp) }),
    student: studentSearch(param(sp, "q")),
  };
  const grouped = await prisma.coinLog.groupBy({ by: ["studentId", "kind"], where, _sum: { amount: true } });
  const ids = [...new Set(grouped.map((g) => g.studentId))];
  const students = ids.length
    ? await prisma.student.findMany({ where: { organizationId: user.orgId, id: { in: ids } }, select: { id: true, name: true, enrollments: { where: { leftAt: null, ...(filtered && { group: groupWhere(user, sp) }) }, select: { group: { select: { name: true } } } } } })
    : [];
  const byId = new Map(students.map((s) => [s.id, s]));
  const sum = (id: string, kind: "ATTENDANCE" | "MANUAL") => grouped.find((g) => g.studentId === id && g.kind === kind)?._sum.amount ?? 0;

  const ranked = rankByCoins(ids.map((id) => ({ id, coins: sum(id, "ATTENDANCE") + sum(id, "MANUAL") })));
  const rows: CoinRow[] = ranked.map((r) => ({ id: r.id, rank: r.rank, name: byId.get(r.id)?.name ?? "—", groups: byId.get(r.id)?.enrollments.map((e) => e.group.name) ?? [], attendance: sum(r.id, "ATTENDANCE"), manual: sum(r.id, "MANUAL"), total: r.coins }));
  return paginate(rows, sp, sort, (r, k) => (k === "name" ? r.name : k === "attendance" ? r.attendance : k === "manual" ? r.manual : k === "total" ? r.total : r.rank), opts);
}

// ───────────── Jurnallar ─────────────

export type CallLogRow = { id: string; at: string; who: string; phone: string; kind: "lead" | "student"; refId: string; direction: string; outcome: string; durationSeconds: number | null; note: string | null; staff: string | null };
export type SmsLogRow = { id: string; at: string; who: string; phone: string; kind: "lead" | "student"; refId: string; text: string; status: string; provider: string; error: string | null; staff: string | null };

/** Talabalar moduliga ruxsati yo'q foydalanuvchi (marketer) faqat lidlarga tegishli yozuvlarni ko'radi. */
const logScope = (user: SessionUser) => (canAccess(user.roles, "students") ? {} : { leadId: { not: null } });

async function staffNames(user: SessionUser, ids: string[]) {
  const unique = [...new Set(ids)];
  const staff = unique.length ? await prisma.user.findMany({ where: { organizationId: user.orgId, id: { in: unique } }, select: { id: true, name: true } }) : [];
  return new Map(staff.map((s) => [s.id, s.name]));
}

function logSearch(q: string | undefined) {
  if (!q) return {};
  const digits = q.replace(/\D/g, "");
  const phone = digits.length >= 2 ? [{ phone: { contains: digits } }] : [];
  return { OR: [{ lead: { OR: [{ name: { contains: q, mode: "insensitive" as const } }, ...phone] } }, { student: { OR: [{ name: { contains: q, mode: "insensitive" as const } }, ...phone] } }] };
}

export async function listCallLog(user: SessionUser, sp: RawSearchParams, range: Range, opts: Opts = {}) {
  const direction = param(sp, "direction");
  const outcome = param(sp, "outcome");
  const page = intParam(sp, "page", 1);
  const where: Prisma.CallLogWhereInput = {
    organizationId: user.orgId,
    createdAt: instantRange(range),
    ...logScope(user),
    ...(direction && { direction: direction as never }),
    ...(outcome && { outcome: outcome as never }),
    ...logSearch(param(sp, "q")),
  };
  const [total, list] = await Promise.all([
    prisma.callLog.count({ where }),
    prisma.callLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      ...pageArgs(page, opts.all),
      include: { lead: { select: { name: true, phone: true } }, student: { select: { name: true, phone: true } } },
    }),
  ]);
  const staff = await staffNames(user, list.map((l) => l.createdById));
  const rows: CallLogRow[] = list.map((l) => {
    const who = l.lead ?? l.student;
    return {
      id: l.id,
      at: l.createdAt.toISOString(),
      who: who?.name ?? "—",
      phone: who?.phone ?? "",
      kind: l.leadId ? "lead" : "student",
      refId: l.leadId ?? l.studentId ?? "",
      direction: l.direction,
      outcome: l.outcome,
      durationSeconds: l.durationSeconds,
      note: l.note,
      staff: staff.get(l.createdById) ?? null,
    };
  });
  return { rows, total, page };
}

export async function listSmsLog(user: SessionUser, sp: RawSearchParams, range: Range, opts: Opts = {}) {
  const status = param(sp, "status");
  const page = intParam(sp, "page", 1);
  const where: Prisma.SmsLogWhereInput = {
    organizationId: user.orgId,
    createdAt: instantRange(range),
    ...logScope(user),
    ...(status && { status: status as never }),
    ...logSearch(param(sp, "q")),
  };
  const [total, list] = await Promise.all([
    prisma.smsLog.count({ where }),
    prisma.smsLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      ...pageArgs(page, opts.all),
      include: { lead: { select: { name: true } }, student: { select: { name: true } } },
    }),
  ]);
  const staff = await staffNames(user, list.map((l) => l.sentById));
  const rows: SmsLogRow[] = list.map((l) => ({
    id: l.id,
    at: l.createdAt.toISOString(),
    who: (l.lead ?? l.student)?.name ?? "—",
    phone: l.phone,
    kind: l.leadId ? "lead" : "student",
    refId: l.leadId ?? l.studentId ?? "",
    text: l.text,
    status: l.status,
    provider: l.provider,
    error: l.error,
    staff: staff.get(l.sentById) ?? null,
  }));
  return { rows, total, page };
}
