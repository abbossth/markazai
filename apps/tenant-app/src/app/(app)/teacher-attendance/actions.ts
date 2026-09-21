"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@markazai/db";
import {
  fromISODate,
  isPeriod,
  isoWeekday,
  scheduledWorkDays,
  teacherScheduleSchema,
  toCenterParts,
  toISODate,
  type ActionResult,
  type TeacherScheduleInput,
} from "@markazai/types";
import { logHistory } from "@/lib/history";
import { can } from "@/lib/permissions";
import { requirePermission, type SessionUser } from "@/lib/session";

type Result = ActionResult & { fieldErrors?: Record<string, string> };
type Status = "PRESENT" | "ABSENT" | "EXTRA";

async function guard(): Promise<SessionUser | null> {
  try {
    return await requirePermission("teachers:write");
  } catch {
    return null;
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ustoz davomatini belgilaydi (status = null — belgini olib tashlaydi).
 * Qoidalar: bugundan keyingi kun belgilanmaydi; ish boshlanish sanasidan oldin ham; PRESENT/ABSENT faqat
 * ish jadvalidagi kunlarga, EXTRA (qo'shimcha) — jadvaldan tashqari kunlarga.
 */
export async function setTeacherAttendance(teacherId: string, date: string, status: Status | null): Promise<Result> {
  const user = await guard();
  if (!user) return { ok: false, error: "forbidden" };
  if (!ISO.test(date) || date > toCenterParts(new Date()).date) return { ok: false, error: "validation" };
  if (status !== null && !["PRESENT", "ABSENT", "EXTRA"].includes(status)) return { ok: false, error: "validation" };

  const teacher = await prisma.teacher.findFirst({ where: { id: teacherId, organizationId: user.orgId } });
  if (!teacher) return { ok: false, error: "notFound" };
  const day = fromISODate(date);
  if (teacher.workStartDate && day < teacher.workStartDate) return { ok: false, error: "validation" };

  const scheduled = teacher.workDays.includes(isoWeekday(day));
  if (status === "EXTRA" ? scheduled : status !== null && !scheduled) return { ok: false, error: "validation" };

  if (status === null) {
    await prisma.teacherAttendance.deleteMany({ where: { teacherId, date: day, organizationId: user.orgId } });
  } else {
    await prisma.teacherAttendance.upsert({
      where: { teacherId_date: { teacherId, date: day } },
      update: { status, markedById: user.id },
      create: { organizationId: user.orgId, teacherId, date: day, status, markedById: user.id },
    });
  }
  return { ok: true };
}

/** "To'liq ish kuni": oyning bugungacha bo'lgan, hali belgilanmagan barcha ish kunlarini "keldi" deb belgilaydi. */
export async function markFullWorkDays(teacherId: string, period: string): Promise<Result & { marked?: number }> {
  const user = await guard();
  if (!user) return { ok: false, error: "forbidden" };
  if (!isPeriod(period)) return { ok: false, error: "validation" };
  const teacher = await prisma.teacher.findFirst({ where: { id: teacherId, organizationId: user.orgId } });
  if (!teacher) return { ok: false, error: "notFound" };

  const today = toCenterParts(new Date()).date;
  const startIso = teacher.workStartDate ? toISODate(teacher.workStartDate) : "0000-00-00";
  const days = scheduledWorkDays(teacher.workDays, period).filter((d) => d <= today && d >= startIso);
  const res = await prisma.teacherAttendance.createMany({
    data: days.map((d) => ({ organizationId: user.orgId, teacherId, date: fromISODate(d), status: "PRESENT" as const, markedById: user.id })),
    skipDuplicates: true,
  });
  await logHistory(user, "teacher", teacherId, "attendance_bulk", { summary: `${period}: ${res.count}` });
  revalidatePath("/teacher-attendance");
  return { ok: true, marked: res.count };
}

/** Ish jadvali va oylik. Oylik (`fixedSalary`) faqat `salary:read` ruxsati borlar uchun o'zgaradi. */
export async function saveTeacherSchedule(teacherId: string, input: TeacherScheduleInput): Promise<Result> {
  const user = await guard();
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = teacherScheduleSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, error: "validation", fieldErrors };
  }
  const d = parsed.data;
  const teacher = await prisma.teacher.findFirst({ where: { id: teacherId, organizationId: user.orgId }, select: { id: true } });
  if (!teacher) return { ok: false, error: "notFound" };

  await prisma.teacher.update({
    where: { id: teacherId },
    data: {
      workDays: d.workDays,
      workStart: d.workStart ?? null,
      workEnd: d.workEnd ?? null,
      workStartDate: d.workStartDate ? fromISODate(d.workStartDate) : null,
      ...(can(user.roles, "salary:read") && { fixedSalary: d.fixedSalary ?? null }),
    },
  });
  await logHistory(user, "teacher", teacherId, "schedule_updated");
  revalidatePath("/teacher-attendance");
  revalidatePath(`/teachers/${teacherId}`);
  return { ok: true };
}

