import { prisma } from "@markazai/db";
import { calculatePayroll, lessonDatesInMonth, percentSalary, periodBounds, toCenterParts, type Payroll } from "@markazai/types";

export type GroupPayrollRow = {
  groupId: string;
  groupName: string;
  courseName: string;
  students: number;
  /** Davrda o'tgan (bugungacha) darslar soni. */
  lessons: number;
  /** Talabalar davomati yig'indisi: keldi / kelmadi (sababsiz) belgilar soni. */
  present: number;
  absent: number;
  /** Guruhga shu davrda kelgan (qo'lda kiritilgan) to'lovlar. */
  payments: number;
  /** Foiz modelida shu guruhdan hisoblangan ish haqi. */
  amount: number;
};

export type TeacherPayrollDetail = {
  teacherId: string;
  name: string;
  isActive: boolean;
  salaryType: "PERCENT" | "FIXED";
  percent: number | null;
  fixedSalary: number | null;
  payroll: Payroll;
  groups: GroupPayrollRow[];
  paid: number;
  remaining: number;
};

/**
 * Davr ("YYYY-MM") uchun o'qituvchilar ish haqi. Hisob-kitob qoidalari — @markazai/types → salary.ts.
 *  - PERCENT: guruhlariga shu oyda kelgan qo'lda kiritilgan to'lovlardan foiz;
 *  - FIXED: oylik × (keldi kunlari / oydagi ish kunlari) + qo'shimcha kunlar.
 * `teacherId` berilsa faqat shu o'qituvchi (nofaol bo'lsa ham); aks holda faol o'qituvchilar.
 */
export async function loadPayrolls(orgId: string, period: string, opts: { teacherId?: string } = {}): Promise<TeacherPayrollDetail[]> {
  const { from, to } = periodBounds(period);
  const today = toCenterParts(new Date()).date;

  const teachers = await prisma.teacher.findMany({
    where: { organizationId: orgId, ...(opts.teacherId ? { id: opts.teacherId } : { isActive: true }) },
    orderBy: { name: "asc" },
    include: { groups: { include: { course: { select: { name: true } }, _count: { select: { enrollments: { where: { leftAt: null } } } } } } },
  });
  if (teachers.length === 0) return [];

  const teacherIds = teachers.map((t) => t.id);
  const groupIds = teachers.flatMap((t) => t.groups.map((g) => g.id));
  const range = { gte: from, lte: to };

  const [payments, studentAttendance, teacherAttendance, salaryPaid] = await Promise.all([
    prisma.payment.groupBy({ by: ["groupId"], where: { organizationId: orgId, type: "MANUAL", groupId: { in: groupIds }, date: range }, _sum: { amount: true } }),
    prisma.attendance.groupBy({ by: ["groupId", "status"], where: { organizationId: orgId, groupId: { in: groupIds }, date: range }, _count: { _all: true } }),
    prisma.teacherAttendance.groupBy({ by: ["teacherId", "status"], where: { organizationId: orgId, teacherId: { in: teacherIds }, date: range }, _count: { _all: true } }),
    prisma.salaryPayment.groupBy({ by: ["teacherId"], where: { organizationId: orgId, teacherId: { in: teacherIds }, period }, _sum: { amount: true } }),
  ]);

  const paymentByGroup = new Map(payments.map((p) => [p.groupId, p._sum.amount ?? 0]));
  const attCount = (groupId: string, status: string) => studentAttendance.find((a) => a.groupId === groupId && a.status === status)?._count._all ?? 0;
  const tAtt = (teacherId: string, status: string) => teacherAttendance.find((a) => a.teacherId === teacherId && a.status === status)?._count._all ?? 0;
  const paidByTeacher = new Map(salaryPaid.map((s) => [s.teacherId, s._sum.amount ?? 0]));
  const [y, m] = period.split("-").map(Number) as [number, number];

  return teachers.map((t) => {
    const groups: GroupPayrollRow[] = t.groups
      .map((g) => {
        const lessons = lessonDatesInMonth({ days: g.days, customDays: g.customDays, startDate: g.startDate, endDate: g.endDate }, y, m).filter((d) => d <= today).length;
        const gp = paymentByGroup.get(g.id) ?? 0;
        return {
          groupId: g.id,
          groupName: g.name,
          courseName: g.course.name,
          students: g._count.enrollments,
          lessons,
          present: attCount(g.id, "PRESENT"),
          absent: attCount(g.id, "ABSENT"),
          payments: gp,
          amount: 0,
        };
      })
      // Bu oyda faoliyati bo'lmagan (arxiv, dars/to'lov yo'q) guruhlar ro'yxatni to'ldirmasin.
      .filter((g) => g.lessons > 0 || g.payments > 0 || g.students > 0);

    const payroll = calculatePayroll({
      salaryType: t.salaryType,
      percent: t.percent,
      fixedSalary: t.fixedSalary,
      workDays: t.workDays,
      period,
      paymentsByGroup: groups.map((g) => g.payments),
      came: tAtt(t.id, "PRESENT"),
      extra: tAtt(t.id, "EXTRA"),
    });
    if (t.salaryType === "PERCENT") {
      for (const g of groups) g.amount = percentSalary(g.payments, t.percent ?? 0);
    }

    const paid = paidByTeacher.get(t.id) ?? 0;
    return { teacherId: t.id, name: t.name, isActive: t.isActive, salaryType: t.salaryType, percent: t.percent, fixedSalary: t.fixedSalary, payroll, groups, paid, remaining: payroll.total - paid };
  });
}
