import { ensureDefaultLeadColumns, prisma } from "@markazai/db";
import { SET_COLUMN_INDEX } from "../container";
import type { SessionUser } from "@/lib/session";
import type { BoardLookups } from "../queries";

/** Lid formasi uchun ma'lumotnomalar (doskadagi bilan bir xil shakl). */
export async function loadLeadLookups(user: SessionUser): Promise<BoardLookups> {
  const columns = await ensureDefaultLeadColumns(prisma, user.orgId);
  const [lists, courses, tags, teachers, assignees] = await Promise.all([
    prisma.leadList.findMany({ where: { organizationId: user.orgId }, orderBy: { position: "asc" } }),
    prisma.course.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.tag.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.teacher.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { organizationId: user.orgId, isActive: true }, select: { id: true, name: true } }),
  ]);
  return {
    courses,
    tags,
    teachers,
    archiveReasons: [],
    assignees,
    columns: columns.map((c, index) => ({ id: c.id, name: c.name, isSet: index === SET_COLUMN_INDEX, lists: lists.filter((l) => l.columnId === c.id).map((l) => ({ id: l.id, name: l.name, isLocked: l.isLocked, courseId: l.courseId, teacherId: l.teacherId, daysPattern: l.daysPattern, startTime: l.startTime })) })),
  };
}

export async function loadLeadProfile(user: SessionUser, id: string) {
  const lead = await prisma.lead.findFirst({
    where: { id, organizationId: user.orgId },
    include: {
      column: { select: { name: true } },
      list: { select: { name: true } },
      course: { select: { name: true } },
      tags: { include: { tag: true } },
      convertedStudent: { select: { id: true, name: true } },
    },
  });
  if (!lead) return null;

  const [comments, calls, sms, history, reminders] = await Promise.all([
    prisma.comment.findMany({ where: { leadId: id, organizationId: user.orgId }, orderBy: { createdAt: "desc" } }),
    prisma.callLog.findMany({ where: { leadId: id, organizationId: user.orgId }, orderBy: { createdAt: "desc" } }),
    prisma.smsLog.findMany({ where: { leadId: id, organizationId: user.orgId }, orderBy: { createdAt: "desc" } }),
    prisma.historyLog.findMany({ where: { entityType: "lead", entityId: id, organizationId: user.orgId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.reminder.findMany({ where: { leadId: id, organizationId: user.orgId }, orderBy: [{ doneAt: { sort: "asc", nulls: "first" } }, { dueAt: "asc" }], include: { tags: { include: { tag: true } } } }),
  ]);

  const userIds = [...new Set([lead.assignedToId, ...comments.map((c) => c.authorId), ...calls.map((c) => c.createdById), ...sms.map((s) => s.sentById), ...reminders.map((r) => r.responsibleId)].filter((x): x is string => !!x))];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds }, organizationId: user.orgId }, select: { id: true, name: true } }) : [];

  return { lead, comments, calls, sms, history, reminders, userNames: new Map(users.map((u) => [u.id, u.name])) };
}

export type LeadProfile = NonNullable<Awaited<ReturnType<typeof loadLeadProfile>>>;
