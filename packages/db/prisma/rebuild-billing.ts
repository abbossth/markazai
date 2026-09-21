// Barcha SYSTEM yechimlarni davomatdan qayta quradi. Ishga tushirish: npm run billing:rebuild -w @markazai/db
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), "../../.env") });

async function main() {
  const { prisma, rebuildAllCharges, recomputeBalances } = await import("../src/index");
  const orgId = process.env.DEFAULT_ORGANIZATION_ID ?? "00000000-0000-4000-8000-000000000001";
  const lessons = await rebuildAllCharges(prisma, orgId);
  const fixed = await recomputeBalances(prisma, orgId);
  console.log(`Qayta qurildi: ${lessons} ta davomat yozuvi; balansi tuzatilgan talabalar: ${fixed}.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
