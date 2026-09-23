"use server";

import { revalidatePath } from "next/cache";
import { loadMonthHolidays, prisma, recalculateStudentGroup, syncAttendanceCoins, syncLessonCharge } from "@markazai/db";
import {
  discountSchema,
  examSchema,
  fromISODate,
  gradeScoreSchema,
  lessonDatesInMonth,
  onlineLessonSchema,
  toISODate,
  type ActionResult,
  type DiscountInput,
  type ExamInput,
  type OnlineLessonInput,
} from "@markazai/types";
import { logHistory } from "@/lib/history";
import { can, isTeacherOnly } from "@/lib/permissions";
import { requireUser, type SessionUser } from "@/lib/session";

type Result<T = object> = ActionResult<T> & { fieldErrors?: Record<string, string> };

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

/** Guruhni tashkilot bo'yicha topadi; o'qituvchi (faqat TEACHER roli) bo'lsa — faqat o'z guruhini. */
async function loadGroup(user: SessionUser, groupId: string) {
  if (isTeacherOnly(user.roles)) {
    const teacher = await prisma.teacher.findFirst({ where: { organizationId: user.orgId, userId: user.id }, select: { id: true } });
    return prisma.group.findFirst({ where: { id: groupId, organizationId: user.orgId, teacherId: teacher?.id ?? "none" } });
  }
  return prisma.group.findFirst({ where: { id: groupId, organizationId: user.orgId } });
}

async function requireGroupWriter(groupId: string) {
  const user = await requireUser();
  if (!can(user.roles, "groups:write")) return { user, group: null, error: "forbidden" as const };
  const group = await loadGroup(user, groupId);
  return group ? { user, group, error: null } : { user, group: null, error: "notFound" as const };
}

/**
 * Davomat/baho qo'yish mumkinmi: sana — guruhning dars kuni, talaba o'sha kuni guruh a'zosi bo'lgan.
 * O'qituvchi (faqat TEACHER roli, o'z guruhida) — faqat BUGUNGI kunga; CEO/administrator/rahbariyat —
 * guruhning butun o'qish davri (boshlanish–tugash) ichidagi istalgan dars kuniga.
 */
type CellCheck = { ok: false; error: "forbidden" | "notFound" | "validation" } | { ok: true; date: Date };

async function validateLessonCell(user: SessionUser, groupId: string, studentId: string, date: string): Promise<CellCheck> {
  if (!can(user.roles, "attendance:write")) return { ok: false, error: "forbidden" };
  const group = await loadGroup(user, groupId);
  if (!group) return { ok: false, error: "notFound" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "validation" };
  if (isTeacherOnly(user.roles) && date !== toISODate(new Date())) return { ok: false, error: "validation" };

  const [y, m] = [Number(date.slice(0, 4)), Number(date.slice(5, 7))];
  const holidays = await loadMonthHolidays(prisma, user.orgId, y, m);
  const lessons = lessonDatesInMonth({ days: group.days, customDays: group.customDays, startDate: group.startDate, endDate: group.endDate, holidays }, y, m);
  if (!lessons.includes(date)) return { ok: false, error: "validation" };

  const enrollment = await prisma.groupStudent.findFirst({ where: { groupId, studentId, organizationId: user.orgId } });
  const d = fromISODate(date);
  if (!enrollment || enrollment.joinedAt > d || (enrollment.leftAt && enrollment.leftAt < d)) return { ok: false, error: "validation" };
  return { ok: true, date: d };
}

/** status = null — belgini olib tashlaydi ("bo'sh"). */
export async function setAttendance(groupId: string, studentId: string, date: string, status: "PRESENT" | "ABSENT" | "EXCUSED" | null): Promise<Result> {
  const user = await requireUser();
  if (status !== null && !["PRESENT", "ABSENT", "EXCUSED"].includes(status)) return { ok: false, error: "validation" };

  const check = await validateLessonCell(user, groupId, studentId, date);
  if (!check.ok) return { ok: false, error: check.error };

  const key = { groupId_studentId_date: { groupId, studentId, date: check.date } };
  // Davomat va tizim yechimi bitta tranzaksiyada: balans hech qachon davomatdan orqada qolmaydi.
  await prisma.$transaction(async (tx) => {
    if (status === null) {
      await tx.attendance.deleteMany({ where: { groupId, studentId, date: check.date, organizationId: user.orgId } });
    } else {
      await tx.attendance.upsert({
        where: key,
        update: { status, markedById: user.id },
        create: { organizationId: user.orgId, groupId, studentId, date: check.date, status, markedById: user.id },
      });
    }
    await syncLessonCharge(tx, { organizationId: user.orgId, groupId, studentId, date: check.date });
    // Gamifikatsiya yoqilgan bo'lsa "keldi" darsi coin beradi (holat o'zgarsa moslanadi).
    await syncAttendanceCoins(tx, { organizationId: user.orgId, groupId, studentId, date: check.date });
  });
  // Har bir katak uchun audit-log yozilmaydi (juda ko'p bo'lardi); revalidate ham kerak emas — UI optimistik.
  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

export async function setGrade(groupId: string, studentId: string, date: string, score: number | null): Promise<Result> {
  const user = await requireUser();
  if (score !== null && !gradeScoreSchema.safeParse(score).success) return { ok: false, error: "validation" };

  const check = await validateLessonCell(user, groupId, studentId, date);
  if (!check.ok) return { ok: false, error: check.error };

  const key = { groupId_studentId_date: { groupId, studentId, date: check.date } };
  if (score === null) {
    await prisma.grade.deleteMany({ where: { groupId, studentId, date: check.date, organizationId: user.orgId } });
  } else {
    await prisma.grade.upsert({
      where: key,
      update: { score },
      create: { organizationId: user.orgId, groupId, studentId, date: check.date, score },
    });
  }
  return { ok: true };
}

export async function addOnlineLesson(groupId: string, input: OnlineLessonInput): Promise<Result> {
  const { user, group, error } = await requireGroupWriter(groupId);
  if (!group) return { ok: false, error };
  const parsed = onlineLessonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };

  await prisma.onlineLesson.create({ data: { organizationId: user.orgId, groupId, ...parsed.data } });
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

export async function deleteOnlineLesson(groupId: string, id: string): Promise<Result> {
  const { user, group, error } = await requireGroupWriter(groupId);
  if (!group) return { ok: false, error };
  await prisma.onlineLesson.deleteMany({ where: { id, groupId, organizationId: user.orgId } });
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

export async function addDiscount(groupId: string, input: DiscountInput): Promise<Result> {
  const { user, group, error } = await requireGroupWriter(groupId);
  if (!group) return { ok: false, error };
  const parsed = discountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;

  if (d.amount >= group.price) return { ok: false, error: "validation", fieldErrors: { amount: "discountTooLarge" } };
  const member = await prisma.groupStudent.findFirst({ where: { groupId, studentId: d.studentId, leftAt: null, organizationId: user.orgId } });
  if (!member) return { ok: false, error: "validation", fieldErrors: { studentId: "required" } };

  const student = await prisma.student.findFirst({ where: { id: d.studentId, organizationId: user.orgId }, select: { name: true } });
  await prisma.discount.create({
    data: {
      organizationId: user.orgId,
      groupId,
      studentId: d.studentId,
      amount: d.amount,
      fromDate: fromISODate(d.fromDate),
      toDate: d.toDate ? fromISODate(d.toDate) : null,
      reason: d.reason,
    },
  });
  // Chegirma amal qiladigan davrdagi allaqachon yechilgan darslar qayta hisoblanadi.
  await recalculateStudentGroup(prisma, { organizationId: user.orgId, groupId, studentId: d.studentId, from: fromISODate(d.fromDate) });
  await logHistory(user, "group", groupId, "discount_added", { summary: `${student?.name ?? ""}: −${d.amount}` });
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

export async function deleteDiscount(groupId: string, id: string): Promise<Result> {
  const { user, group, error } = await requireGroupWriter(groupId);
  if (!group) return { ok: false, error };
  const discount = await prisma.discount.findFirst({ where: { id, groupId, organizationId: user.orgId } });
  await prisma.discount.deleteMany({ where: { id, groupId, organizationId: user.orgId } });
  if (discount) await recalculateStudentGroup(prisma, { organizationId: user.orgId, groupId, studentId: discount.studentId, from: discount.fromDate });
  await logHistory(user, "group", groupId, "discount_removed");
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

export async function addExam(groupId: string, input: ExamInput): Promise<Result> {
  const { user, group, error } = await requireGroupWriter(groupId);
  if (!group) return { ok: false, error };
  const parsed = examSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;

  await prisma.exam.create({
    data: { organizationId: user.orgId, groupId, name: d.name, date: fromISODate(d.date), durationMinutes: d.durationMinutes, maxScore: d.maxScore, passScore: d.passScore, fileUrl: d.fileUrl },
  });
  await logHistory(user, "group", groupId, "exam_added", { summary: d.name });
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

export async function deleteExam(groupId: string, id: string): Promise<Result> {
  const { user, group, error } = await requireGroupWriter(groupId);
  if (!group) return { ok: false, error };
  await prisma.exam.deleteMany({ where: { id, groupId, organizationId: user.orgId } });
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

/** "+" tugmasi uchun: guruhda hali yo'q talabalarni ism/telefon bo'yicha qidiradi. */
export async function searchStudentsForGroup(groupId: string, q: string): Promise<{ id: string; name: string; phone: string }[]> {
  const { user, group } = await requireGroupWriter(groupId);
  if (!group || !can(user.roles, "students:write")) return [];
  const term = q.trim();
  if (term.length < 2) return [];
  const digits = term.replace(/\D/g, "");

  return prisma.student.findMany({
    where: {
      organizationId: user.orgId,
      enrollments: { none: { groupId, leftAt: null } },
      OR: [{ name: { contains: term, mode: "insensitive" } }, ...(digits.length >= 2 ? [{ phone: { contains: digits } }] : [])],
    },
    select: { id: true, name: true, phone: true },
    orderBy: { name: "asc" },
    take: 10,
  });
}
