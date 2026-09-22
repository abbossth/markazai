import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ensureDefaultLeadColumns, prisma, withTenant } from "@markazai/db";
import { phoneSchema } from "@markazai/types";
import { verifyInternal } from "@/lib/internal-auth";

export const runtime = "nodejs";

const bodySchema = z.object({
  orgId: z.uuid(),
  name: z.string().trim().min(2).max(80),
  ceoName: z.string().trim().min(2).max(120),
  ceoPhone: phoneSchema,
  // Berilmasa tasodifiy parol yaratiladi va javobda BIR MARTA qaytariladi.
  ceoPassword: z.string().min(8).max(72).optional(),
});

/**
 * Yangi tashkilot provisioning'i (Control Plane chaqiradi): standart sozlamalar, filial, Kanban ustunlari va CEO akkaunti.
 * Hammasi `withTenant(orgId)` ostida (RLS kontekst) yaratiladi. Idempotent emas: tashkilot allaqachon bor bo'lsa 409.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyInternal(request, raw)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(JSON.parse(raw || "{}"));
  if (!parsed.success) return Response.json({ error: "validation", issues: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 400 });
  const d = parsed.data;

  const password = d.ceoPassword ?? randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await withTenant(d.orgId, async () => {
      if ((await prisma.centerSettings.count()) > 0) throw new Error("exists");
      await prisma.$transaction(async (tx) => {
        await tx.centerSettings.create({ data: { organizationId: d.orgId, name: d.name } });
        const branch = await tx.branch.create({ data: { organizationId: d.orgId, name: "Asosiy filial" } });
        const ceo = await tx.user.create({ data: { organizationId: d.orgId, name: d.ceoName, phone: d.ceoPhone, roles: ["CEO"], position: "Markaz egasi", passwordHash } });
        await tx.userBranch.create({ data: { organizationId: d.orgId, userId: ceo.id, branchId: branch.id } });
      });
      await ensureDefaultLeadColumns(prisma, d.orgId);
    });
  } catch (e) {
    if ((e as Error).message === "exists") return Response.json({ error: "exists" }, { status: 409 });
    throw e;
  }
  return Response.json({ ok: true, ceoPhone: d.ceoPhone, ceoPassword: password });
}
