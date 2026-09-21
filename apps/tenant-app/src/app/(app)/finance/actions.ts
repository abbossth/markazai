"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@markazai/db";
import { fromISODate, paymentSchema, toCenterParts, type ActionResult, type PaymentInput } from "@markazai/types";
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
