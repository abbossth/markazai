"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@markazai/db";
import {
  expenseSchema,
  fromISODate,
  paymentSchema,
  salaryPaymentSchema,
  toCenterParts,
  withdrawalSchema,
  type ActionResult,
  type ExpenseInput,
  type PaymentInput,
  type SalaryPaymentInput,
  type WithdrawalInput,
} from "@markazai/types";
import { logHistory } from "@/lib/history";
import { requirePermission, type SessionUser } from "@/lib/session";

type Result<T = object> = ActionResult<T> & { fieldErrors?: Record<string, string> };

async function guard(permission: Parameters<typeof requirePermission>[0]): Promise<SessionUser | null> {
  try {
    return await requirePermission(permission);
  } catch {
    return null;
  }
}

function revalidateFinance(studentId?: string) {
  revalidatePath("/finance");
  if (studentId) revalidatePath(`/students/${studentId}`);
}

/**
 * Qo'lda to'lov qabul qilish. To'lov va talaba balansi BITTA tranzaksiyada yangilanadi,
 * shuning uchun Student.balance = to'lovlar yig'indisi doim saqlanadi.
 */
export async function recordPayment(input: PaymentInput): Promise<Result<{ id: string }>> {
  const user = await guard("payments:write");
  if (!user) return { ok: false, error: "forbidden" };

  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, error: "validation", fieldErrors };
  }
  const d = parsed.data;
  if (d.date > toCenterParts(new Date()).date) return { ok: false, error: "validation", fieldErrors: { date: "futureDate" } };

  const student = await prisma.student.findFirst({ where: { id: d.studentId, organizationId: user.orgId }, select: { id: true, name: true } });
  if (!student) return { ok: false, error: "notFound" };
  if (d.groupId) {
    const member = await prisma.groupStudent.findFirst({ where: { groupId: d.groupId, studentId: d.studentId, organizationId: user.orgId }, select: { id: true } });
    if (!member) return { ok: false, error: "validation", fieldErrors: { groupId: "invalid" } };
  }

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        organizationId: user.orgId,
        studentId: d.studentId,
        groupId: d.groupId,
        amount: d.amount,
        date: fromISODate(d.date),
        type: "MANUAL",
        method: d.method,
        description: d.description,
        receivedById: user.id,
      },
    });
    await tx.student.update({ where: { id: d.studentId }, data: { balance: { increment: d.amount } } });
    return p;
  });

  await logHistory(user, "student", d.studentId, "payment_added", { summary: String(d.amount) });
  revalidateFinance(d.studentId);
  return { ok: true, id: payment.id };
}

/** Qo'lda kiritilgan to'lovni bekor qiladi (faqat rahbariyat). Tizim yechimlariga tegilmaydi — ular davomatdan hisoblanadi. */
export async function voidPayment(id: string): Promise<Result> {
  const user = await guard("payments:void");
  if (!user) return { ok: false, error: "forbidden" };

  const payment = await prisma.payment.findFirst({ where: { id, organizationId: user.orgId } });
  if (!payment) return { ok: false, error: "notFound" };
  if (payment.type !== "MANUAL") return { ok: false, error: "systemPayment" };

  await prisma.$transaction([
    prisma.payment.delete({ where: { id } }),
    prisma.student.update({ where: { id: payment.studentId }, data: { balance: { decrement: payment.amount } } }),
  ]);
  await logHistory(user, "student", payment.studentId, "payment_voided", { summary: String(payment.amount) });
  revalidateFinance(payment.studentId);
  return { ok: true };
}

export async function markReceiptPrinted(id: string): Promise<Result> {
  const user = await guard("payments:write");
  if (!user) return { ok: false, error: "forbidden" };
  await prisma.payment.updateMany({ where: { id, organizationId: user.orgId, type: "MANUAL" }, data: { receiptPrinted: true } });
  revalidateFinance();
  return { ok: true };
}

/** To'lov dialogi uchun talaba qidiruvi: ism/telefon bo'yicha, balans va guruhlari bilan. */
export async function searchStudentsForPayment(q: string) {
  const user = await guard("payments:write");
  if (!user) return [];
  const term = q.trim();
  if (term.length < 2) return [];
  const digits = term.replace(/\D/g, "");

  const students = await prisma.student.findMany({
    where: { organizationId: user.orgId, OR: [{ name: { contains: term, mode: "insensitive" } }, ...(digits.length >= 2 ? [{ phone: { contains: digits } }] : [])] },
    select: { id: true, name: true, phone: true, balance: true, enrollments: { where: { leftAt: null }, select: { group: { select: { id: true, name: true } } } } },
    orderBy: { name: "asc" },
    take: 8,
  });
  return students.map((s) => ({ id: s.id, name: s.name, phone: s.phone, balance: s.balance, groups: s.enrollments.map((e) => e.group) }));
}

function issues(list: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const i of list) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
  return fieldErrors;
}

const isFuture = (date: string) => date > toCenterParts(new Date()).date;

// ───────────── Xarajatlar ─────────────

export async function saveExpense(id: string | null, input: ExpenseInput): Promise<Result> {
  const user = await guard("expenses:write");
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: issues(parsed.error.issues) };
  const d = parsed.data;
  if (isFuture(d.date)) return { ok: false, error: "validation", fieldErrors: { date: "futureDate" } };

  const data = { category: d.category, amount: d.amount, date: fromISODate(d.date), description: d.description ?? null };
  if (id) {
    if (await prisma.salaryPayment.findFirst({ where: { expenseId: id }, select: { id: true } })) return { ok: false, error: "linkedToSalary" };
    const res = await prisma.expense.updateMany({ where: { id, organizationId: user.orgId }, data });
    if (res.count === 0) return { ok: false, error: "notFound" };
  } else {
    await prisma.expense.create({ data: { ...data, organizationId: user.orgId, createdById: user.id } });
  }
  revalidatePath("/finance");
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<Result> {
  const user = await guard("expenses:write");
  if (!user) return { ok: false, error: "forbidden" };
  // Ish haqi to'lovidan yaratilgan xarajatni faqat "Ish haqi" bo'limidan o'chirish mumkin.
  if (await prisma.salaryPayment.findFirst({ where: { expenseId: id }, select: { id: true } })) return { ok: false, error: "linkedToSalary" };
  const res = await prisma.expense.deleteMany({ where: { id, organizationId: user.orgId } });
  revalidatePath("/finance");
  return res.count ? { ok: true } : { ok: false, error: "notFound" };
}

// ───────────── Yechib olish (faqat rahbariyat) ─────────────

export async function createWithdrawal(input: WithdrawalInput): Promise<Result> {
  const user = await guard("withdrawals:write");
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = withdrawalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: issues(parsed.error.issues) };
  const d = parsed.data;
  if (isFuture(d.date)) return { ok: false, error: "validation", fieldErrors: { date: "futureDate" } };

  await prisma.withdrawal.create({ data: { organizationId: user.orgId, amount: d.amount, date: fromISODate(d.date), note: d.note, createdById: user.id } });
  revalidatePath("/finance");
  return { ok: true };
}

export async function deleteWithdrawal(id: string): Promise<Result> {
  const user = await guard("withdrawals:write");
  if (!user) return { ok: false, error: "forbidden" };
  const res = await prisma.withdrawal.deleteMany({ where: { id, organizationId: user.orgId } });
  revalidatePath("/finance");
  return res.count ? { ok: true } : { ok: false, error: "notFound" };
}

// ───────────── Ish haqi to'lovi ─────────────

const SALARY_EXPENSE_CATEGORY = "Ish haqi";

/** Ish haqi to'laydi: SalaryPayment va unga mos Expense ("Ish haqi") bitta tranzaksiyada yaratiladi — foyda hisobida ko'rinadi. */
export async function paySalary(input: SalaryPaymentInput): Promise<Result> {
  const user = await guard("salary:pay");
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = salaryPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: issues(parsed.error.issues) };
  const d = parsed.data;
  if (isFuture(d.date)) return { ok: false, error: "validation", fieldErrors: { date: "futureDate" } };

  const teacher = await prisma.teacher.findFirst({ where: { id: d.teacherId, organizationId: user.orgId }, select: { name: true } });
  if (!teacher) return { ok: false, error: "notFound" };

  await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: { organizationId: user.orgId, category: SALARY_EXPENSE_CATEGORY, amount: d.amount, date: fromISODate(d.date), description: `${teacher.name} · ${d.period}${d.note ? ` · ${d.note}` : ""}`, createdById: user.id },
    });
    await tx.salaryPayment.create({
      data: { organizationId: user.orgId, teacherId: d.teacherId, period: d.period, amount: d.amount, date: fromISODate(d.date), note: d.note, expenseId: expense.id, createdById: user.id },
    });
  });
  revalidatePath("/finance");
  revalidatePath(`/teachers/${d.teacherId}`);
  return { ok: true };
}

export async function deleteSalaryPayment(id: string): Promise<Result> {
  const user = await guard("salary:pay");
  if (!user) return { ok: false, error: "forbidden" };
  const payment = await prisma.salaryPayment.findFirst({ where: { id, organizationId: user.orgId } });
  if (!payment) return { ok: false, error: "notFound" };

  await prisma.$transaction([
    prisma.salaryPayment.delete({ where: { id } }),
    ...(payment.expenseId ? [prisma.expense.deleteMany({ where: { id: payment.expenseId, organizationId: user.orgId } })] : []),
  ]);
  revalidatePath("/finance");
  revalidatePath(`/teachers/${payment.teacherId}`);
  return { ok: true };
}
