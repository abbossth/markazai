import { prisma } from "@markazai/db";
import { isTeacherOnly } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";

export async function loadGroupProfile(user: SessionUser, id: string) {
  const group = await prisma.group.findFirst({
    where: {
      id,
      organizationId: user.orgId,
      // O'qituvchi faqat o'z guruhini ko'ra oladi.
      ...(isTeacherOnly(user.roles) && { teacherId: user.teacherId ?? "none" }),
    },
    include: {
      course: true,
      teacher: { select: { id: true, name: true } },
      room: { select: { name: true, capacity: true } },
      tags: { include: { tag: true } },
      enrollments: {
        include: { student: { select: { id: true, name: true, phone: true, status: true, balance: true, freezeReason: true, createdAt: true } } },
        orderBy: { student: { name: "asc" } },
      },
      discounts: { include: { student: { select: { name: true } } }, orderBy: { fromDate: "desc" } },
      exams: { orderBy: { date: "desc" } },
      onlineLessons: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!group) return null;

  const [attendance, grades, comments, history] = await Promise.all([
    prisma.attendance.findMany({ where: { groupId: id, organizationId: user.orgId }, select: { studentId: true, date: true, status: true } }),
    prisma.grade.findMany({ where: { groupId: id, organizationId: user.orgId }, select: { studentId: true, date: true, score: true } }),
    prisma.comment.findMany({ where: { groupId: id, organizationId: user.orgId }, orderBy: { createdAt: "desc" } }),
    prisma.historyLog.findMany({ where: { entityType: "group", entityId: id, organizationId: user.orgId }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  const authorIds = [...new Set(comments.map((c) => c.authorId))];
  const users = authorIds.length
    ? await prisma.user.findMany({ where: { id: { in: authorIds }, organizationId: user.orgId }, select: { id: true, name: true } })
    : [];

  return { group, attendance, grades, comments, history, userNames: new Map(users.map((u) => [u.id, u.name])) };
}

export type GroupProfile = NonNullable<Awaited<ReturnType<typeof loadGroupProfile>>>;
