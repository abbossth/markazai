"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@markazai/db";
import { fromISODate, teacherSchema, type ActionResult, type TeacherInput, type TeacherOutput } from "@markazai/types";
import { logHistory } from "@/lib/history";
import { can } from "@/lib/permissions";
import { requirePermission, type SessionUser } from "@/lib/session";

type Result<T = object> = ActionResult<T> & { fieldErrors?: Record<string, string> };

async function guard(): Promise<SessionUser | null> {
  try {
    return await requirePermission("teachers:write");
  } catch {
    return null;
  }
}

function issues(list: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of list) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

async function validBranchIds(user: SessionUser, ids: string[]) {
  if (ids.length === 0) return [];
  return (await prisma.branch.findMany({ where: { organizationId: user.orgId, id: { in: ids } }, select: { id: true } })).map((b) => b.id);
}

/**
 * Maosh maydonlari faqat `salary:read` ruxsati borlar uchun o'zgaradi. Boshqalar (masalan, administrator)
 * o'qituvchi yarata/tahrirlay oladi, lekin maoshga tegmaydi.
 */
function salaryData(user: SessionUser, d: TeacherOutput) {
  if (!can(user.roles, "salary:read")) return {};
  return {
    salaryType: d.salaryType,
    percent: d.salaryType === "PERCENT" ? (d.percent ?? 0) : null,
    fixedSalary: d.salaryType === "FIXED" ? (d.fixedSalary ?? 0) : null,
    workDays: d.workDays,
    workStart: d.workStart ?? null,
    workEnd: d.workEnd ?? null,
    workStartDate: d.workStartDate ? fromISODate(d.workStartDate) : null,
  };
}

export async function createTeacher(input: TeacherInput): Promise<Result<{ id: string }>> {
  const user = await guard();
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = teacherSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: issues(parsed.error.issues) };
  const d = parsed.data;

  if (await prisma.teacher.findFirst({ where: { organizationId: user.orgId, phone: d.phone }, select: { id: true } })) {
    return { ok: false, error: "validation", fieldErrors: { phone: "phoneTaken" } };
  }
  if (d.password && (await prisma.user.findFirst({ where: { organizationId: user.orgId, phone: d.phone }, select: { id: true } }))) {
    return { ok: false, error: "validation", fieldErrors: { phone: "phoneTaken" } };
  }
  const branchIds = await validBranchIds(user, d.branchIds);
  const passwordHash = d.password ? await bcrypt.hash(d.password, 10) : null;

  const teacher = await prisma.$transaction(async (tx) => {
    const login = passwordHash
      ? await tx.user.create({ data: { organizationId: user.orgId, name: d.name, phone: d.phone, roles: ["TEACHER"], position: "O'qituvchi", passwordHash } })
      : null;
    return tx.teacher.create({
      data: {
        organizationId: user.orgId,
        userId: login?.id,
        name: d.name,
        phone: d.phone,
        birthDate: d.birthDate ? fromISODate(d.birthDate) : null,
        gender: d.gender,
        ...salaryData(user, d),
        branches: { create: branchIds.map((branchId) => ({ organizationId: user.orgId, branchId })) },
      },
    });
  });
  await logHistory(user, "teacher", teacher.id, "created");
  revalidatePath("/teachers");
  return { ok: true, id: teacher.id };
}

export async function updateTeacher(id: string, input: TeacherInput): Promise<Result> {
  const user = await guard();
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = teacherSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: issues(parsed.error.issues) };
  const d = parsed.data;

  const existing = await prisma.teacher.findFirst({ where: { id, organizationId: user.orgId } });
  if (!existing) return { ok: false, error: "notFound" };
  if (d.phone !== existing.phone && (await prisma.teacher.findFirst({ where: { organizationId: user.orgId, phone: d.phone, id: { not: id } }, select: { id: true } }))) {
    return { ok: false, error: "validation", fieldErrors: { phone: "phoneTaken" } };
  }

  // Kirish (login): parol berilsa — yaratiladi yoki yangilanadi; telefon o'zgarsa, login telefoni ham o'zgaradi.
  const otherUserWithPhone = await prisma.user.findFirst({ where: { organizationId: user.orgId, phone: d.phone, id: { not: existing.userId ?? undefined } }, select: { id: true } });
  if ((d.password || existing.userId) && d.phone !== existing.phone && otherUserWithPhone) {
    return { ok: false, error: "validation", fieldErrors: { phone: "phoneTaken" } };
  }
  if (d.password && !existing.userId && otherUserWithPhone) return { ok: false, error: "validation", fieldErrors: { phone: "phoneTaken" } };

  const branchIds = await validBranchIds(user, d.branchIds);
  const passwordHash = d.password ? await bcrypt.hash(d.password, 10) : null;

  await prisma.$transaction(async (tx) => {
    let userId = existing.userId;
    if (userId) {
      await tx.user.update({ where: { id: userId }, data: { name: d.name, phone: d.phone, ...(passwordHash && { passwordHash }) } });
    } else if (passwordHash) {
      userId = (await tx.user.create({ data: { organizationId: user.orgId, name: d.name, phone: d.phone, roles: ["TEACHER"], position: "O'qituvchi", passwordHash } })).id;
    }
    await tx.teacher.update({
      where: { id },
      data: {
        userId,
        name: d.name,
        phone: d.phone,
        birthDate: d.birthDate ? fromISODate(d.birthDate) : null,
        gender: d.gender ?? null,
        ...salaryData(user, d),
      },
    });
    await tx.teacherBranch.deleteMany({ where: { teacherId: id } });
    await tx.teacherBranch.createMany({ data: branchIds.map((branchId) => ({ organizationId: user.orgId, teacherId: id, branchId })) });
  });
  await logHistory(user, "teacher", id, "updated");
  revalidatePath("/teachers");
  revalidatePath(`/teachers/${id}`);
  return { ok: true };
}

/** Nofaol o'qituvchi yangi guruh uchun tanlanmaydi va tizimga kira olmaydi. */
export async function setTeacherActive(id: string, isActive: boolean): Promise<Result> {
  const user = await guard();
  if (!user) return { ok: false, error: "forbidden" };
  const teacher = await prisma.teacher.findFirst({ where: { id, organizationId: user.orgId } });
  if (!teacher) return { ok: false, error: "notFound" };

  await prisma.$transaction([
    prisma.teacher.update({ where: { id }, data: { isActive } }),
    ...(teacher.userId ? [prisma.user.update({ where: { id: teacher.userId }, data: { isActive } })] : []),
  ]);
  await logHistory(user, "teacher", id, isActive ? "activated" : "deactivated");
  revalidatePath("/teachers");
  revalidatePath(`/teachers/${id}`);
  return { ok: true };
}

/** Guruhi yoki ish haqi to'lovi bor o'qituvchini o'chirib bo'lmaydi — nofaol qilish kerak. */
export async function deleteTeacher(id: string): Promise<Result> {
  const user = await guard();
  if (!user) return { ok: false, error: "forbidden" };
  const teacher = await prisma.teacher.findFirst({
    where: { id, organizationId: user.orgId },
    select: { userId: true, _count: { select: { groups: true, salaryPayments: true } } },
  });
  if (!teacher) return { ok: false, error: "notFound" };
  if (teacher._count.groups > 0 || teacher._count.salaryPayments > 0) return { ok: false, error: "hasRecords" };

  await prisma.$transaction([prisma.teacher.delete({ where: { id } }), ...(teacher.userId ? [prisma.user.delete({ where: { id: teacher.userId } })] : [])]);
  revalidatePath("/teachers");
  return { ok: true };
}
