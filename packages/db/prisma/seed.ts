import { config } from "dotenv";
import path from "node:path";
import bcrypt from "bcryptjs";
import { seedDemoData, seedFinanceData, seedLeadsData, seedTeacherData } from "./seed-demo";

config({ path: path.resolve(process.cwd(), "../../.env") });

const ORG_ID = process.env.DEFAULT_ORGANIZATION_ID ?? "00000000-0000-4000-8000-000000000001";

async function main() {
  // Demo ma'lumot va ma'lum parollar (password123) production bazaga tushib qolmasligi uchun.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") throw new Error("Demo seed production'da o'chirilgan (ALLOW_DEMO_SEED=1 bilan majburlash mumkin — tavsiya etilmaydi)");
  // Dinamik import: DATABASE_URL yuklangandan keyin klient yaratiladi.
  const { getAdminPrisma } = await import("../src/index");
  const prisma = getAdminPrisma();

  const branch =
    (await prisma.branch.findFirst({ where: { organizationId: ORG_ID } })) ??
    (await prisma.branch.create({
      data: {
        organizationId: ORG_ID,
        name: "Asosiy filial",
        address: "Toshkent sh., Chilonzor t.",
        workingHours: "09:00–21:00",
      },
    }));

  await prisma.centerSettings.upsert({
    where: { organizationId: ORG_ID },
    update: {},
    create: { organizationId: ORG_ID, name: "Markazai Demo Markaz", phone: "998712000000" },
  });

  // Xodimlar: (telefon, ism, rollar, lavozim)
  const staff = [
    { phone: "998901234567", name: "Abbos Akhmedov", roles: ["CEO"], position: "Markaz egasi" },
    { phone: "998901111111", name: "Dilnoza Karimova", roles: ["ADMINISTRATOR", "CASHIER"], position: "Administrator" },
    { phone: "998902222222", name: "Jasur Toshmatov", roles: ["MARKETER"], position: "Marketolog" },
  ] as const;

  const passwordHash = await bcrypt.hash("password123", 10);
  let ceo: { id: string; name: string } | undefined;
  for (const s of staff) {
    const user = await prisma.user.upsert({
      where: { organizationId_phone: { organizationId: ORG_ID, phone: s.phone } },
      update: {},
      create: {
        organizationId: ORG_ID,
        phone: s.phone,
        name: s.name,
        roles: [...s.roles],
        position: s.position,
        passwordHash,
      },
    });
    if (s.roles.includes("CEO")) ceo = { id: user.id, name: user.name };
    await prisma.userBranch.upsert({
      where: { userId_branchId: { userId: user.id, branchId: branch.id } },
      update: {},
      create: { organizationId: ORG_ID, userId: user.id, branchId: branch.id },
    });
  }

  await seedDemoData(prisma, ORG_ID, ceo!);
  await seedLeadsData(prisma, ORG_ID, ceo!);
  await seedFinanceData(prisma, ORG_ID, ceo!);
  await seedTeacherData(prisma, ORG_ID, branch.id);

  console.log("Seed tayyor. Kirish: +998 90 123 45 67 / password123 (CEO)");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
