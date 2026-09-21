import { prisma, type Prisma } from "@markazai/db";
import { can } from "@/lib/permissions";
import { intParam, param, sortParam, type RawSearchParams } from "@/lib/search-params";
import type { SessionUser } from "@/lib/session";
import type { EditableTeacher } from "./teacher-form";

export const PAGE_SIZE = 20;
const SORT_KEYS = ["name", "createdAt"] as const;

export type TeacherRow = {
  id: string;
  name: string;
  phone: string;
  photoUrl: string | null;
  isActive: boolean;
  salaryType: "PERCENT" | "FIXED";
  percent: number | null;
  fixedSalary: number | null;
  activeGroups: number;
  totalGroups: number;
  branches: string[];
  /** Tahrirlash formasi uchun (maosh maydonlari `salary:read` ruxsati bo'lmasa bo'sh). */
  editable: EditableTeacher;
};

const toDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function toEditable(t: {
  id: string; name: string; phone: string; birthDate: Date | null; gender: string | null; userId: string | null;
  salaryType: "PERCENT" | "FIXED"; percent: number | null; fixedSalary: number | null; workDays: number[];
  workStart: string | null; workEnd: string | null; workStartDate: Date | null; branches: { branchId: string }[];
}, canSalary: boolean): EditableTeacher {
  return {
    id: t.id,
    name: t.name,
    phone: t.phone,
    birthDate: toDay(t.birthDate),
    gender: t.gender,
    branchIds: t.branches.map((b) => b.branchId),
    salaryType: canSalary ? t.salaryType : "PERCENT",
    percent: canSalary ? t.percent : null,
    fixedSalary: canSalary ? t.fixedSalary : null,
    workDays: canSalary ? t.workDays : [],
    workStart: canSalary ? t.workStart : null,
    workEnd: canSalary ? t.workEnd : null,
    workStartDate: canSalary ? toDay(t.workStartDate) : null,
    hasLogin: !!t.userId,
  };
}

export async function listTeachers(user: SessionUser, sp: RawSearchParams) {
  const q = param(sp, "q");
  const status = param(sp, "status");
  const salaryType = param(sp, "salaryType");
  const branchId = param(sp, "branchId");
  const page = intParam(sp, "page", 1);
  const sort = sortParam(sp, SORT_KEYS, { key: "name", dir: "asc" });

  const canSalary = can(user.roles, "salary:read");
  const digits = q?.replace(/\D/g, "") ?? "";
  const where: Prisma.TeacherWhereInput = {
    organizationId: user.orgId,
    ...(status === "active" && { isActive: true }),
    ...(status === "inactive" && { isActive: false }),
    ...((salaryType === "PERCENT" || salaryType === "FIXED") && { salaryType }),
    ...(branchId && { branches: { some: { branchId } } }),
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, ...(digits.length >= 2 ? [{ phone: { contains: digits } }] : [])] }),
  };

  const [total, teachers] = await Promise.all([
    prisma.teacher.count({ where }),
    prisma.teacher.findMany({
      where,
      orderBy: { [sort.key]: sort.dir },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        branches: { include: { branch: { select: { name: true } } } },
        groups: { select: { status: true } },
      },
    }),
  ]);

  const rows: TeacherRow[] = teachers.map((t) => ({
    id: t.id,
    name: t.name,
    phone: t.phone,
    photoUrl: t.photoUrl,
    isActive: t.isActive,
    salaryType: t.salaryType,
    percent: canSalary ? t.percent : null,
    fixedSalary: canSalary ? t.fixedSalary : null,
    editable: toEditable(t, canSalary),
    activeGroups: t.groups.filter((g) => g.status === "ACTIVE").length,
    totalGroups: t.groups.length,
    branches: t.branches.map((b) => b.branch.name),
  }));
  return { rows, total, page, sort };
}

export async function loadTeacherLookups(user: SessionUser) {
  const branches = await prisma.branch.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return { branches };
}
export type TeacherLookups = Awaited<ReturnType<typeof loadTeacherLookups>>;

export async function loadTeacherProfile(user: SessionUser, id: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { id, organizationId: user.orgId },
    include: {
      branches: { include: { branch: { select: { id: true, name: true } } } },
      groups: {
        orderBy: [{ status: "asc" }, { name: "asc" }],
        include: {
          course: { select: { name: true } },
          room: { select: { name: true, capacity: true } },
          enrollments: { where: { leftAt: null }, orderBy: { student: { name: "asc" } }, select: { student: { select: { id: true, name: true } } } },
        },
      },
    },
  });
  if (!teacher) return null;

  const [history, login] = await Promise.all([
    prisma.historyLog.findMany({ where: { entityType: "teacher", entityId: id, organizationId: user.orgId }, orderBy: { createdAt: "desc" }, take: 100 }),
    teacher.userId ? prisma.user.findFirst({ where: { id: teacher.userId, organizationId: user.orgId }, select: { roles: true } }) : Promise.resolve(null),
  ]);
  return { teacher, history, roles: login?.roles ?? [] };
}
export type TeacherProfile = NonNullable<Awaited<ReturnType<typeof loadTeacherProfile>>>;
