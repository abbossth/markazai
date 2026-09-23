import { NextResponse } from "next/server";
import { prisma } from "@markazai/db";
import { getSessionUser } from "@/lib/session";
import { canAccess, isTeacherOnly } from "@/lib/permissions";

export type SearchResult = { type: string; id: string; title: string; subtitle?: string; href: string };

/** Global qidiruv: xodimlar, talabalar, guruhlar, lidlar — foydalanuvchining modul ruxsatiga qarab. */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const digits = q.replace(/\D/g, "");
  const phoneOr = digits.length >= 2 ? [{ phone: { contains: digits } }] : [];
  // O'qituvchi (boshqa rolsiz) faqat o'z guruhlari/o'quvchilarini ko'radi — sahifalardagi kabi.
  // `getSessionUser()` teacherId'ni o'rnatmaydi (faqat `requireModule` sahifalarda), shu yerda alohida olinadi.
  const teacherOnly = isTeacherOnly(user.roles);
  const teacherId = teacherOnly ? ((await prisma.teacher.findFirst({ where: { organizationId: user.orgId, userId: user.id }, select: { id: true } }))?.id ?? "none") : "none";

  const [staff, students, groups, leads] = await Promise.all([
    // Xodimlar: avvalgidek — hamma o'z xodimdoshlarini topa oladi (alohida modul ruxsati talab qilinmaydi).
    prisma.user.findMany({
      where: { organizationId: user.orgId, OR: [{ name: { contains: q, mode: "insensitive" } }, ...phoneOr] },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
      take: 6,
    }),
    canAccess(user.roles, "students")
      ? prisma.student.findMany({
          where: {
            organizationId: user.orgId,
            OR: [{ name: { contains: q, mode: "insensitive" } }, ...phoneOr],
            ...(teacherOnly && { enrollments: { some: { group: { teacherId } } } }),
          },
          select: { id: true, name: true, phone: true },
          orderBy: { name: "asc" },
          take: 6,
        })
      : [],
    canAccess(user.roles, "groups")
      ? prisma.group.findMany({
          where: {
            organizationId: user.orgId,
            name: { contains: q, mode: "insensitive" },
            ...(teacherOnly && { teacherId }),
          },
          select: { id: true, name: true, course: { select: { name: true } } },
          orderBy: { name: "asc" },
          take: 6,
        })
      : [],
    canAccess(user.roles, "leads") && !teacherOnly
      ? prisma.lead.findMany({
          where: { organizationId: user.orgId, OR: [{ name: { contains: q, mode: "insensitive" } }, ...phoneOr] },
          select: { id: true, name: true, phone: true },
          orderBy: { name: "asc" },
          take: 6,
        })
      : [],
  ]);

  const results: SearchResult[] = [
    ...staff.map((u) => ({ type: "staff", id: u.id, title: u.name, subtitle: `+${u.phone}`, href: "/settings/staff" }) satisfies SearchResult),
    ...students.map((s) => ({ type: "student", id: s.id, title: s.name, subtitle: `+${s.phone}`, href: `/students/${s.id}` }) satisfies SearchResult),
    ...groups.map((g) => ({ type: "group", id: g.id, title: g.name, subtitle: g.course.name, href: `/groups/${g.id}` }) satisfies SearchResult),
    ...leads.map((l) => ({ type: "lead", id: l.id, title: l.name, subtitle: `+${l.phone}`, href: `/leads/${l.id}` }) satisfies SearchResult),
  ];

  return NextResponse.json({ results });
}
