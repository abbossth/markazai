import { prisma } from "@markazai/db";
import { isTeacherOnly } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";

export async function loadStudentProfile(user: SessionUser, id: string) {
  const student = await prisma.student.findFirst({
    where: {
      id,
      organizationId: user.orgId,
      // O'qituvchi faqat o'z guruhidagi talabani ko'ra oladi.
      ...(isTeacherOnly(user.roles) && { enrollments: { some: { group: { teacherId: user.teacherId ?? "none" } } } }),
    },
    include: {
      tags: { include: { tag: true } },
      enrollments: {
        include: { group: { include: { course: true, teacher: { select: { name: true } }, room: { select: { name: true } } } } },
        orderBy: { joinedAt: "desc" },
      },
    },
  });
  if (!student) return null;

  const [payments, comments, attendance, history, grades] = await Promise.all([
    prisma.payment.findMany({
      where: { studentId: id, organizationId: user.orgId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { group: { select: { name: true } } },
      take: 200,
    }),
    prisma.comment.findMany({ where: { studentId: id, organizationId: user.orgId }, orderBy: { createdAt: "desc" } }),
    prisma.attendance.findMany({ where: { studentId: id, organizationId: user.orgId }, select: { groupId: true, date: true, status: true } }),
    prisma.historyLog.findMany({
      where: { entityType: "student", entityId: id, organizationId: user.orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.grade.aggregate({ where: { studentId: id, organizationId: user.orgId }, _avg: { score: true }, _count: true }),
  ]);

  const userIds = [...new Set([...comments.map((c) => c.authorId), ...payments.flatMap((p) => (p.receivedById ? [p.receivedById] : []))])];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds }, organizationId: user.orgId }, select: { id: true, name: true } })
    : [];
  const userNames = new Map(users.map((u) => [u.id, u.name]));

  return { student, payments, comments, attendance, history, grades, userNames };
}

export type StudentProfile = NonNullable<Awaited<ReturnType<typeof loadStudentProfile>>>;
