"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@markazai/db";
import { DAYS_PATTERNS, columnSchema, insertBefore, changedPositions, leadSchema, listSchema, type ActionResult, type LeadInput } from "@markazai/types";
import { PROTECTED_COLUMN_COUNT } from "./container";
import { logHistory } from "@/lib/history";
import { requirePermission, type SessionUser } from "@/lib/session";

type Result<T = object> = ActionResult<T> & { fieldErrors?: Record<string, string>; duplicate?: { name: string; kind: "lead" | "student" } };

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

const refresh = () => revalidatePath("/leads");

/** Kurs, xodim, teg, ustun va ro'yxat shu tashkilotga tegishli ekanini tekshiradi. */
async function checkRefs(user: SessionUser, d: { columnId: string; listId?: string; assignedToId?: string; courseId?: string; tagIds: string[] }) {
  const [column, list, assignee, course, tags] = await Promise.all([
    prisma.leadColumn.findFirst({ where: { id: d.columnId, organizationId: user.orgId }, select: { id: true } }),
    d.listId ? prisma.leadList.findFirst({ where: { id: d.listId, columnId: d.columnId, organizationId: user.orgId }, select: { id: true } }) : Promise.resolve(true),
    d.assignedToId ? prisma.user.findFirst({ where: { id: d.assignedToId, organizationId: user.orgId }, select: { id: true } }) : Promise.resolve(true),
    d.courseId ? prisma.course.findFirst({ where: { id: d.courseId, organizationId: user.orgId }, select: { id: true } }) : Promise.resolve(true),
    d.tagIds.length ? prisma.tag.findMany({ where: { organizationId: user.orgId, id: { in: d.tagIds } }, select: { id: true } }) : Promise.resolve([]),
  ]);
  if (!column) return { ok: false as const, field: "columnId" };
  if (!list) return { ok: false as const, field: "listId" };
  if (!assignee) return { ok: false as const, field: "assignedToId" };
  if (!course) return { ok: false as const, field: "courseId" };
  return { ok: true as const, tagIds: (tags as { id: string }[]).map((t) => t.id) };
}

async function nextPosition(orgId: string, columnId: string, listId: string | null) {
  const last = await prisma.lead.aggregate({ where: { organizationId: orgId, columnId, listId, convertedStudentId: null }, _max: { position: true } });
  return (last._max.position ?? -1) + 1;
}

/** Telefon bo'yicha mavjud lid/talabani topadi (takroriy kiritishdan ogohlantirish uchun). */
async function findDuplicate(user: SessionUser, phone: string, excludeLeadId?: string) {
  const lead = await prisma.lead.findFirst({ where: { organizationId: user.orgId, phone, convertedStudentId: null, id: excludeLeadId ? { not: excludeLeadId } : undefined }, select: { name: true } });
  if (lead) return { name: lead.name, kind: "lead" as const };
  const student = await prisma.student.findFirst({ where: { organizationId: user.orgId, phone }, select: { name: true } });
  return student ? { name: student.name, kind: "student" as const } : null;
}

export async function createLead(input: LeadInput, opts: { force?: boolean } = {}): Promise<Result<{ id: string }>> {
  const user = await guard("leads:write");
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;

  const refs = await checkRefs(user, d);
  if (!refs.ok) return { ok: false, error: "validation", fieldErrors: { [refs.field]: "required" } };

  if (!opts.force) {
    const duplicate = await findDuplicate(user, d.phone);
    if (duplicate) return { ok: false, error: "duplicatePhone", duplicate };
  }

  const lead = await prisma.lead.create({
    data: {
      organizationId: user.orgId,
      name: d.name,
      phone: d.phone,
      source: d.source,
      columnId: d.columnId,
      listId: d.listId ?? null,
      position: await nextPosition(user.orgId, d.columnId, d.listId ?? null),
      note: d.note,
      assignedToId: d.assignedToId,
      courseId: d.courseId,
      daysPattern: d.daysPattern,
      tags: { create: refs.tagIds.map((tagId) => ({ organizationId: user.orgId, tagId })) },
    },
  });
  await logHistory(user, "lead", lead.id, "created");
  refresh();
  return { ok: true, id: lead.id };
}

export async function updateLead(id: string, input: LeadInput, opts: { force?: boolean } = {}): Promise<Result> {
  const user = await guard("leads:write");
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;

  const existing = await prisma.lead.findFirst({ where: { id, organizationId: user.orgId, convertedStudentId: null } });
  if (!existing) return { ok: false, error: "notFound" };

  const refs = await checkRefs(user, d);
  if (!refs.ok) return { ok: false, error: "validation", fieldErrors: { [refs.field]: "required" } };

  if (!opts.force && d.phone !== existing.phone) {
    const duplicate = await findDuplicate(user, d.phone, id);
    if (duplicate) return { ok: false, error: "duplicatePhone", duplicate };
  }

  // Ustun yoki ro'yxat o'zgarsa, lid yangi konteynerning oxiriga tushadi.
  const moved = existing.columnId !== d.columnId || existing.listId !== (d.listId ?? null);
  await prisma.$transaction([
    prisma.lead.update({
      where: { id },
      data: {
        name: d.name,
        phone: d.phone,
        source: d.source ?? null,
        columnId: d.columnId,
        listId: d.listId ?? null,
        ...(moved && { position: await nextPosition(user.orgId, d.columnId, d.listId ?? null) }),
        note: d.note ?? null,
        assignedToId: d.assignedToId ?? null,
        courseId: d.courseId ?? null,
        daysPattern: d.daysPattern ?? null,
      },
    }),
    prisma.leadTag.deleteMany({ where: { leadId: id } }),
    prisma.leadTag.createMany({ data: refs.tagIds.map((tagId) => ({ organizationId: user.orgId, leadId: id, tagId })) }),
  ]);
  await logHistory(user, "lead", id, "updated");
  refresh();
  revalidatePath(`/leads/${id}`);
  return { ok: true };
}

export async function deleteLead(id: string): Promise<Result> {
  const user = await guard("leads:delete");
  if (!user) return { ok: false, error: "forbidden" };
  const lead = await prisma.lead.findFirst({ where: { id, organizationId: user.orgId, convertedStudentId: null }, select: { id: true } });
  if (!lead) return { ok: false, error: "notFound" };
  await prisma.lead.delete({ where: { id } });
  refresh();
  return { ok: true };
}

/**
 * Drag-and-drop: lidni (ustun, ro'yxat) konteynerining `beforeLeadId` oldiga qo'yadi (null — oxiriga).
 * Tartib konteynerning TO'LIQ tarkibiga nisbatan hisoblanadi (filtr yoqilgan bo'lsa ham to'g'ri chiqishi uchun).
 */
export async function moveLead(leadId: string, columnId: string, listId: string | null, beforeLeadId: string | null): Promise<Result> {
  const user = await guard("leads:write");
  if (!user) return { ok: false, error: "forbidden" };

  const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId: user.orgId, convertedStudentId: null }, include: { column: { select: { name: true } } } });
  if (!lead) return { ok: false, error: "notFound" };
  const target = await prisma.leadColumn.findFirst({ where: { id: columnId, organizationId: user.orgId }, select: { name: true } });
  if (!target) return { ok: false, error: "notFound" };
  if (listId && !(await prisma.leadList.findFirst({ where: { id: listId, columnId, organizationId: user.orgId }, select: { id: true } }))) {
    return { ok: false, error: "notFound" };
  }

  const siblings = await prisma.lead.findMany({
    where: { organizationId: user.orgId, columnId, listId, convertedStudentId: null, id: { not: leadId } },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    select: { id: true, position: true },
  });
  const order = insertBefore(siblings.map((s) => s.id), leadId, beforeLeadId);
  const before = new Map(siblings.map((s) => [s.id, s.position]));
  // Ko'chirilayotgan lid har doim yangilanadi (ustun/ro'yxat o'zgarishi mumkin).
  const updates = changedPositions(before, order).filter((u) => u.id !== leadId);
  const myPosition = order.indexOf(leadId);

  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId }, data: { columnId, listId, position: myPosition } }),
    ...updates.map((u) => prisma.lead.update({ where: { id: u.id }, data: { position: u.position } })),
  ]);

  if (lead.columnId !== columnId) await logHistory(user, "lead", leadId, "lead_moved", { from: lead.column.name, to: target.name });
  else if (lead.listId !== listId) await logHistory(user, "lead", leadId, "list_changed");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

// ───────────── Ustunlar ─────────────

export async function createColumn(name: string): Promise<Result> {
  const user = await guard("leads:configure");
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = columnSchema.safeParse({ name });
  if (!parsed.success) return { ok: false, error: "validation" };
  const last = await prisma.leadColumn.aggregate({ where: { organizationId: user.orgId }, _max: { position: true } });
  await prisma.leadColumn.create({ data: { organizationId: user.orgId, name: parsed.data.name, position: (last._max.position ?? -1) + 1 } });
  refresh();
  return { ok: true };
}

export async function renameColumn(id: string, name: string): Promise<Result> {
  const user = await guard("leads:configure");
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = columnSchema.safeParse({ name });
  if (!parsed.success) return { ok: false, error: "validation" };
  const res = await prisma.leadColumn.updateMany({ where: { id, organizationId: user.orgId }, data: { name: parsed.data.name } });
  if (res.count === 0) return { ok: false, error: "notFound" };
  refresh();
  return { ok: true };
}

/** Ustunda faol lidlar bo'lsa o'chirilmaydi; talabaga aylangan lidlar boshqa ustunga o'tkaziladi. */
export async function deleteColumn(id: string): Promise<Result> {
  const user = await guard("leads:configure");
  if (!user) return { ok: false, error: "forbidden" };
  const columns = await prisma.leadColumn.findMany({ where: { organizationId: user.orgId }, orderBy: { position: "asc" }, select: { id: true } });
  const index = columns.findIndex((c) => c.id === id);
  if (index === -1) return { ok: false, error: "notFound" };
  if (index < PROTECTED_COLUMN_COUNT) return { ok: false, error: "protected" };
  if (columns.length === 1) return { ok: false, error: "lastColumn" };
  if ((await prisma.lead.count({ where: { organizationId: user.orgId, columnId: id, convertedStudentId: null } })) > 0) return { ok: false, error: "columnNotEmpty" };

  const fallback = columns.find((c) => c.id !== id)!.id;
  await prisma.$transaction([
    prisma.lead.updateMany({ where: { organizationId: user.orgId, columnId: id }, data: { columnId: fallback, listId: null } }),
    prisma.leadColumn.delete({ where: { id } }),
  ]);
  refresh();
  return { ok: true };
}

// ───────────── Ro'yxatlar (ustun ichidagi papkalar) ─────────────

const listDetailsSchema = z.object({
  courseId: z.union([z.uuid(), z.literal("")]).optional(),
  teacherId: z.union([z.uuid(), z.literal("")]).optional(),
  daysPattern: z.union([z.enum(DAYS_PATTERNS), z.literal("")]).optional(),
  startTime: z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.literal("")]).optional(),
});
export type ListDetails = z.input<typeof listDetailsSchema>;

/** Bo'sh qiymat — NULL (ixtiyoriy maydon tozalanadi). */
const listDetailData = (d: z.output<typeof listDetailsSchema>) => ({
  courseId: d.courseId || null,
  teacherId: d.teacherId || null,
  daysPattern: d.daysPattern || null,
  startTime: d.startTime || null,
});

export async function createList(columnId: string, name: string, details: ListDetails = {}): Promise<Result> {
  const user = await guard("leads:configure");
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = listSchema.safeParse({ name });
  const d = listDetailsSchema.safeParse(details);
  if (!parsed.success || !d.success) return { ok: false, error: "validation" };
  if (!(await prisma.leadColumn.findFirst({ where: { id: columnId, organizationId: user.orgId }, select: { id: true } }))) return { ok: false, error: "notFound" };
  const last = await prisma.leadList.aggregate({ where: { organizationId: user.orgId, columnId }, _max: { position: true } });
  await prisma.leadList.create({ data: { organizationId: user.orgId, columnId, name: parsed.data.name, position: (last._max.position ?? -1) + 1, ...listDetailData(d.data) } });
  refresh();
  return { ok: true };
}

/** Ro'yxat nomi va "set" ma'lumotlarini yangilaydi. */
export async function updateList(id: string, name: string, details: ListDetails = {}): Promise<Result> {
  const user = await guard("leads:configure");
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = listSchema.safeParse({ name });
  const d = listDetailsSchema.safeParse(details);
  if (!parsed.success || !d.success) return { ok: false, error: "validation" };
  const list = await prisma.leadList.findFirst({ where: { id, organizationId: user.orgId } });
  if (!list) return { ok: false, error: "notFound" };
  await prisma.leadList.update({ where: { id }, data: { name: parsed.data.name, ...listDetailData(d.data) } });
  refresh();
  return { ok: true };
}

/** O'chirilganda lidlar ustunning umumiy qismiga (ro'yxatsiz) o'tadi. */
export async function deleteList(id: string): Promise<Result> {
  const user = await guard("leads:configure");
  if (!user) return { ok: false, error: "forbidden" };
  const list = await prisma.leadList.findFirst({ where: { id, organizationId: user.orgId } });
  if (!list) return { ok: false, error: "notFound" };

  await prisma.$transaction(async (tx) => {
    const moving = await tx.lead.findMany({ where: { listId: id }, orderBy: { position: "asc" }, select: { id: true } });
    const root = await tx.lead.aggregate({ where: { organizationId: user.orgId, columnId: list.columnId, listId: null, convertedStudentId: null }, _max: { position: true } });
    let position = (root._max.position ?? -1) + 1;
    for (const l of moving) await tx.lead.update({ where: { id: l.id }, data: { listId: null, position: position++ } });
    await tx.leadList.delete({ where: { id } });
  });
  refresh();
  return { ok: true };
}
