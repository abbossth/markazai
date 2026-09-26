"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@markazai/db";
import { z } from "zod";
import type { ActionResult } from "@markazai/types";
import { canAccess } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

const bodySchema = z.string().trim().min(1, "required").max(2000);

type Target = { studentId: string } | { groupId: string } | { leadId: string } | { teacherId: string };

export async function addComment(target: Target, body: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: "validation" };

  if ("studentId" in target) {
    if (!canAccess(user.roles, "students")) return { ok: false, error: "forbidden" };
    const exists = await prisma.student.findFirst({ where: { id: target.studentId, organizationId: user.orgId }, select: { id: true } });
    if (!exists) return { ok: false, error: "notFound" };
    await prisma.comment.create({ data: { organizationId: user.orgId, authorId: user.id, studentId: target.studentId, body: parsed.data } });
    revalidatePath(`/students/${target.studentId}`);
  } else if ("leadId" in target) {
    if (!canAccess(user.roles, "leads")) return { ok: false, error: "forbidden" };
    const exists = await prisma.lead.findFirst({ where: { id: target.leadId, organizationId: user.orgId }, select: { id: true } });
    if (!exists) return { ok: false, error: "notFound" };
    await prisma.comment.create({ data: { organizationId: user.orgId, authorId: user.id, leadId: target.leadId, body: parsed.data } });
    revalidatePath(`/leads/${target.leadId}`);
  } else if ("teacherId" in target) {
    if (!canAccess(user.roles, "teachers")) return { ok: false, error: "forbidden" };
    const exists = await prisma.teacher.findFirst({ where: { id: target.teacherId, organizationId: user.orgId }, select: { id: true } });
    if (!exists) return { ok: false, error: "notFound" };
    await prisma.comment.create({ data: { organizationId: user.orgId, authorId: user.id, teacherId: target.teacherId, body: parsed.data } });
    revalidatePath(`/teachers/${target.teacherId}`);
  } else {
    if (!canAccess(user.roles, "groups")) return { ok: false, error: "forbidden" };
    const exists = await prisma.group.findFirst({ where: { id: target.groupId, organizationId: user.orgId }, select: { id: true } });
    if (!exists) return { ok: false, error: "notFound" };
    await prisma.comment.create({ data: { organizationId: user.orgId, authorId: user.id, groupId: target.groupId, body: parsed.data } });
    revalidatePath(`/groups/${target.groupId}`);
  }
  return { ok: true };
}

/** Izohni muallifi yoki CEO o'chira oladi. */
export async function deleteComment(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const comment = await prisma.comment.findFirst({ where: { id, organizationId: user.orgId } });
  if (!comment) return { ok: false, error: "notFound" };
  if (comment.authorId !== user.id && !user.roles.includes("CEO")) return { ok: false, error: "forbidden" };

  await prisma.comment.delete({ where: { id } });
  if (comment.studentId) revalidatePath(`/students/${comment.studentId}`);
  if (comment.groupId) revalidatePath(`/groups/${comment.groupId}`);
  if (comment.leadId) revalidatePath(`/leads/${comment.leadId}`);
  if (comment.teacherId) revalidatePath(`/teachers/${comment.teacherId}`);
  return { ok: true };
}
