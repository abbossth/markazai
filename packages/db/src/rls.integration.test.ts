import path from "node:path";
import { config } from "dotenv";
import { afterAll, describe, expect, it } from "vitest";

config({ path: path.resolve(process.cwd(), "../../.env") });

// Haqiqiy bazada: ilova roli (markazai_app) orqali RLS haqiqatan izolyatsiya qilishini tekshiradi.
const ORG_A = process.env.DEFAULT_ORGANIZATION_ID ?? "00000000-0000-4000-8000-000000000001";
const ORG_B = "00000000-0000-4000-8000-0000000000bb";

afterAll(async () => {
  const { prisma, getAdminPrisma } = await import("./index");
  await prisma.$disconnect();
  await getAdminPrisma().$disconnect();
});

describe("RLS: sxema qamrovi", () => {
  it("organization_id ustuni bor HAR BIR jadvalda RLS yoqilgan va tenant_isolation policy bor", async () => {
    const { getAdminPrisma } = await import("./index");
    const admin = getAdminPrisma();
    const tables = await admin.$queryRaw<{ table_name: string; rls: boolean; policies: number }[]>`
      SELECT c.table_name, cl.relrowsecurity AS rls,
             (SELECT count(*)::int FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.table_name AND p.policyname = 'tenant_isolation') AS policies
      FROM information_schema.columns c
      JOIN pg_class cl ON cl.relname = c.table_name AND cl.relnamespace = 'public'::regnamespace
      WHERE c.table_schema = 'public' AND c.column_name = 'organization_id'`;
    expect(tables.length).toBeGreaterThan(30);
    const missing = tables.filter((t) => !t.rls || t.policies !== 1).map((t) => t.table_name);
    // Yangi jadval qo'shilib, RLS policy unutilsa — shu test yiqiladi.
    expect(missing).toEqual([]);
  });

  it("ilova roli RLS'ni aylanib o'tolmaydi (superuser/BYPASSRLS emas)", async () => {
    const { prisma, getAdminPrisma } = await import("./index");
    const admin = getAdminPrisma();
    // Ilova aynan cheklangan rol bilan ulangan bo'lishi kerak (aks holda quyidagi testlar ma'nosiz).
    const rows = await admin.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'markazai_app'`;
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    const who = await prisma.$queryRaw<{ current_user: string }[]>`SELECT current_user`;
    expect(who[0]?.current_user).toBe("markazai_app");
  });
});

describe("RLS: xatti-harakat (markazai_app orqali)", () => {
  it("kontekst yo'q → hech narsa ko'rinmaydi (fail-closed)", async () => {
    const { prisma } = await import("./index");
    expect(await prisma.student.count()).toBe(0);
    expect(await prisma.centerSettings.count()).toBe(0);
  });

  it("o'z tashkiloti kontekstida ma'lumot ko'rinadi, boshqa tashkilotniki — yo'q", async () => {
    const { prisma, withTenant } = await import("./index");
    expect(await withTenant(ORG_A, () => prisma.student.count())).toBeGreaterThan(0);
    expect(await withTenant(ORG_B, () => prisma.student.count())).toBe(0);
  });

  it("WHERE organization_id yozilmasa ham boshqa tashkilot qatori qaytmaydi; id bo'yicha ham topilmaydi", async () => {
    const { prisma, getAdminPrisma, withTenant } = await import("./index");
    const admin = getAdminPrisma();
    const b = await admin.student.create({ data: { organizationId: ORG_B, name: "RLS Boshqa Markaz", phone: "998900000099", status: "ACTIVE" } });
    try {
      // A konteksti: filtrsiz so'rov B talabasini ko'rmaydi
      const all = await withTenant(ORG_A, () => prisma.student.findMany({ select: { id: true, organizationId: true } }));
      expect(all.every((s) => s.organizationId === ORG_A)).toBe(true);
      expect(await withTenant(ORG_A, () => prisma.student.findUnique({ where: { id: b.id } }))).toBeNull();
      // Yangilash/o'chirish ham begona qatorga ta'sir qilmaydi
      expect((await withTenant(ORG_A, () => prisma.student.updateMany({ where: { id: b.id }, data: { name: "Hacked" } }))).count).toBe(0);
      expect((await withTenant(ORG_A, () => prisma.student.deleteMany({ where: { id: b.id } }))).count).toBe(0);
      // B o'z konteksti ichida ko'radi
      expect((await withTenant(ORG_B, () => prisma.student.findUnique({ where: { id: b.id } })))?.name).toBe("RLS Boshqa Markaz");
    } finally {
      await admin.student.delete({ where: { id: b.id } });
    }
  });

  it("boshqa tashkilot nomidan yozib bo'lmaydi (WITH CHECK)", async () => {
    const { prisma, withTenant } = await import("./index");
    await expect(withTenant(ORG_A, () => prisma.student.create({ data: { organizationId: ORG_B, name: "Forged", phone: "998900000098", status: "ACTIVE" } }))).rejects.toThrow();
    // Kontekstsiz yozish ham mumkin emas
    await expect(prisma.student.create({ data: { organizationId: ORG_A, name: "NoCtx", phone: "998900000097", status: "ACTIVE" } })).rejects.toThrow();
  });

  it("ulanishlar qayta ishlatilganda kontekst aralashmaydi (parallel A/B/kontekstsiz)", async () => {
    const { prisma, withTenant } = await import("./index");
    const jobs = Array.from({ length: 60 }, (_, i) => {
      const which = i % 3;
      if (which === 0) return withTenant(ORG_A, () => prisma.student.count()).then((n) => ({ which, ok: n > 0 }));
      if (which === 1) return withTenant(ORG_B, () => prisma.student.count()).then((n) => ({ which, ok: n === 0 }));
      return prisma.student.count().then((n) => ({ which, ok: n === 0 }));
    });
    const results = await Promise.all(jobs);
    expect(results.filter((r) => !r.ok)).toEqual([]);
  });

  it("interaktiv tranzaksiya butunlay bitta tashkilot ostida", async () => {
    const { prisma, withTenant } = await import("./index");
    const res = await withTenant(ORG_A, () =>
      prisma.$transaction(async (tx) => {
        const a = await tx.student.count();
        const g = await tx.group.count();
        return { a, g };
      }),
    );
    expect(res.a).toBeGreaterThan(0);
    expect(res.g).toBeGreaterThan(0);
  });
});
