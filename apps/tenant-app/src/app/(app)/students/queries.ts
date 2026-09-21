import { prisma, type Prisma } from "@markazai/db";
import { STUDENT_STATUSES, type DaysPattern } from "@markazai/types";
import { dateParam, intParam, param, sortParam, type RawSearchParams } from "@/lib/search-params";
import { canAccess, isTeacherOnly } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";

export const PAGE_SIZE = 20;
export const FINANCE_FILTERS = ["debt", "discount", "nodebt", "positive", "paidThisMonth"] as const;
export const GROUPS_COUNT_FILTERS = ["0", "1", "2+"] as const;
const SORT_KEYS = ["name", "phone", "balance", "createdAt"] as const;

export type StudentRow = {
  id: string;
  name: string;
  phone: string;
  photoUrl: string | null;
  /** null — foydalanuvchida moliya ruxsati yo'q (o'qituvchi): qiymat client'ga yuborilmaydi. */
  balance: number | null;
  status: string;
  freezeReason: string | null;
  note: string | null;
  createdAt: string;
  groups: { id: string; name: string; days: DaysPattern; customDays: number[]; startTime: string; teacherName: string }[];
  tags: { id: string; name: string; color: string | null }[];
};

function startOfMonthUTC() {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
}

export async function listStudents(user: SessionUser, sp: RawSearchParams) {
  const q = param(sp, "q");
  const status = param(sp, "status");
  const finance = param(sp, "finance");
  const groupsCount = param(sp, "groupsCount");
  const courseId = param(sp, "courseId");
  const tagId = param(sp, "tagId");
  const externalId = param(sp, "externalId");
  const from = dateParam(sp, "from");
  const to = dateParam(sp, "to");
  const page = intParam(sp, "page", 1);
  const canFinance = canAccess(user.roles, "finance");
  const sort = sortParam(sp, canFinance ? SORT_KEYS : (["name", "phone", "createdAt"] as const), { key: "createdAt", dir: "desc" });

  const and: Prisma.StudentWhereInput[] = [];

  if (q) {
    const digits = q.replace(/\D/g, "");
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 2 ? [{ phone: { contains: digits } }, { extraPhones: { has: digits } }] : []),
      ],
    });
  }

  if (status && (STUDENT_STATUSES as readonly string[]).includes(status)) {
    // "Bu oy qo'shildi" — saqlangan status emas, qo'shilgan sana bo'yicha.
    and.push(status === "JOINED_THIS_MONTH" ? { createdAt: { gte: startOfMonthUTC() } } : { status: status as Prisma.StudentWhereInput["status"] });
  }

  // Moliyaviy filtrlar faqat moliya ruxsati borlar uchun (aks holda filtr orqali balansni bilib olish mumkin).
  if (canFinance && finance === "debt") and.push({ balance: { lt: 0 } });
  if (canFinance && finance === "nodebt") and.push({ balance: { gte: 0 } });
  if (canFinance && finance === "positive") and.push({ balance: { gt: 0 } });
  if (canFinance && finance === "discount") and.push({ discounts: { some: {} } });
  if (canFinance && finance === "paidThisMonth") and.push({ payments: { some: { type: "MANUAL", amount: { gt: 0 }, date: { gte: startOfMonthUTC() } } } });

  if (courseId) and.push({ enrollments: { some: { leftAt: null, group: { courseId } } } });
  if (tagId) and.push({ tags: { some: { tagId } } });
  if (externalId) and.push({ externalId: { contains: externalId, mode: "insensitive" } });
  if (from || to) and.push({ createdAt: { ...(from && { gte: from }), ...(to && { lte: new Date(to.getTime() + 86_399_999) }) } });

  // Faol guruhlar soni bo'yicha (relation count Prisma'da to'g'ridan-to'g'ri filtrlanmaydi).
  if (groupsCount === "0") {
    and.push({ enrollments: { none: { leftAt: null } } });
  } else if (groupsCount === "1" || groupsCount === "2+") {
    const grouped = await prisma.groupStudent.groupBy({
      by: ["studentId"],
      where: { organizationId: user.orgId, leftAt: null },
      _count: { _all: true },
    });
    const ids = grouped.filter((g) => (groupsCount === "1" ? g._count._all === 1 : g._count._all >= 2)).map((g) => g.studentId);
    and.push({ id: { in: ids } });
  }

  // O'qituvchi faqat o'z guruhlaridagi talabalarni ko'radi.
  if (user.teacherId) and.push({ enrollments: { some: { group: { teacherId: user.teacherId } } } });
  else if (isTeacherOnly(user.roles)) and.push({ id: { in: [] } });

  const where: Prisma.StudentWhereInput = { organizationId: user.orgId, AND: and };

  const [total, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: { [sort.key]: sort.dir },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        tags: { include: { tag: true } },
        enrollments: {
          // O'qituvchi talabaning faqat o'z guruhlarini ko'radi.
          where: { leftAt: null, ...(isTeacherOnly(user.roles) && { group: { teacherId: user.teacherId ?? "none" } }) },
          include: { group: { include: { teacher: { select: { name: true } } } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    }),
  ]);

  const rows: StudentRow[] = students.map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    photoUrl: s.photoUrl,
    balance: canFinance ? s.balance : null,
    status: s.status,
    freezeReason: s.freezeReason,
    note: s.note,
    createdAt: s.createdAt.toISOString(),
    groups: s.enrollments.map((e) => ({
      id: e.group.id,
      name: e.group.name,
      days: e.group.days,
      customDays: e.group.customDays,
      startTime: e.group.startTime,
      teacherName: e.group.teacher.name,
    })),
    tags: s.tags.map((t) => ({ id: t.tag.id, name: t.tag.name, color: t.tag.color })),
  }));

  return { rows, total, page, sort };
}

/** Forma/filtrlar uchun ma'lumotnomalar. */
export async function loadStudentLookups(user: SessionUser) {
  const [courses, tags, groups] = await Promise.all([
    prisma.course.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.tag.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
    prisma.group.findMany({
      // O'qituvchi roli faqat o'z guruhlarini ko'radi (boshqalarining nomi ham client'ga yuborilmasin).
      where: { organizationId: user.orgId, status: "ACTIVE", ...(isTeacherOnly(user.roles) && { teacherId: user.teacherId ?? "none" }) },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        course: { select: { name: true } },
        room: { select: { capacity: true } },
        _count: { select: { enrollments: { where: { leftAt: null } } } },
      },
    }),
  ]);

  return {
    courses,
    tags,
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      courseName: g.course.name,
      members: g._count.enrollments,
      capacity: g.room?.capacity ?? null,
    })),
  };
}

export type StudentLookups = Awaited<ReturnType<typeof loadStudentLookups>>;
