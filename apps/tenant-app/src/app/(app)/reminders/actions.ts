"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@markazai/db";
import { fromCenterTime, reminderSchema, type ActionResult, type ReminderInput } from "@markazai/types";
import { logHistory } from "@/lib/history";
import { can, canAccess } from "@/lib/permissions";
import { requireUser, type SessionUser } from "@/lib/session";

type Result = ActionResult & { fieldErrors?: Record<string, string> };

function revalidateFor(r: { leadId: string | null; groupId: string | null; studentId: string | null }) {
  if (r.leadId) revalidatePath(`/leads/${r.leadId}`);
  if (r.groupId) revalidatePath(`/groups/${r.groupId}`);
  if (r.studentId) revalidatePath(`/students/${r.studentId}`);
  revalidatePath("/leads");
}

/** Bog'liq obyekt shu tashkilotga tegishli va foydalanuvchi uni ko'ra oladimi. */
async function linkAllowed(user: SessionUser, d: { leadId?: string; groupId?: string; studentId?: string }) {
  if (d.leadId) {
    if (!can(user.roles, "leads:write")) return false;
    return !!(await prisma.lead.findFirst({ where: { id: d.leadId, organizationId: user.orgId }, select: { id: true } }));
  }
  if (d.groupId) {
    if (!canAccess(user.roles, "groups") || user.roles.every((r) => r === "TEACHER")) return false;
    return !!(await prisma.group.findFirst({ where: { id: d.groupId, organizationId: user.orgId }, select: { id: true } }));
  }
  if (d.studentId) {
    if (!can(user.roles, "students:write")) return false;
    return !!(await prisma.student.findFirst({ where: { id: d.studentId, organizationId: user.orgId }, select: { id: true } }));
  }
  return false;
}

export async function createReminder(input: ReminderInput): Promise<Result> {
  const user = await requireUser();
  const parsed = reminderSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, error: "validation", fieldErrors };
  }
  const d = parsed.data;
  if (!(await linkAllowed(user, d))) return { ok: false, error: "forbidden" };

  const [responsible, tags] = await Promise.all([
    prisma.user.findFirst({ where: { id: d.responsibleId, organizationId: user.orgId, isActive: true }, select: { id: true } }),
    d.tagIds.length ? prisma.tag.findMany({ where: { organizationId: user.orgId, id: { in: d.tagIds } }, select: { id: true } }) : Promise.resolve([]),
  ]);
  if (!responsible) return { ok: false, error: "validation", fieldErrors: { responsibleId: "required" } };

  const reminder = await prisma.reminder.create({
    data: {
      organizationId: user.orgId,
      title: d.title,
      note: d.note,
      dueAt: fromCenterTime(d.dueDate, d.dueTime),
      responsibleId: d.responsibleId,
      leadId: d.leadId,
      groupId: d.groupId,
      studentId: d.studentId,
      createdById: user.id,
      tags: { create: tags.map((t) => ({ organizationId: user.orgId, tagId: t.id })) },
    },
  });
  if (d.leadId) await logHistory(user, "lead", d.leadId, "reminder_added", { summary: d.title });
  if (d.groupId) await logHistory(user, "group", d.groupId, "reminder_added", { summary: d.title });
  revalidateFor(reminder);
  return { ok: true };
}

/** Bajarildi belgisi: mas'ul xodim, yaratuvchi yoki CEO qo'ya oladi. */
export async function setReminderDone(id: string, done: boolean): Promise<Result> {
  const user = await requireUser();
  const reminder = await prisma.reminder.findFirst({ where: { id, organizationId: user.orgId } });
  if (!reminder) return { ok: false, error: "notFound" };
  if (reminder.responsibleId !== user.id && reminder.createdById !== user.id && !user.roles.includes("CEO")) return { ok: false, error: "forbidden" };

  await prisma.reminder.update({ where: { id }, data: { doneAt: done ? new Date() : null } });
  revalidateFor(reminder);
  return { ok: true };
}

export async function deleteReminder(id: string): Promise<Result> {
  const user = await requireUser();
  const reminder = await prisma.reminder.findFirst({ where: { id, organizationId: user.orgId } });
  if (!reminder) return { ok: false, error: "notFound" };
  if (reminder.createdById !== user.id && !user.roles.includes("CEO")) return { ok: false, error: "forbidden" };

  await prisma.reminder.delete({ where: { id } });
  revalidateFor(reminder);
  return { ok: true };
}
