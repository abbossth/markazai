import { prisma, type Prisma } from "@markazai/db";
import { DAYS_PATTERNS, GROUP_STATUSES, type DaysPattern } from "@markazai/types";
import { isTeacherOnly } from "@/lib/permissions";
import { dateParam, intParam, param, sortParam, type RawSearchParams } from "@/lib/search-params";
import type { SessionUser } from "@/lib/session";

export const PAGE_SIZE = 20;
const SORT_KEYS = ["name", "price", "startDate", "status"] as const;

export type GroupRow = {
  id: string;
  name: string;
  status: string;
  course: { id: string; name: string; color: string };
  teacherId: string;
  teacherName: string;
  roomId: string | null;
  days: DaysPattern;
  customDays: number[];
  startTime: string;
  durationMinutes: number;
  startDate: string;
  endDate: string | null;
  roomName: string | null;
  capacity: number | null;
  price: number;
  studentCount: number;
  tags: { id: string; name: string }[];
  /** O'tilgan muddat: 0–100 (tugash sanasi yo'q bo'lsa null) va o'tgan kunlar. */
  progress: number | null;
  daysElapsed: number;
};

/** Server tomonida hisoblanadi — hydration'da vaqt farqi bo'lmasligi uchun. */
function progressOf(start: Date, end: Date | null) {
  const now = Date.now();
  const daysElapsed = Math.max(0, Math.floor((now - start.getTime()) / 86_400_000));
  if (!end) return { progress: null, daysElapsed };
  const total = end.getTime() - start.getTime();
  const progress = total <= 0 ? 100 : Math.min(100, Math.max(0, Math.round(((now - start.getTime()) / total) * 100)));
  return { progress, daysElapsed };
}

export async function listGroups(user: SessionUser, sp: RawSearchParams) {
  const q = param(sp, "q");
  const status = param(sp, "status");
  const teacherId = param(sp, "teacherId");
  const courseId = param(sp, "courseId");
  const days = param(sp, "days");
  const tagId = param(sp, "tagId");
  const from = dateParam(sp, "from");
  const to = dateParam(sp, "to");
  const page = intParam(sp, "page", 1);
  const sort = sortParam(sp, SORT_KEYS, { key: "status", dir: "asc" });

  const and: Prisma.GroupWhereInput[] = [];
  if (q) and.push({ name: { contains: q, mode: "insensitive" } });
  if (status && (GROUP_STATUSES as readonly string[]).includes(status)) and.push({ status: status as Prisma.GroupWhereInput["status"] });
  if (teacherId) and.push({ teacherId });
  if (courseId) and.push({ courseId });
  if (days && (DAYS_PATTERNS as readonly string[]).includes(days)) and.push({ days: days as DaysPattern });
  if (tagId) and.push({ tags: { some: { tagId } } });
  if (from) and.push({ startDate: { gte: from } });
  if (to) and.push({ startDate: { lte: to } });

  // O'qituvchi faqat o'z guruhlarini ko'radi.
  if (isTeacherOnly(user.roles)) and.push({ teacherId: user.teacherId ?? "none" });

  const where: Prisma.GroupWhereInput = { organizationId: user.orgId, AND: and };
  // Asosiy saralashdan keyin nom bo'yicha — natija barqaror bo'lishi uchun.
  const orderBy: Prisma.GroupOrderByWithRelationInput[] = [{ [sort.key]: sort.dir }, ...(sort.key === "name" ? [] : [{ name: "asc" as const }])];

  const [total, groups] = await Promise.all([
    prisma.group.count({ where }),
    prisma.group.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        course: { select: { id: true, name: true, color: true } },
        teacher: { select: { name: true } },
        room: { select: { name: true, capacity: true } },
        tags: { include: { tag: true } },
        _count: { select: { enrollments: { where: { leftAt: null } } } },
      },
    }),
  ]);

  const rows: GroupRow[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    status: g.status,
    course: g.course,
    teacherId: g.teacherId,
    teacherName: g.teacher.name,
    roomId: g.roomId,
    days: g.days,
    customDays: g.customDays,
    startTime: g.startTime,
    durationMinutes: g.durationMinutes,
    startDate: g.startDate.toISOString(),
    endDate: g.endDate?.toISOString() ?? null,
    roomName: g.room?.name ?? null,
    capacity: g.room?.capacity ?? null,
    price: g.price,
    studentCount: g._count.enrollments,
    tags: g.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
    ...progressOf(g.startDate, g.endDate),
  }));

  return { rows, total, page, sort };
}

export async function loadGroupLookups(user: SessionUser) {
  const [courses, teachers, rooms, tags] = await Promise.all([
    prisma.course.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true, price: true } }),
    prisma.teacher.findMany({ where: { organizationId: user.orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.room.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true, capacity: true } }),
    prisma.tag.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { courses, teachers, rooms, tags };
}

export type GroupLookups = Awaited<ReturnType<typeof loadGroupLookups>>;
