import { expectedLessonCharge, fromISODate, lessonDatesInMonth, toISODate } from "@markazai/types";
import type { Prisma, PrismaClient } from "./generated/client";
import { loadMonthHolidays } from "./holidays";

type Db = PrismaClient | Prisma.TransactionClient;

type LessonKey = { organizationId: string; groupId: string; studentId: string; date: Date };

/**
 * Bitta (talaba, guruh, dars kuni) uchun tizim yechimini davomat holatiga moslaydi (idempotent):
 * kerak bo'lsa SYSTEM to'lovni yaratadi/yangilaydi/o'chiradi va Student.balance'ni farqqa o'zgartiradi.
 * Qoidalar: @markazai/types → billing.ts (isChargeable, lessonAmount).
 * Qaytaradi: balansga qo'llangan o'zgarish (so'm).
 */
export async function syncLessonCharge(db: Db, { organizationId, groupId, studentId, date }: LessonKey): Promise<number> {
  const group = await db.group.findFirst({ where: { id: groupId, organizationId } });
  if (!group) return 0;

  // Dam olish kunlari oylik darslar sonidan chiqariladi: oylik narx haqiqiy darslarga taqsimlanadi.
  const holidays = await loadMonthHolidays(db, organizationId, date.getUTCFullYear(), date.getUTCMonth() + 1);
  const monthLessons = lessonDatesInMonth(
    { days: group.days, customDays: group.customDays, startDate: group.startDate, endDate: group.endDate, holidays },
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
  );
  const [attendance, discounts, existing] = await Promise.all([
    db.attendance.findFirst({ where: { groupId, studentId, date } }),
    db.discount.findMany({ where: { groupId, studentId, organizationId } }),
    db.payment.findFirst({ where: { studentId, groupId, lessonDate: date, type: "SYSTEM" } }),
  ]);

  const expected = expectedLessonCharge({
    groupPrice: group.price,
    discounts,
    monthLessons,
    date: toISODate(date),
    status: attendance?.status,
  });
  const current = existing ? -existing.amount : 0;
  if (expected === current) return 0;

  if (expected === 0 && existing) {
    await db.payment.delete({ where: { id: existing.id } });
  } else if (existing) {
    await db.payment.update({ where: { id: existing.id }, data: { amount: -expected } });
  } else {
    await db.payment.create({ data: { organizationId, studentId, groupId, amount: -expected, date, lessonDate: date, type: "SYSTEM" } });
  }

  const delta = current - expected;
  await db.student.update({ where: { id: studentId }, data: { balance: { increment: delta } } });
  return delta;
}

/** Talabaning guruhdagi barcha (belgilangan yoki avval yechilgan) darslarini `from` dan boshlab qayta hisoblaydi. */
export async function recalculateStudentGroup(db: Db, p: { organizationId: string; groupId: string; studentId: string; from?: Date }) {
  const dateFilter = p.from ? { gte: p.from } : undefined;
  const [marked, charged] = await Promise.all([
    db.attendance.findMany({ where: { groupId: p.groupId, studentId: p.studentId, date: dateFilter }, select: { date: true } }),
    db.payment.findMany({ where: { groupId: p.groupId, studentId: p.studentId, type: "SYSTEM", lessonDate: dateFilter }, select: { lessonDate: true } }),
  ]);
  const dates = new Map<string, Date>();
  for (const a of marked) dates.set(toISODate(a.date), a.date);
  for (const c of charged) if (c.lessonDate) dates.set(toISODate(c.lessonDate), c.lessonDate);

  for (const date of [...dates.values()].sort((a, b) => a.getTime() - b.getTime())) {
    await syncLessonCharge(db, { organizationId: p.organizationId, groupId: p.groupId, studentId: p.studentId, date });
  }
}

/** Student.balance ni to'lovlar yig'indisidan qayta hisoblaydi (tuzatish/ta'mirlash uchun). */
export async function recomputeBalances(prisma: PrismaClient, organizationId: string) {
  const sums = await prisma.payment.groupBy({ by: ["studentId"], where: { organizationId }, _sum: { amount: true } });
  const byStudent = new Map(sums.map((s) => [s.studentId, s._sum.amount ?? 0]));
  const students = await prisma.student.findMany({ where: { organizationId }, select: { id: true, balance: true } });
  let fixed = 0;
  for (const s of students) {
    const expected = byStudent.get(s.id) ?? 0;
    if (s.balance !== expected) {
      await prisma.student.update({ where: { id: s.id }, data: { balance: expected } });
      fixed++;
    }
  }
  return fixed;
}

/**
 * Barcha SYSTEM yechimlarni davomat asosida noldan qayta quradi (migratsiya/seed uchun).
 * Qo'lda (MANUAL) to'lovlarga tegilmaydi.
 */
export async function rebuildAllCharges(prisma: PrismaClient, organizationId: string) {
  await prisma.payment.deleteMany({ where: { organizationId, type: "SYSTEM" } });
  await recomputeBalances(prisma, organizationId);

  const rows = await prisma.attendance.findMany({ where: { organizationId }, select: { groupId: true, studentId: true, date: true } });
  for (const r of rows) await syncLessonCharge(prisma, { organizationId, ...r });
  return rows.length;
}
