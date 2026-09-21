import { prisma, type Prisma } from "@markazai/db";
import { PAYMENT_METHODS, buildDailyTrend, financeTotals, fromISODate, toCenterParts, toISODate } from "@markazai/types";
import { intParam, param, sortParam, type RawSearchParams } from "@/lib/search-params";
import type { SessionUser } from "@/lib/session";

export const PAGE_SIZE = 20;
export const FINANCE_TABS = ["payments", "withdrawals", "expenses", "salary", "debtors"] as const;
export type FinanceTab = (typeof FINANCE_TABS)[number];
const SORT_KEYS = ["date", "amount"] as const;
const MAX_DAILY_POINTS = 92;
export const EXPORT_LIMIT = 20_000;

/** Sahifalash argumentlari; `all` (eksport) bo'lsa — sahifalarsiz, EXPORT_LIMIT bilan cheklangan. */
function pageArgs(page: number, all?: boolean): { skip?: number; take: number } {
  return all ? { take: EXPORT_LIMIT } : { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Sana oralig'i ("YYYY-MM-DD"); berilmasa — joriy oy boshidan bugungacha (markaz vaqti). */
export function resolveRange(sp: RawSearchParams) {
  const today = toCenterParts(new Date()).date;
  let from = param(sp, "from");
  let to = param(sp, "to");
  if (!from || !ISO.test(from)) from = `${today.slice(0, 7)}-01`;
  if (!to || !ISO.test(to)) to = today;
  if (from > to) [from, to] = [to, from];
  return { from, to, today };
}
export type Range = ReturnType<typeof resolveRange>;

const dateRange = (r: Range) => ({ gte: fromISODate(r.from), lte: fromISODate(r.to) });

export async function loadSummary(user: SessionUser, range: Range) {
  const where = { organizationId: user.orgId, date: dateRange(range) };
  const [revenue, charged, expenses, withdrawals, debt] = await Promise.all([
    prisma.payment.aggregate({ where: { ...where, type: "MANUAL" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { ...where, type: "SYSTEM" }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
    prisma.withdrawal.aggregate({ where, _sum: { amount: true } }),
    prisma.student.aggregate({ where: { organizationId: user.orgId, balance: { lt: 0 } }, _sum: { balance: true }, _count: true }),
  ]);
  return {
    ...financeTotals({ revenue: revenue._sum.amount ?? 0, expenses: expenses._sum.amount ?? 0, withdrawals: withdrawals._sum.amount ?? 0 }),
    // Hisoblangan (tizim yechimi) — davr uchun "to'lanishi kerak bo'lgan" summa
    accrued: -(charged._sum.amount ?? 0),
    totalDebt: -(debt._sum.balance ?? 0),
    debtors: debt._count,
  };
}
export type Summary = Awaited<ReturnType<typeof loadSummary>>;

export type TrendPoint = { key: string; revenue: number; expenses: number };

/** Tushum/xarajat dinamikasi. Oraliq uzun bo'lsa (92 kundan ortiq) oylar bo'yicha jamlanadi. */
export async function loadTrend(user: SessionUser, range: Range): Promise<{ granularity: "day" | "month"; points: TrendPoint[] }> {
  const where = { organizationId: user.orgId, date: dateRange(range) };
  const [pay, exp] = await Promise.all([
    prisma.payment.groupBy({ by: ["date"], where: { ...where, type: "MANUAL" }, _sum: { amount: true } }),
    prisma.expense.groupBy({ by: ["date"], where, _sum: { amount: true } }),
  ]);
  const revenue = new Map(pay.map((p) => [toISODate(p.date), p._sum.amount ?? 0]));
  const expenses = new Map(exp.map((e) => [toISODate(e.date), e._sum.amount ?? 0]));
  const daily = buildDailyTrend(range.from, range.to, revenue, expenses);

  if (daily.length <= MAX_DAILY_POINTS) return { granularity: "day", points: daily.map((d) => ({ key: d.date, revenue: d.revenue, expenses: d.expenses })) };

  const months = new Map<string, TrendPoint>();
  for (const d of daily) {
    const key = d.date.slice(0, 7);
    const m = months.get(key) ?? { key, revenue: 0, expenses: 0 };
    m.revenue += d.revenue;
    m.expenses += d.expenses;
    months.set(key, m);
  }
  return { granularity: "month", points: [...months.values()] };
}

export type PaymentRow = {
  id: string;
  amount: number;
  type: "SYSTEM" | "MANUAL";
  method: string;
  date: string;
  lessonDate: string | null;
  description: string | null;
  studentId: string;
  studentName: string;
  groupName: string | null;
  teacherName: string | null;
  receivedByName: string | null;
  receiptPrinted: boolean;
};

export async function listPayments(user: SessionUser, sp: RawSearchParams, range: Range, opts: { all?: boolean } = {}) {
  const q = param(sp, "q");
  const groupId = param(sp, "groupId");
  const teacherId = param(sp, "teacherId");
  const type = param(sp, "type");
  const method = param(sp, "method");
  const min = Number.parseInt(param(sp, "min") ?? "", 10);
  const max = Number.parseInt(param(sp, "max") ?? "", 10);
  const page = intParam(sp, "page", 1);
  const sort = sortParam(sp, SORT_KEYS, { key: "date", dir: "desc" });

  const and: Prisma.PaymentWhereInput[] = [];
  if (q) {
    const digits = q.replace(/\D/g, "");
    and.push({ student: { OR: [{ name: { contains: q, mode: "insensitive" } }, ...(digits.length >= 2 ? [{ phone: { contains: digits } }] : [])] } });
  }
  if (groupId) and.push({ groupId });
  if (teacherId) and.push({ group: { teacherId } });
  if (type === "SYSTEM" || type === "MANUAL") and.push({ type });
  if (method && (PAYMENT_METHODS as readonly string[]).includes(method)) and.push({ type: "MANUAL", method: method as (typeof PAYMENT_METHODS)[number] });
  // Summa filtri absolyut qiymat bo'yicha (tizim yechimlari manfiy saqlanadi).
  const lo = Number.isFinite(min) ? min : 0;
  const hi = Number.isFinite(max) ? max : Number.MAX_SAFE_INTEGER;
  if (Number.isFinite(min) || Number.isFinite(max)) and.push({ OR: [{ amount: { gte: lo, lte: hi } }, { amount: { gte: -hi, lte: -lo } }] });

  const where: Prisma.PaymentWhereInput = { organizationId: user.orgId, date: dateRange(range), AND: and };

  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: [{ [sort.key]: sort.dir }, { createdAt: "desc" }],
      ...pageArgs(page, opts.all),
      include: { student: { select: { name: true } }, group: { select: { name: true, teacher: { select: { name: true } } } } },
    }),
  ]);
  const staffIds = [...new Set(rows.flatMap((r) => (r.receivedById ? [r.receivedById] : [])))];
  const staff = staffIds.length ? await prisma.user.findMany({ where: { organizationId: user.orgId, id: { in: staffIds } }, select: { id: true, name: true } }) : [];
  const staffNames = new Map(staff.map((s) => [s.id, s.name]));

  const items: PaymentRow[] = rows.map((r) => ({
    id: r.id,
    amount: r.amount,
    type: r.type,
    method: r.method,
    date: r.date.toISOString(),
    lessonDate: r.lessonDate?.toISOString() ?? null,
    description: r.description,
    studentId: r.studentId,
    studentName: r.student.name,
    groupName: r.group?.name ?? null,
    teacherName: r.group?.teacher.name ?? null,
    receivedByName: r.receivedById ? (staffNames.get(r.receivedById) ?? null) : null,
    receiptPrinted: r.receiptPrinted,
  }));
  return { rows: items, total, page, sort };
}

export async function loadPaymentLookups(user: SessionUser) {
  const [groups, teachers] = await Promise.all([
    prisma.group.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.teacher.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { groups, teachers };
}

// ───────────── Xarajatlar ─────────────

export type ExpenseRow = { id: string; category: string; amount: number; date: string; description: string | null; createdByName: string | null };

export async function listExpenses(user: SessionUser, sp: RawSearchParams, range: Range, opts: { all?: boolean } = {}) {
  const q = param(sp, "q");
  const category = param(sp, "category");
  const page = intParam(sp, "page", 1);
  const sort = sortParam(sp, SORT_KEYS, { key: "date", dir: "desc" });

  const where: Prisma.ExpenseWhereInput = {
    organizationId: user.orgId,
    date: dateRange(range),
    ...(category && { category: { equals: category, mode: "insensitive" } }),
    ...(q && { OR: [{ description: { contains: q, mode: "insensitive" } }, { category: { contains: q, mode: "insensitive" } }] }),
  };
  const [total, sum, rows] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
    prisma.expense.findMany({
      where,
      orderBy: [{ [sort.key]: sort.dir }, { createdAt: "desc" }],
      ...pageArgs(page, opts.all),
    }),
  ]);
  const names = await userNames(user, rows.map((r) => r.createdById));
  const items: ExpenseRow[] = rows.map((r) => ({ id: r.id, category: r.category, amount: r.amount, date: r.date.toISOString(), description: r.description, createdByName: names.get(r.createdById) ?? null }));
  return { rows: items, total, page, sort, sum: sum._sum.amount ?? 0 };
}

/** Xarajat turlari: standart ro'yxat + bazadagi mavjudlari (takliflar uchun). */
export async function loadExpenseCategories(user: SessionUser) {
  const existing = await prisma.expense.findMany({ where: { organizationId: user.orgId }, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } });
  return [...new Set(existing.map((e) => e.category))];
}

// ───────────── Yechib olish ─────────────

export type WithdrawalRow = { id: string; amount: number; date: string; note: string | null; createdByName: string | null };

export async function listWithdrawals(user: SessionUser, sp: RawSearchParams, range: Range, opts: { all?: boolean } = {}) {
  const q = param(sp, "q");
  const page = intParam(sp, "page", 1);
  const sort = sortParam(sp, SORT_KEYS, { key: "date", dir: "desc" });
  const where: Prisma.WithdrawalWhereInput = { organizationId: user.orgId, date: dateRange(range), ...(q && { note: { contains: q, mode: "insensitive" } }) };

  const [total, sum, rows] = await Promise.all([
    prisma.withdrawal.count({ where }),
    prisma.withdrawal.aggregate({ where, _sum: { amount: true } }),
    prisma.withdrawal.findMany({ where, orderBy: [{ [sort.key]: sort.dir }, { createdAt: "desc" }], ...pageArgs(page, opts.all) }),
  ]);
  const names = await userNames(user, rows.map((r) => r.createdById));
  const items: WithdrawalRow[] = rows.map((r) => ({ id: r.id, amount: r.amount, date: r.date.toISOString(), note: r.note, createdByName: names.get(r.createdById) ?? null }));
  return { rows: items, total, page, sort, sum: sum._sum.amount ?? 0 };
}

// ───────────── Qarzdorlar ─────────────

export type DebtorRow = {
  id: string;
  name: string;
  phone: string;
  balance: number;
  groups: { id: string; name: string }[];
  lastPaymentDate: string | null;
};

export async function listDebtors(user: SessionUser, sp: RawSearchParams, opts: { all?: boolean } = {}) {
  const q = param(sp, "q");
  const groupId = param(sp, "groupId");
  const page = intParam(sp, "page", 1);
  const digits = q?.replace(/\D/g, "") ?? "";

  const where: Prisma.StudentWhereInput = {
    organizationId: user.orgId,
    balance: { lt: 0 },
    ...(groupId && { enrollments: { some: { groupId, leftAt: null } } }),
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, ...(digits.length >= 2 ? [{ phone: { contains: digits } }] : [])] }),
  };
  const [total, sum, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.aggregate({ where, _sum: { balance: true } }),
    prisma.student.findMany({
      where,
      orderBy: [{ balance: "asc" }, { name: "asc" }],
      ...pageArgs(page, opts.all),
      include: {
        enrollments: { where: { leftAt: null }, select: { group: { select: { id: true, name: true } } } },
        payments: { where: { type: "MANUAL" }, orderBy: { date: "desc" }, take: 1, select: { date: true } },
      },
    }),
  ]);
  const rows: DebtorRow[] = students.map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    balance: s.balance,
    groups: s.enrollments.map((e) => e.group),
    lastPaymentDate: s.payments[0]?.date.toISOString() ?? null,
  }));
  return { rows, total, page, totalDebt: -(sum._sum.balance ?? 0) };
}

async function userNames(user: SessionUser, ids: string[]) {
  const unique = [...new Set(ids)];
  const users = unique.length ? await prisma.user.findMany({ where: { organizationId: user.orgId, id: { in: unique } }, select: { id: true, name: true } }) : [];
  return new Map(users.map((u) => [u.id, u.name]));
}
