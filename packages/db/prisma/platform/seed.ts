import { config } from "dotenv";
import path from "node:path";
import bcrypt from "bcryptjs";

config({ path: path.resolve(process.cwd(), "../../.env") });

const DEMO_ORG_ID = process.env.DEFAULT_ORGANIZATION_ID ?? "00000000-0000-4000-8000-000000000001";

/**
 * Control Plane boshlang'ich ma'lumoti: platforma egasi, rejalar va BIRINCHI tenant — mavjud demo markaz
 * (tenant bazasidagi DEFAULT_ORGANIZATION_ID bilan bir xil ID, slug `demo`). Idempotent.
 */
async function main() {
  // Production'da standart admin paroli (admin12345) bilan owner yaratilmasin: parol muhitdan berilishi shart.
  if (process.env.NODE_ENV === "production" && !process.env.PLATFORM_OWNER_PASSWORD) throw new Error("Production'da PLATFORM_OWNER_PASSWORD (kamida 12 belgi) berilishi shart");
  const { platformPrisma: prisma } = await import("../../src/platform");

  const passwordHash = await bcrypt.hash(process.env.PLATFORM_OWNER_PASSWORD ?? "admin12345", 10);
  await prisma.platformAdmin.upsert({
    where: { email: "owner@markazai.uz" },
    update: {},
    create: { email: "owner@markazai.uz", name: "Platforma egasi", passwordHash, role: "OWNER" },
  });

  const plans = [
    { name: "Boshlang'ich", monthlyPrice: 300_000, maxStaff: 5, maxBranches: 1, maxStudents: 100, modules: [] as string[] },
    { name: "Standart", monthlyPrice: 600_000, maxStaff: 15, maxBranches: 3, maxStudents: 500, modules: ["gamification"] },
    { name: "Premium", monthlyPrice: 1_200_000, maxStaff: null, maxBranches: null, maxStudents: null, modules: ["gamification", "integrations"] },
  ];
  for (const p of plans) await prisma.plan.upsert({ where: { name: p.name }, update: {}, create: p });

  const org = await prisma.organization.upsert({
    where: { id: DEMO_ORG_ID },
    update: {},
    create: { id: DEMO_ORG_ID, name: "Markazai Demo Markaz", slug: "demo", status: "ACTIVE", contactName: "Abbos Akhmedov", contactPhone: "998901234567" },
  });
  if ((await prisma.subscription.count({ where: { organizationId: org.id } })) === 0) {
    const premium = await prisma.plan.findUniqueOrThrow({ where: { name: "Premium" } });
    const start = new Date();
    const end = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate()));
    await prisma.subscription.create({ data: { organizationId: org.id, planId: premium.id, billingCycle: 12, price: premium.monthlyPrice * 12, startDate: start, endDate: end } });
  }
  console.log(`Platform seed tayyor. Kirish: owner@markazai.uz / ${process.env.PLATFORM_OWNER_PASSWORD ? "(berilgan parol)" : "admin12345"}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
