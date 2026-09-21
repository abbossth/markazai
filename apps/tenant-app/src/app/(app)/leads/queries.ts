import { ensureDefaultLeadColumns, prisma, type Prisma } from "@markazai/db";
import { DAYS_PATTERNS, LEAD_SOURCES, centerDayRange, toCenterParts, type DaysPattern, type LeadSourceValue } from "@markazai/types";
import { dateParam, param, type RawSearchParams } from "@/lib/search-params";
import type { SessionUser } from "@/lib/session";
import { containerId } from "./container";

export const TASK_FILTERS = ["overdue", "today", "any", "none"] as const;
const MAX_LEADS = 1000;

export type LeadCardData = {
  id: string;
  name: string;
  phone: string;
  source: LeadSourceValue | null;
  createdAt: string;
  note: string | null;
  assigneeName: string | null;
  tags: { id: string; name: string }[];
  pendingReminders: number;
  hasOverdue: boolean;
  // Tahrirlash formasi uchun
  assignedToId: string | null;
  courseId: string | null;
  daysPattern: string | null;
};

export type BoardColumn = {
  id: string;
  name: string;
  lists: { id: string; name: string; isLocked: boolean }[];
};

export async function loadBoard(user: SessionUser, sp: RawSearchParams) {
  // Yangi tashkilotda birinchi kirishda standart ustunlar yaratiladi.
  const columns = await ensureDefaultLeadColumns(prisma, user.orgId);
  const lists = await prisma.leadList.findMany({ where: { organizationId: user.orgId }, orderBy: { position: "asc" } });

  const q = param(sp, "q");
  const listId = param(sp, "listId");
  const courseId = param(sp, "courseId");
  const days = param(sp, "days");
  const tagId = param(sp, "tagId");
  const source = param(sp, "source");
  const assigneeId = param(sp, "assigneeId");
  const task = param(sp, "task");
  const from = dateParam(sp, "from");
  const to = dateParam(sp, "to");
  const now = new Date();

  const and: Prisma.LeadWhereInput[] = [];
  if (q) {
    const digits = q.replace(/\D/g, "");
    and.push({ OR: [{ name: { contains: q, mode: "insensitive" } }, ...(digits.length >= 2 ? [{ phone: { contains: digits } }] : [])] });
  }
  if (listId) and.push({ listId });
  if (courseId) and.push({ courseId });
  if (days && (DAYS_PATTERNS as readonly string[]).includes(days)) and.push({ daysPattern: days as DaysPattern });
  if (tagId) and.push({ tags: { some: { tagId } } });
  if (source && LEAD_SOURCES.some((s) => s.value === source)) and.push({ source: source as LeadSourceValue });
  if (assigneeId) and.push({ assignedToId: assigneeId });
  if (from || to) and.push({ createdAt: { ...(from && { gte: from }), ...(to && { lte: new Date(to.getTime() + 86_399_999) }) } });

  const pending = { doneAt: null };
  if (task === "overdue") and.push({ reminders: { some: { ...pending, dueAt: { lt: now } } } });
  if (task === "today") {
    const { start, end } = centerDayRange(toCenterParts(now).date);
    and.push({ reminders: { some: { ...pending, dueAt: { gte: start, lte: end } } } });
  }
  if (task === "any") and.push({ reminders: { some: pending } });
  if (task === "none") and.push({ reminders: { none: pending } });

  const where: Prisma.LeadWhereInput = { organizationId: user.orgId, convertedStudentId: null, AND: and };

  const [leads, assignees] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
      take: MAX_LEADS,
      include: { tags: { include: { tag: true } }, reminders: { where: pending, select: { dueAt: true } } },
    }),
    prisma.user.findMany({ where: { organizationId: user.orgId, isActive: true }, select: { id: true, name: true } }),
  ]);
  const assigneeNames = new Map(assignees.map((a) => [a.id, a.name]));

  const cards: Record<string, LeadCardData> = {};
  const containers: Record<string, string[]> = {};
  for (const c of columns) {
    containers[containerId(c.id, null)] = [];
    for (const l of lists.filter((x) => x.columnId === c.id)) containers[containerId(c.id, l.id)] = [];
  }
  for (const l of leads) {
    cards[l.id] = {
      id: l.id,
      name: l.name,
      phone: l.phone,
      source: l.source,
      createdAt: l.createdAt.toISOString(),
      note: l.note,
      assigneeName: l.assignedToId ? (assigneeNames.get(l.assignedToId) ?? null) : null,
      tags: l.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
      pendingReminders: l.reminders.length,
      hasOverdue: l.reminders.some((r) => r.dueAt < now),
      assignedToId: l.assignedToId,
      courseId: l.courseId,
      daysPattern: l.daysPattern,
    };
    (containers[containerId(l.columnId, l.listId)] ??= []).push(l.id);
  }

  const boardColumns: BoardColumn[] = columns.map((c) => ({
    id: c.id,
    name: c.name,
    lists: lists.filter((l) => l.columnId === c.id).map((l) => ({ id: l.id, name: l.name, isLocked: l.isLocked })),
  }));

  const [courses, tags] = await Promise.all([
    prisma.course.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.tag.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return { columns: boardColumns, cards, containers, lookups: { courses, tags, assignees, columns: boardColumns } };
}

export type BoardLookups = Awaited<ReturnType<typeof loadBoard>>["lookups"];
