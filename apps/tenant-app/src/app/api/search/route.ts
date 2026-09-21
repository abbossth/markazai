import { NextResponse } from "next/server";
import { prisma } from "@markazai/db";
import { getSessionUser } from "@/lib/session";

export type SearchResult = { type: string; id: string; title: string; subtitle?: string; href: string };

/**
 * Global qidiruv. Hozircha faqat xodimlar; Talabalar/Guruhlar/Lidlar modullari
 * qo'shilganda shu yerga yangi manbalar qo'shiladi.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const digits = q.replace(/\D/g, "");
  const staff = await prisma.user.findMany({
    where: {
      organizationId: user.orgId,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 2 ? [{ phone: { contains: digits } }] : []),
      ],
    },
    select: { id: true, name: true, phone: true },
    orderBy: { name: "asc" },
    take: 8,
  });

  const results: SearchResult[] = staff.map((u) => ({
    type: "staff",
    id: u.id,
    title: u.name,
    subtitle: `+${u.phone}`,
    href: "/settings/staff",
  }));

  return NextResponse.json({ results });
}
