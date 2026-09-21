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

  // Talaba lid orqali kelgan bo'lsa, lid davridagi qo'ng'iroq/SMS/tarix ham ko'rsatiladi.
  const fromLead = await prisma.lead.findFirst({
    where: { convertedStudentId: id, organizationId: user.orgId },
    select: { id: true, name: true, source: true, createdAt: true, convertedAt: true, column: { select: { name: true } } },
  });
  const commsWhere = { organizationId: user.orgId, OR: [{ studentId: id }, ...(fromLead ? [{ leadId: fromLead.id }] : [])] };

  const [payments, comments, attendance, history, grades, calls, sms, leadHistory] = await Promise.all([
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
    prisma.callLog.findMany({ where: commsWhere, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.smsLog.findMany({ where: commsWhere, orderBy: { createdAt: "desc" }, take: 200 }),
    fromLead
      ? prisma.historyLog.findMany({ where: { entityType: "lead", entityId: fromLead.id, organizationId: user.orgId }, orderBy: { createdAt: "desc" }, take: 100 })
      : Promise.resolve([]),
  ]);

  const userIds = [...new Set([...comments.map((c) => c.authorId), ...calls.map((c) => c.createdById), ...sms.map((m) => m.sentById), ...payments.flatMap((p) => (p.receivedById ? [p.receivedById] : []))])];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds }, organizationId: user.orgId }, select: { id: true, name: true } })
    : [];
  const userNames = new Map(users.map((u) => [u.id, u.name]));

  return { student, payments, comments, attendance, history, grades, calls, sms, fromLead, leadHistory, userNames };
}

export type StudentProfile = NonNullable<Awaited<ReturnType<typeof loadStudentProfile>>>;
