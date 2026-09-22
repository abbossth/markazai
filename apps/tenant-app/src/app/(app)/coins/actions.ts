"use server";

import { gamificationActive } from "@/lib/plan";
import { revalidatePath } from "next/cache";
import { prisma } from "@markazai/db";
import { coinAwardSchema, toCenterParts, fromISODate, type ActionResult, type CoinAwardInput } from "@markazai/types";
import { logHistory } from "@/lib/history";
import { isTeacherOnly } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";

type Result = ActionResult & { fieldErrors?: Record<string, string> };

/**
 * Qo'lda coin berish/ayirish. Faqat gamifikatsiya yoqilgan bo'lsa; davomat huquqi kerak;
 * faqat-o'qituvchi faqat o'z guruhidagi talabaga bera oladi (guruh ko'rsatilishi shart).
 */
export async function awardCoins(studentId: string, input: CoinAwardInput): Promise<Result> {
  let user;
  try {
    user = await requirePermission("attendance:write");
  } catch {
    return { ok: false, error: "forbidden" };
  }
  const parsed = coinAwardSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, error: "validation", fieldErrors };
  }
  const d = parsed.data;

  const settings = await prisma.centerSettings.findUnique({ where: { organizationId: user.orgId }, select: { gamificationEnabled: true } });
  if (!(await gamificationActive(settings?.gamificationEnabled))) return { ok: false, error: "disabled" };

  const student = await prisma.student.findFirst({ where: { id: studentId, organizationId: user.orgId }, select: { id: true, name: true } });
  if (!student) return { ok: false, error: "notFound" };

  if (d.groupId) {
    const member = await prisma.groupStudent.findFirst({ where: { groupId: d.groupId, studentId, organizationId: user.orgId }, select: { id: true } });
    if (!member) return { ok: false, error: "validation", fieldErrors: { groupId: "invalid" } };
  }
  if (isTeacherOnly(user.roles)) {
    const teacher = await prisma.teacher.findFirst({ where: { organizationId: user.orgId, userId: user.id }, select: { id: true } });
    const allowed = d.groupId && teacher ? await prisma.group.findFirst({ where: { id: d.groupId, organizationId: user.orgId, teacherId: teacher.id }, select: { id: true } }) : null;
    if (!allowed) return { ok: false, error: "forbidden" };
  }

  // Ayirish talabaning coinini manfiyga tushirmasin (umumiy hisob).
  if (d.amount < 0) {
    const total = (await prisma.coinLog.aggregate({ where: { organizationId: user.orgId, studentId }, _sum: { amount: true } }))._sum.amount ?? 0;
    if (total + d.amount < 0) return { ok: false, error: "validation", fieldErrors: { amount: "coinsBelowZero" } };
  }

  await prisma.coinLog.create({
    data: { organizationId: user.orgId, studentId, groupId: d.groupId ?? null, amount: d.amount, kind: "MANUAL", reason: d.reason, date: fromISODate(toCenterParts(new Date()).date), createdById: user.id },
  });
  await logHistory(user, "student", studentId, "coins", { summary: `${d.amount > 0 ? "+" : ""}${d.amount}: ${d.reason}` });
  revalidatePath(`/students/${studentId}`);
  if (d.groupId) revalidatePath(`/groups/${d.groupId}`);
  return { ok: true };
}
