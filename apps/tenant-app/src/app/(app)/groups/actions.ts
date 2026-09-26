"use server";

import { revalidatePath } from "next/cache";
import { prisma, recalculateStudentGroup } from "@markazai/db";
import {
  GROUP_STATUSES,
  fromISODate,
  toISODate,
  groupSchema,
  schedulesOverlap,
  type ActionResult,
  type GroupInput,
} from "@markazai/types";
import { logHistory } from "@/lib/history";
import { can } from "@/lib/permissions";
import { requirePermission, type SessionUser } from "@/lib/session";

type Result<T = object> = ActionResult<T> & { fieldErrors?: Record<string, string> };

async function guard(permission: Parameters<typeof requirePermission>[0]): Promise<SessionUser | null> {
  try {
    return await requirePermission(permission);
  } catch {
    return null;
  }
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

type ValidGroup = ReturnType<typeof groupSchema.parse>;

/** Kurs/o'qituvchi/xona/teglar shu tashkilotga tegishli ekanini va jadval to'qnashuvini tekshiradi. */
async function validateRefs(user: SessionUser, d: ValidGroup, excludeGroupId?: string): Promise<{ error: string; field?: string } | { tagIds: string[] }> {
  const [course, teacher, room, tags] = await Promise.all([
    prisma.course.findFirst({ where: { id: d.courseId, organizationId: user.orgId }, select: { id: true } }),
    prisma.teacher.findFirst({ where: { id: d.teacherId, organizationId: user.orgId }, select: { id: true } }),
    d.roomId ? prisma.room.findFirst({ where: { id: d.roomId, organizationId: user.orgId }, select: { id: true } }) : Promise.resolve(true),
    d.tagIds.length ? prisma.tag.findMany({ where: { organizationId: user.orgId, id: { in: d.tagIds } }, select: { id: true } }) : Promise.resolve([]),
  ]);
  if (!course) return { error: "validation", field: "courseId" };
  if (!teacher) return { error: "validation", field: "teacherId" };
  if (!room) return { error: "validation", field: "roomId" };

  const mine = {
    days: d.days,
    customDays: d.customDays,
    startTime: d.startTime,
    durationMinutes: d.durationMinutes,
    startDate: fromISODate(d.startDate),
    endDate: d.endDate ? fromISODate(d.endDate) : null,
  };
  const others = await prisma.group.findMany({
    where: {
      organizationId: user.orgId,
      status: "ACTIVE",
      id: excludeGroupId ? { not: excludeGroupId } : undefined,
      OR: [{ teacherId: d.teacherId }, ...(d.roomId ? [{ roomId: d.roomId }] : [])],
    },
    select: { teacherId: true, roomId: true, days: true, customDays: true, startTime: true, durationMinutes: true, startDate: true, endDate: true },
  });
  for (const o of others) {
    if (!schedulesOverlap(mine, o)) continue;
    if (d.roomId && o.roomId === d.roomId) return { error: "roomConflict", field: "roomId" };
    if (o.teacherId === d.teacherId) return { error: "teacherConflict", field: "teacherId" };
  }
  return { tagIds: (tags as { id: string }[]).map((t) => t.id) };
}

/**
 * Lidlar doskasidagi "Set" ro'yxatidan guruh ochilganda: ro'yxatdagi lidlar SINOV holatidagi talaba sifatida
 * guruhga qo'shiladi va doskadan chiqadi. Shu telefonli talaba bor bo'lsa, yangisi yaratilmaydi (mavjudi qo'shiladi).
 * Talaba faollashtirilgach (holat ACTIVE) to'lov hisobi boshlanadi.
 */
async function enrollLeadsFromList(user: SessionUser, groupId: string, listId: string, joinedAt: Date): Promise<number> {
  if (!can(user.roles, "leads:write") || !can(user.roles, "students:write")) return 0;
  const leads = await prisma.lead.findMany({
    where: { organizationId: user.orgId, listId, convertedStudentId: null, archivedAt: null },
    include: { tags: true },
    orderBy: { position: "asc" },
  });
  let count = 0;
  for (const lead of leads) {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.student.findFirst({ where: { organizationId: user.orgId, phone: lead.phone }, select: { id: true, status: true } });
      const studentId =
        existing?.id ??
        (
          await tx.student.create({
            data: {
              organizationId: user.orgId,
              name: lead.name,
              phone: lead.phone,
              note: lead.note,
              status: "TRIAL",
              tags: { create: lead.tags.map((t) => ({ organizationId: user.orgId, tagId: t.tagId })) },
            },
          })
        ).id;
      // Guruhsiz/tark etgan mavjud talaba ham sinovga o'tadi; faol/muzlatilgan holat o'zgarmaydi.
      if (existing && ["NO_GROUP", "LEFT_ACTIVE_GROUP", "LEFT_AFTER_TRIAL"].includes(existing.status)) await tx.student.update({ where: { id: existing.id }, data: { status: "TRIAL" } });
      await tx.groupStudent.upsert({
        where: { groupId_studentId: { groupId, studentId } },
        update: { leftAt: null, joinedAt },
        create: { organizationId: user.orgId, groupId, studentId, joinedAt },
      });
      await tx.lead.update({ where: { id: lead.id }, data: { convertedStudentId: studentId, convertedAt: new Date() } });
    });
    await logHistory(user, "lead", lead.id, "converted", { studentName: lead.name });
    count++;
  }
  // Barcha lidlar ko'chgach, bo'shab qolgan "guruh to'plami" ro'yxatining o'zi ham doskadan olib tashlanadi.
  if ((await prisma.lead.count({ where: { organizationId: user.orgId, listId, convertedStudentId: null, archivedAt: null } })) === 0) {
    await prisma.leadList.deleteMany({ where: { id: listId, organizationId: user.orgId } });
  }
  return count;
}

export async function createGroup(input: GroupInput, fromListId?: string): Promise<Result<{ id: string; enrolled?: number }>> {
  const user = await guard("groups:write");
  if (!user) return { ok: false, error: "forbidden" };

  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;

  const refs = await validateRefs(user, d);
  if ("error" in refs) return { ok: false, error: refs.error, fieldErrors: refs.field ? { [refs.field]: refs.error } : undefined };

  if (await prisma.group.findFirst({ where: { organizationId: user.orgId, name: d.name }, select: { id: true } })) {
    return { ok: false, error: "validation", fieldErrors: { name: "nameTaken" } };
  }

  const group = await prisma.group.create({
    data: {
      organizationId: user.orgId,
      name: d.name,
      courseId: d.courseId,
      teacherId: d.teacherId,
      roomId: d.roomId,
      days: d.days,
      customDays: d.days === "OTHER" ? d.customDays : [],
      startTime: d.startTime,
      durationMinutes: d.durationMinutes,
      startDate: fromISODate(d.startDate),
      endDate: d.endDate ? fromISODate(d.endDate) : null,
      price: d.price,
      tags: { create: refs.tagIds.map((tagId) => ({ organizationId: user.orgId, tagId })) },
    },
  });
  await logHistory(user, "group", group.id, "created");
  let enrolled = 0;
  if (fromListId && /^[0-9a-f-]{36}$/i.test(fromListId)) {
    const list = await prisma.leadList.findFirst({ where: { id: fromListId, organizationId: user.orgId }, select: { id: true } });
    if (list) enrolled = await enrollLeadsFromList(user, group.id, list.id, fromISODate(toISODate(new Date())));
    revalidatePath("/leads");
    revalidatePath("/students");
  }
  revalidatePath("/groups");
  return { ok: true, id: group.id, enrolled };
}

export async function updateGroup(id: string, input: GroupInput): Promise<Result> {
  const user = await guard("groups:write");
  if (!user) return { ok: false, error: "forbidden" };

  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;

  const existing = await prisma.group.findFirst({ where: { id, organizationId: user.orgId } });
  if (!existing) return { ok: false, error: "notFound" };

  const refs = await validateRefs(user, d, id);
  if ("error" in refs) return { ok: false, error: refs.error, fieldErrors: refs.field ? { [refs.field]: refs.error } : undefined };

  if (await prisma.group.findFirst({ where: { organizationId: user.orgId, name: d.name, id: { not: id } }, select: { id: true } })) {
    return { ok: false, error: "validation", fieldErrors: { name: "nameTaken" } };
  }

  await prisma.$transaction([
    prisma.group.update({
      where: { id },
      data: {
        name: d.name,
        courseId: d.courseId,
        teacherId: d.teacherId,
        roomId: d.roomId ?? null,
        days: d.days,
        customDays: d.days === "OTHER" ? d.customDays : [],
        startTime: d.startTime,
        durationMinutes: d.durationMinutes,
        startDate: fromISODate(d.startDate),
        endDate: d.endDate ? fromISODate(d.endDate) : null,
        price: d.price,
      },
    }),
    prisma.groupTag.deleteMany({ where: { groupId: id } }),
    prisma.groupTag.createMany({ data: refs.tagIds.map((tagId) => ({ organizationId: user.orgId, groupId: id, tagId })) }),
  ]);
  // Narx yoki dars kunlari o'zgarsa, bugundan keyingi (belgilangan) darslar yangi shartlar bilan qayta hisoblanadi;
  // o'tgan darslar tarixiy narxda qoladi.
  const scheduleChanged = existing.price !== d.price || existing.days !== d.days || existing.customDays.join() !== (d.days === "OTHER" ? d.customDays : []).join();
  if (scheduleChanged) {
    const from = fromISODate(new Date().toISOString().slice(0, 10));
    const members = await prisma.groupStudent.findMany({ where: { groupId: id, leftAt: null }, select: { studentId: true } });
    for (const m of members) await recalculateStudentGroup(prisma, { organizationId: user.orgId, groupId: id, studentId: m.studentId, from });
  }
  await logHistory(user, "group", id, "updated");
  revalidatePath("/groups");
  revalidatePath(`/groups/${id}`);
  return { ok: true };
}

export async function setGroupStatus(id: string, status: string): Promise<Result> {
  const user = await guard("groups:write");
  if (!user) return { ok: false, error: "forbidden" };
  if (!(GROUP_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "validation" };

  const group = await prisma.group.findFirst({ where: { id, organizationId: user.orgId }, select: { status: true } });
  if (!group) return { ok: false, error: "notFound" };

  await prisma.group.update({ where: { id }, data: { status: status as (typeof GROUP_STATUSES)[number] } });
  await logHistory(user, "group", id, "group_status_changed", { from: group.status, to: status });
  revalidatePath("/groups");
  revalidatePath(`/groups/${id}`);
  return { ok: true };
}

/** Faqat a'zolari bo'lmagan guruhni o'chirish mumkin; aks holda arxivga o'tkazish kerak. */
export async function deleteGroup(id: string): Promise<Result> {
  const user = await guard("groups:delete");
  if (!user) return { ok: false, error: "forbidden" };

  const group = await prisma.group.findFirst({
    where: { id, organizationId: user.orgId },
    select: { _count: { select: { enrollments: true, payments: true } } },
  });
  if (!group) return { ok: false, error: "notFound" };
  if (group._count.enrollments > 0 || group._count.payments > 0) return { ok: false, error: "hasStudents" };

  await prisma.group.delete({ where: { id } });
  revalidatePath("/groups");
  return { ok: true };
}
