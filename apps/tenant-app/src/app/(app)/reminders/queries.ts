import { prisma, type Prisma } from "@markazai/db";
import { centerDayRange, toCenterParts } from "@markazai/types";
import type { SessionUser } from "@/lib/session";

export type ReminderItem = {
  id: string;
  title: string;
  note: string | null;
  dueAt: string;
  doneAt: string | null;
  overdue: boolean;
  responsibleId: string;
  responsibleName: string;
  createdById: string;
  tags: { id: string; name: string }[];
};

/** Eslatmalarni yuklaydi; muddati o'tganligi server tomonida hisoblanadi (hydration'da vaqt farqi bo'lmasligi uchun). */
export async function loadReminderItems(user: SessionUser, where: Prisma.ReminderWhereInput): Promise<ReminderItem[]> {
  const rows = await prisma.reminder.findMany({
    where: { organizationId: user.orgId, ...where },
    orderBy: [{ doneAt: { sort: "asc", nulls: "first" } }, { dueAt: "asc" }],
    include: { tags: { include: { tag: true } } },
    take: 200,
  });
  const users = rows.length
    ? await prisma.user.findMany({ where: { organizationId: user.orgId, id: { in: [...new Set(rows.map((r) => r.responsibleId))] } }, select: { id: true, name: true } })
    : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  const now = Date.now();

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    note: r.note,
    dueAt: r.dueAt.toISOString(),
    doneAt: r.doneAt?.toISOString() ?? null,
    overdue: !r.doneAt && r.dueAt.getTime() < now,
    responsibleId: r.responsibleId,
    responsibleName: names.get(r.responsibleId) ?? "—",
    createdById: r.createdById,
    tags: r.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
  }));
}

/** Forma uchun: mas'ul xodimlar va teglar. */
export async function loadReminderLookups(user: SessionUser) {
  const [users, tags] = await Promise.all([
    prisma.user.findMany({ where: { organizationId: user.orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.tag.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { users, tags };
}
export type ReminderLookups = Awaited<ReturnType<typeof loadReminderLookups>>;

export type BellItem = { id: string; title: string; dueAt: string; overdue: boolean; href: string; context: string };

/** Header'dagi bildirishnoma: menga tegishli, bajarilmagan, bugun (markaz vaqti) yoki undan oldin muddati kelgan eslatmalar. */
export async function loadMyReminders(user: SessionUser): Promise<{ count: number; items: BellItem[] }> {
  const { end } = centerDayRange(toCenterParts(new Date()).date);
  const where: Prisma.ReminderWhereInput = { organizationId: user.orgId, responsibleId: user.id, doneAt: null, dueAt: { lte: end } };

  const [count, rows] = await Promise.all([
    prisma.reminder.count({ where }),
    prisma.reminder.findMany({
      where,
      orderBy: { dueAt: "asc" },
      take: 8,
      include: { lead: { select: { id: true, name: true } }, group: { select: { id: true, name: true } }, student: { select: { id: true, name: true } }, teacher: { select: { id: true, name: true } } },
    }),
  ]);
  const now = Date.now();

  return {
    count,
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      dueAt: r.dueAt.toISOString(),
      overdue: r.dueAt.getTime() < now,
      href: r.lead ? `/leads/${r.lead.id}?tab=reminders` : r.group ? `/groups/${r.group.id}` : r.student ? `/students/${r.student.id}` : r.teacher ? `/teachers/${r.teacher.id}` : "/dashboard",
      context: r.lead?.name ?? r.group?.name ?? r.student?.name ?? r.teacher?.name ?? "",
    })),
  };
}
