import { z } from "zod";
import { prisma, withTenant } from "@markazai/db";
import { verifyInternal } from "@/lib/internal-auth";

export const runtime = "nodejs";

const bodySchema = z.object({ orgId: z.uuid() });

/** Agregat foydalanish ko'rsatkichlari (faqat sonlar — tafsilot hech qachon qaytarilmaydi). Control Plane monitoring uchun. */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyInternal(request, raw)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(JSON.parse(raw || "{}"));
  if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });

  const usage = await withTenant(parsed.data.orgId, async () => {
    const [students, staff, groups] = await Promise.all([prisma.student.count(), prisma.user.count(), prisma.group.count()]);
    return { studentsCount: students, staffCount: staff, groupsCount: groups };
  });
  return Response.json(usage);
}
