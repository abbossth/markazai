"use server";

import { revalidatePath } from "next/cache";
import { prisma, recalculateStudentGroup } from "@markazai/db";
import {
  courseSchema,
  fromISODate,
  holidayDates,
  holidaySchema,
  roomSchema,
  tagSchema,
  type CourseInput,
  type HolidayInput,
  type RoomInput,
  type TagInput,
} from "@markazai/types";
import { fieldErrorsOf, guardSettings, type Result } from "./guard";

const isUniqueViolation = (e: unknown) => (e as { code?: string } | null)?.code === "P2002";

// ───────────── Kurslar ─────────────

export async function saveCourse(id: string | null, input: CourseInput): Promise<Result> {
  const user = await guardSettings();
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  if (id) {
    const res = await prisma.course.updateMany({ where: { id, organizationId: user.orgId }, data: parsed.data });
    if (res.count === 0) return { ok: false, error: "notFound" };
  } else {
    await prisma.course.create({ data: { ...parsed.data, organizationId: user.orgId } });
  }
  revalidatePath("/settings/courses");
  return { ok: true };
}

/** Guruhi bor kursni o'chirib bo'lmaydi (guruhlar kursga bog'liq). Lidlardagi kurs bo'sh qoldiriladi. */
export async function deleteCourse(id: string): Promise<Result> {
  const user = await guardSettings();
  if (!user) return { ok: false, error: "forbidden" };
  if ((await prisma.group.count({ where: { organizationId: user.orgId, courseId: id } })) > 0) return { ok: false, error: "inUse" };
  const res = await prisma.course.deleteMany({ where: { id, organizationId: user.orgId } });
  if (res.count === 0) return { ok: false, error: "notFound" };
  revalidatePath("/settings/courses");
  return { ok: true };
}

// ───────────── Xonalar ─────────────

export async function saveRoom(id: string | null, input: RoomInput): Promise<Result> {
  const user = await guardSettings();
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = roomSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  try {
    if (id) {
      const res = await prisma.room.updateMany({ where: { id, organizationId: user.orgId }, data: parsed.data });
      if (res.count === 0) return { ok: false, error: "notFound" };
    } else {
      await prisma.room.create({ data: { ...parsed.data, organizationId: user.orgId } });
    }
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "validation", fieldErrors: { name: "nameTaken" } };
    throw e;
  }
  revalidatePath("/settings/rooms");
  return { ok: true };
}

export async function deleteRoom(id: string): Promise<Result> {
  const user = await guardSettings();
  if (!user) return { ok: false, error: "forbidden" };
  if ((await prisma.group.count({ where: { organizationId: user.orgId, roomId: id } })) > 0) return { ok: false, error: "inUse" };
  const res = await prisma.room.deleteMany({ where: { id, organizationId: user.orgId } });
  if (res.count === 0) return { ok: false, error: "notFound" };
  revalidatePath("/settings/rooms");
  return { ok: true };
}

// ───────────── Teglar ─────────────

export async function saveTag(id: string | null, input: TagInput): Promise<Result> {
  const user = await guardSettings();
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const data = { name: parsed.data.name, color: parsed.data.color ?? null };
  try {
    if (id) {
      const res = await prisma.tag.updateMany({ where: { id, organizationId: user.orgId }, data });
      if (res.count === 0) return { ok: false, error: "notFound" };
    } else {
      await prisma.tag.create({ data: { ...data, organizationId: user.orgId } });
    }
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "validation", fieldErrors: { name: "nameTaken" } };
    throw e;
  }
  revalidatePath("/settings/tags");
  return { ok: true };
}

/** Teg o'chirilganda uning biriktirmalari (talaba/guruh/lid/eslatma) ham o'chadi (cascade). */
export async function deleteTag(id: string): Promise<Result> {
  const user = await guardSettings();
  if (!user) return { ok: false, error: "forbidden" };
  const res = await prisma.tag.deleteMany({ where: { id, organizationId: user.orgId } });
  if (res.count === 0) return { ok: false, error: "notFound" };
  revalidatePath("/settings/tags");
  return { ok: true };
}

// ───────────── Dam olish kunlari ─────────────

/**
 * Dam olish kuni o'zgarganda (qo'shildi/o'chirildi) shu oydagi tizim yechimlari qayta hisoblanadi:
 * oylik narx haqiqiy darslar soniga bo'linadi, shuning uchun har bir darsning summasi o'zgaradi.
 */
async function recalcMonths(orgId: string, dates: string[]) {
  for (const month of new Set(dates.map((d) => d.slice(0, 7)))) {
    const [y, m] = month.split("-").map(Number) as [number, number];
    const pairs = await prisma.payment.findMany({
      where: { organizationId: orgId, type: "SYSTEM", lessonDate: { gte: new Date(Date.UTC(y, m - 1, 1)), lte: new Date(Date.UTC(y, m, 0)) } },
      select: { groupId: true, studentId: true },
      distinct: ["groupId", "studentId"],
    });
    for (const p of pairs) if (p.groupId) await recalculateStudentGroup(prisma, { organizationId: orgId, groupId: p.groupId, studentId: p.studentId, from: new Date(Date.UTC(y, m - 1, 1)) });
  }
}

export async function addHolidays(input: HolidayInput): Promise<Result<{ count: number }>> {
  const user = await guardSettings();
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = holidaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const dates = holidayDates(parsed.data.from, parsed.data.to);

  // Davomat belgilangan kunni dam olish kuniga aylantirib bo'lmaydi — avval belgilar olib tashlanishi kerak.
  if ((await prisma.attendance.count({ where: { organizationId: user.orgId, date: { in: dates.map(fromISODate) } } })) > 0) return { ok: false, error: "hasAttendance" };

  const res = await prisma.holiday.createMany({ data: dates.map((d) => ({ organizationId: user.orgId, date: fromISODate(d), name: parsed.data.name })), skipDuplicates: true });
  await recalcMonths(user.orgId, dates);
  revalidatePath("/settings/holidays");
  revalidatePath("/", "layout");
  return { ok: true, count: res.count };
}

export async function deleteHoliday(id: string): Promise<Result> {
  const user = await guardSettings();
  if (!user) return { ok: false, error: "forbidden" };
  const h = await prisma.holiday.findFirst({ where: { id, organizationId: user.orgId } });
  if (!h) return { ok: false, error: "notFound" };
  await prisma.holiday.delete({ where: { id } });
  await recalcMonths(user.orgId, [h.date.toISOString().slice(0, 10)]);
  revalidatePath("/settings/holidays");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ───────────── Arxiv ─────────────

export async function restoreGroup(id: string): Promise<Result> {
  const user = await guardSettings();
  if (!user) return { ok: false, error: "forbidden" };
  const res = await prisma.group.updateMany({ where: { id, organizationId: user.orgId, status: { not: "ACTIVE" } }, data: { status: "ACTIVE" } });
  if (res.count === 0) return { ok: false, error: "notFound" };
  revalidatePath("/settings/archive");
  revalidatePath("/groups");
  return { ok: true };
}
