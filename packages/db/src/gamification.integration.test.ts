import path from "node:path";
import { config } from "dotenv";
import { afterAll, describe, expect, it } from "vitest";
import { fromISODate, lessonDatesInMonth } from "@markazai/types";

config({ path: path.resolve(process.cwd(), "../../.env") });

class Rollback extends Error {}
type Tx = import("./generated/client").Prisma.TransactionClient;

// Haqiqiy bazada, lekin ROLLBACK qilinadigan tranzaksiya ichida (ma'lumot o'zgarmaydi).
async function inRollback(fn: (tx: Tx) => Promise<void>) {
  const { getAdminPrisma } = await import("./index");
  const prisma = getAdminPrisma();
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    }, { timeout: 30_000 });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}
afterAll(async () => {
  const { getAdminPrisma } = await import("./index");
  const prisma = getAdminPrisma();
  await prisma.$disconnect();
});

const ORG = process.env.DEFAULT_ORGANIZATION_ID ?? "00000000-0000-4000-8000-000000000001";

describe("syncAttendanceCoins (haqiqiy baza)", () => {
  it("keldi → coin; sababsiz → olinadi; yana keldi → qaytadi; o'chiq rejimda hech narsa", async () => {
    const { syncAttendanceCoins } = await import("./gamification");
    await inRollback(async (tx) => {
      const group = await tx.group.findFirstOrThrow({ where: { organizationId: ORG, name: "A-3" } });
      const iso = lessonDatesInMonth({ days: group.days, customDays: group.customDays, startDate: group.startDate, endDate: group.endDate }, 2026, 8)[2]!;
      const date = fromISODate(iso);
      const student = await tx.student.create({ data: { organizationId: ORG, name: "Coin Test", phone: "998900000002", status: "ACTIVE" } });
      const args = { organizationId: ORG, groupId: group.id, studentId: student.id, date };
      const total = async () => (await tx.coinLog.aggregate({ where: { studentId: student.id }, _sum: { amount: true } }))._sum.amount ?? 0;
      const mark = (status: "PRESENT" | "ABSENT" | "EXCUSED") => tx.attendance.upsert({ where: { groupId_studentId_date: { groupId: group.id, studentId: student.id, date } }, update: { status }, create: { organizationId: ORG, groupId: group.id, studentId: student.id, date, status } });

      // O'chiq rejim
      await tx.centerSettings.update({ where: { organizationId: ORG }, data: { gamificationEnabled: false, coinsPerLesson: 3 } });
      await mark("PRESENT");
      expect(await syncAttendanceCoins(tx, args)).toBe(0);
      expect(await total()).toBe(0);

      // Yoqilgan
      await tx.centerSettings.update({ where: { organizationId: ORG }, data: { gamificationEnabled: true } });
      expect(await syncAttendanceCoins(tx, args)).toBe(3);
      expect(await total()).toBe(3);
      // Idempotent: qayta chaqirish o'zgartirmaydi
      expect(await syncAttendanceCoins(tx, args)).toBe(0);
      expect(await total()).toBe(3);

      await mark("ABSENT");
      expect(await syncAttendanceCoins(tx, args)).toBe(-3);
      expect(await total()).toBe(0);
      await mark("EXCUSED");
      expect(await syncAttendanceCoins(tx, args)).toBe(0);

      await mark("PRESENT");
      expect(await syncAttendanceCoins(tx, args)).toBe(3);
      // Qiymat sozlamasi o'zgarsa, keyingi sinxron yozuvni yangilaydi
      await tx.centerSettings.update({ where: { organizationId: ORG }, data: { coinsPerLesson: 5 } });
      expect(await syncAttendanceCoins(tx, args)).toBe(2);
      expect(await total()).toBe(5);
      expect(await tx.coinLog.count({ where: { studentId: student.id } })).toBe(1);

      // Backfill: mavjud davomat asosida tenglashtirish (MANUAL'ga tegmaydi), idempotent
      const { backfillAttendanceCoins } = await import("./gamification");
      await tx.coinLog.create({ data: { organizationId: ORG, studentId: student.id, amount: 7, kind: "MANUAL", reason: "test", date } });
      await tx.coinLog.deleteMany({ where: { studentId: student.id, kind: "ATTENDANCE" } });
      const before = await tx.coinLog.count({ where: { organizationId: ORG, kind: "ATTENDANCE" } });
      const r1 = await backfillAttendanceCoins(tx, ORG, 4);
      expect(r1.created).toBeGreaterThan(0);
      expect(await tx.coinLog.count({ where: { organizationId: ORG, kind: "ATTENDANCE" } })).toBe(before + r1.created);
      expect(await total()).toBe(7 + 4); // MANUAL 7 + bu talabaning 1 ta "keldi" darsi × 4
      const r2 = await backfillAttendanceCoins(tx, ORG, 4);
      expect(r2).toEqual({ created: 0, updated: 0, removed: 0 });
      const r3 = await backfillAttendanceCoins(tx, ORG, 0);
      expect(r3.removed).toBeGreaterThan(0);
      expect(await total()).toBe(7);
    });
  });
});
