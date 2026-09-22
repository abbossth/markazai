"use server";

import { canAddWithinPlan } from "@/lib/plan";
import { revalidatePath } from "next/cache";
import { prisma } from "@markazai/db";
import {
  fromISODate,
  studentSchema,
  studentStatusSchema,
  toISODate,
  type ActionResult,
  type StudentInput,
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

const today = () => fromISODate(toISODate(new Date()));

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

export async function createStudent(input: StudentInput): Promise<Result<{ id: string }>> {
  const user = await guard("students:write");
  if (!user) return { ok: false, error: "forbidden" };

  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;
  if (!(await canAddWithinPlan("students"))) return { ok: false, error: "planLimit" };

  // Guruh va teglar shu tashkilotga tegishli ekanini tekshirish.
  let groupId: string | undefined;
  if (d.groupId) {
    const group = await prisma.group.findFirst({
      where: { id: d.groupId, organizationId: user.orgId },
      select: { id: true, status: true },
    });
    if (!group) return { ok: false, error: "notFound" };
    if (group.status !== "ACTIVE") return { ok: false, error: "groupInactive" };
    groupId = group.id;
  }
  const tagIds = d.tagIds.length
    ? (await prisma.tag.findMany({ where: { organizationId: user.orgId, id: { in: d.tagIds } }, select: { id: true } })).map((t) => t.id)
    : [];

  const student = await prisma.$transaction(async (tx) => {
    const s = await tx.student.create({
      data: {
        organizationId: user.orgId,
        name: d.name,
        phone: d.phone,
        extraPhones: d.extraPhones,
        birthDate: d.birthDate ? fromISODate(d.birthDate) : null,
        gender: d.gender,
        note: d.note,
        contactPerson: d.contactPerson,
        email: d.email,
        telegram: d.telegram,
        socialLink: d.socialLink,
        address: d.address,
        externalId: d.externalId,
        status: groupId ? "ACTIVE" : "NO_GROUP",
        tags: { create: tagIds.map((tagId) => ({ organizationId: user.orgId, tagId })) },
        ...(groupId && {
          enrollments: {
            create: { organizationId: user.orgId, groupId, joinedAt: d.joinedAt ? fromISODate(d.joinedAt) : today() },
          },
        }),
      },
    });
    return s;
  });

  await logHistory(user, "student", student.id, "created");
  if (groupId) await logHistory(user, "group", groupId, "student_joined", { studentId: student.id, studentName: student.name });
  revalidatePath("/students");
  return { ok: true, id: student.id };
}

export async function updateStudent(id: string, input: StudentInput): Promise<Result> {
  const user = await guard("students:write");
  if (!user) return { ok: false, error: "forbidden" };

  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;

  const existing = await prisma.student.findFirst({ where: { id, organizationId: user.orgId }, select: { id: true } });
  if (!existing) return { ok: false, error: "notFound" };

  const tagIds = d.tagIds.length
    ? (await prisma.tag.findMany({ where: { organizationId: user.orgId, id: { in: d.tagIds } }, select: { id: true } })).map((t) => t.id)
    : [];

  await prisma.$transaction([
    prisma.student.update({
      where: { id },
      data: {
        name: d.name,
        phone: d.phone,
        extraPhones: d.extraPhones,
        birthDate: d.birthDate ? fromISODate(d.birthDate) : null,
        gender: d.gender ?? null,
        note: d.note ?? null,
        contactPerson: d.contactPerson ?? null,
        email: d.email ?? null,
        telegram: d.telegram ?? null,
        socialLink: d.socialLink ?? null,
        address: d.address ?? null,
        externalId: d.externalId ?? null,
      },
    }),
    prisma.studentTag.deleteMany({ where: { studentId: id } }),
    prisma.studentTag.createMany({ data: tagIds.map((tagId) => ({ organizationId: user.orgId, studentId: id, tagId })) }),
  ]);

  await logHistory(user, "student", id, "updated");
  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  return { ok: true };
}

export async function setStudentStatus(id: string, input: { status: string; freezeReason?: string }): Promise<Result> {
  const user = await guard("students:write");
  if (!user) return { ok: false, error: "forbidden" };

  const parsed = studentStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };

  const existing = await prisma.student.findFirst({ where: { id, organizationId: user.orgId }, select: { status: true } });
  if (!existing) return { ok: false, error: "notFound" };

  const { status, freezeReason } = parsed.data;
  await prisma.student.update({
    where: { id },
    data: { status, freezeReason: status === "FROZEN" ? freezeReason : null },
  });
  await logHistory(user, "student", id, "status_changed", { from: existing.status, to: status, reason: freezeReason });
  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  return { ok: true };
}

/** Bir yoki bir nechta talabani guruhga qo'shadi. Allaqachon a'zo bo'lganlar o'tkazib yuboriladi. */
export async function addStudentsToGroup(
  studentIds: string[],
  groupId: string,
  joinedAt?: string,
): Promise<Result<{ added: number; skipped: number; overCapacity: boolean }>> {
  const user = await guard("students:write");
  if (!user) return { ok: false, error: "forbidden" };
  if (studentIds.length === 0) return { ok: false, error: "validation" };

  const group = await prisma.group.findFirst({
    where: { id: groupId, organizationId: user.orgId },
    include: { room: { select: { capacity: true } } },
  });
  if (!group) return { ok: false, error: "notFound" };
  if (group.status !== "ACTIVE") return { ok: false, error: "groupInactive" };

  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, organizationId: user.orgId },
    select: { id: true, name: true, status: true, enrollments: { where: { groupId }, select: { id: true, leftAt: true } } },
  });

  const date = joinedAt && /^\d{4}-\d{2}-\d{2}$/.test(joinedAt) ? fromISODate(joinedAt) : today();
  let added = 0;
  let skipped = 0;

  for (const s of students) {
    const existing = s.enrollments[0];
    if (existing && !existing.leftAt) {
      skipped++;
      continue;
    }
    // Statuslar: guruhsiz/tark etgan talaba faollashadi; muzlatilgan/sinov o'zgarmaydi.
    const activate = s.status === "NO_GROUP" || s.status === "LEFT_ACTIVE_GROUP" || s.status === "LEFT_AFTER_TRIAL";
    await prisma.$transaction([
      existing
        ? prisma.groupStudent.update({ where: { id: existing.id }, data: { leftAt: null, joinedAt: date } })
        : prisma.groupStudent.create({ data: { organizationId: user.orgId, groupId, studentId: s.id, joinedAt: date } }),
      ...(activate ? [prisma.student.update({ where: { id: s.id }, data: { status: "ACTIVE" } })] : []),
    ]);
    await logHistory(user, "student", s.id, "joined_group", { groupId, groupName: group.name });
    await logHistory(user, "group", groupId, "student_joined", { studentId: s.id, studentName: s.name });
    added++;
  }

  const activeCount = await prisma.groupStudent.count({ where: { groupId, leftAt: null } });
  const overCapacity = !!group.room && activeCount > group.room.capacity;

  revalidatePath("/students");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/groups");
  return { ok: true, added, skipped, overCapacity };
}

/** Talabani guruhdan chiqaradi (arxivga o'tkazadi); qolgan faol guruhi bo'lmasa, status yangilanadi. */
export async function removeStudentFromGroup(studentId: string, groupId: string): Promise<Result> {
  const user = await guard("students:write");
  if (!user) return { ok: false, error: "forbidden" };

  const enrollment = await prisma.groupStudent.findFirst({
    where: { studentId, groupId, leftAt: null, organizationId: user.orgId },
    include: { group: { select: { name: true } }, student: { select: { name: true, status: true } } },
  });
  if (!enrollment) return { ok: false, error: "notFound" };

  const remaining = await prisma.groupStudent.count({ where: { studentId, leftAt: null, groupId: { not: groupId } } });
  const status = enrollment.student.status;
  const nextStatus =
    remaining > 0 ? null : status === "ACTIVE" ? "LEFT_ACTIVE_GROUP" : status === "TRIAL" ? "LEFT_AFTER_TRIAL" : null;

  await prisma.$transaction([
    prisma.groupStudent.update({ where: { id: enrollment.id }, data: { leftAt: today() } }),
    ...(nextStatus ? [prisma.student.update({ where: { id: studentId }, data: { status: nextStatus } })] : []),
  ]);
  await logHistory(user, "student", studentId, "left_group", { groupId, groupName: enrollment.group.name });
  await logHistory(user, "group", groupId, "student_left", { studentId, studentName: enrollment.student.name });
  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

export async function deleteStudent(id: string): Promise<Result> {
  const user = await guard("students:delete");
  if (!user) return { ok: false, error: "forbidden" };

  const student = await prisma.student.findFirst({
    where: { id, organizationId: user.orgId },
    select: { id: true, _count: { select: { payments: true } } },
  });
  if (!student) return { ok: false, error: "notFound" };
  // Moliyaviy tarix yo'qolmasligi uchun to'lovi bor talabani o'chirib bo'lmaydi.
  if (student._count.payments > 0) return { ok: false, error: "hasPayments" };

  await prisma.student.delete({ where: { id } });
  revalidatePath("/students");
  return { ok: true };
}
