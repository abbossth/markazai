"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@markazai/db";
import { fromISODate, toISODate, type ActionResult } from "@markazai/types";
import { logHistory } from "@/lib/history";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

/**
 * Lidni talabaga aylantiradi: yangi Student yaratiladi (lidning ismi, telefoni, izohi, teglari),
 * ixtiyoriy ravishda guruhga qo'shiladi. Lid doskadan yo'qoladi, lekin konversiya hisoboti uchun saqlanadi.
 */
export async function convertLeadToStudent(
  leadId: string,
  opts: { groupId?: string; joinedAt?: string },
  force = false,
): Promise<ActionResult<{ studentId: string }> & { duplicate?: { id: string; name: string } }> {
  const user = await requireUser();
  if (!can(user.roles, "leads:write") || !can(user.roles, "students:write")) return { ok: false, error: "forbidden" };

  const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId: user.orgId }, include: { tags: true } });
  if (!lead) return { ok: false, error: "notFound" };
  if (lead.convertedStudentId) return { ok: false, error: "alreadyConverted" };

  // Shu telefon raqamli talaba allaqachon bo'lsa (masalan, boshqa xodim uni qo'lda ham qo'shib qo'ygan bo'lsa)
  // — taqiqlanmaydi, faqat ogohlantiriladi (qarang: students/actions.ts createStudent'dagi bir xil izoh).
  if (!force) {
    const dup = await prisma.student.findFirst({ where: { organizationId: user.orgId, phone: lead.phone }, select: { id: true, name: true } });
    if (dup) return { ok: false, error: "duplicatePhone", duplicate: dup };
  }

  let groupId: string | undefined;
  if (opts.groupId) {
    const group = await prisma.group.findFirst({ where: { id: opts.groupId, organizationId: user.orgId }, select: { id: true, status: true } });
    if (!group) return { ok: false, error: "notFound" };
    if (group.status !== "ACTIVE") return { ok: false, error: "groupInactive" };
    groupId = group.id;
  }
  const joinedAt = opts.joinedAt && /^\d{4}-\d{2}-\d{2}$/.test(opts.joinedAt) ? fromISODate(opts.joinedAt) : fromISODate(toISODate(new Date()));

  const student = await prisma.$transaction(async (tx) => {
    const s = await tx.student.create({
      data: {
        organizationId: user.orgId,
        name: lead.name,
        phone: lead.phone,
        note: lead.note,
        status: groupId ? "ACTIVE" : "NO_GROUP",
        tags: { create: lead.tags.map((t) => ({ organizationId: user.orgId, tagId: t.tagId })) },
        ...(groupId && { enrollments: { create: { organizationId: user.orgId, groupId, joinedAt } } }),
      },
    });
    await tx.lead.update({ where: { id: leadId }, data: { convertedStudentId: s.id, convertedAt: new Date() } });
    return s;
  });

  await logHistory(user, "lead", leadId, "converted", { studentName: student.name });
  await logHistory(user, "student", student.id, "created_from_lead", { leadName: lead.name });
  if (groupId) await logHistory(user, "group", groupId, "student_joined", { studentId: student.id, studentName: student.name });
  revalidatePath("/leads");
  revalidatePath("/students");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true, studentId: student.id };
}
