import path from "node:path";
import { config } from "dotenv";
import { afterAll, describe, expect, it } from "vitest";
import { lessonAmount, lessonDatesInMonth, fromISODate } from "@markazai/types";

config({ path: path.resolve(process.cwd(), "../../.env") });

// Haqiqiy bazada ishlaydi, lekin har bir test ROLLBACK qilinadigan tranzaksiya ichida — ma'lumot o'zgarmaydi.
class Rollback extends Error {}

async function inRollback(fn: (tx: import("./generated/client").Prisma.TransactionClient) => Promise<void>) {
  const { prisma } = await import("./index");
  try {
    await prisma.$transaction(
      async (tx) => {
        await fn(tx);
        throw new Rollback();
      },
      { timeout: 30_000 },
    );
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

afterAll(async () => {
  const { prisma } = await import("./index");
  await prisma.$disconnect();
});

const ORG = process.env.DEFAULT_ORGANIZATION_ID ?? "00000000-0000-4000-8000-000000000001";

async function setup(tx: import("./generated/client").Prisma.TransactionClient) {
  const group = await tx.group.findFirstOrThrow({ where: { organizationId: ORG, name: "A-3" } });
  const lessons = lessonDatesInMonth({ days: group.days, customDays: group.customDays, startDate: group.startDate, endDate: group.endDate }, 2026, 8);
  const iso = lessons[2]!; // oy ichidagi 3-dars
  const date = fromISODate(iso);
  const student = await tx.student.create({ data: { organizationId: ORG, name: "Test Talaba", phone: "998900000001", status: "ACTIVE" } });
  await tx.groupStudent.create({ data: { organizationId: ORG, groupId: group.id, studentId: student.id, joinedAt: group.startDate } });
  return { group, lessons, date, student };
}

describe("syncLessonCharge (haqiqiy baza)", () => {
  it("keldi → yechiladi; sababli → qaytariladi; sababsiz → yana yechiladi; balans doim mos", async () => {
    const { syncLessonCharge } = await import("./billing");
    await inRollback(async (tx) => {
      const { group, lessons, date, student } = await setup(tx);
      const expected = lessonAmount(group.price, 2, lessons.length);
      const args = { organizationId: ORG, groupId: group.id, studentId: student.id, date };
      const balance = async () => (await tx.student.findUniqueOrThrow({ where: { id: student.id } })).balance;
      const charges = () => tx.payment.findMany({ where: { studentId: student.id, type: "SYSTEM" } });

      await tx.attendance.create({ data: { organizationId: ORG, groupId: group.id, studentId: student.id, date, status: "PRESENT" } });
      expect(await syncLessonCharge(tx, args)).toBe(-expected);
      expect(await balance()).toBe(-expected);
      expect((await charges()).map((c) => c.amount)).toEqual([-expected]);

      // Idempotent: qayta sinxronlash hech narsani o'zgartirmaydi
      expect(await syncLessonCharge(tx, args)).toBe(0);
      expect(await balance()).toBe(-expected);
      expect(await charges()).toHaveLength(1);

      await tx.attendance.updateMany({ where: { studentId: student.id, date }, data: { status: "EXCUSED" } });
      await syncLessonCharge(tx, args);
      expect(await balance()).toBe(0);
      expect(await charges()).toHaveLength(0);

      await tx.attendance.updateMany({ where: { studentId: student.id, date }, data: { status: "ABSENT" } });
      await syncLessonCharge(tx, args);
      expect(await balance()).toBe(-expected);

      await tx.attendance.deleteMany({ where: { studentId: student.id, date } });
      await syncLessonCharge(tx, args);
      expect(await balance()).toBe(0);
    });
  });

  it("chegirma dars ulushini kamaytiradi, qo'lda to'lov balansni oshiradi", async () => {
    const { syncLessonCharge, recalculateStudentGroup, recomputeBalances } = await import("./billing");
    await inRollback(async (tx) => {
      const { group, lessons, date, student } = await setup(tx);
      const args = { organizationId: ORG, groupId: group.id, studentId: student.id, date };
      await tx.attendance.create({ data: { organizationId: ORG, groupId: group.id, studentId: student.id, date, status: "PRESENT" } });
      await syncLessonCharge(tx, args);
      const full = lessonAmount(group.price, 2, lessons.length);

      await tx.discount.create({ data: { organizationId: ORG, groupId: group.id, studentId: student.id, amount: 50_000, fromDate: group.startDate } });
      await recalculateStudentGroup(tx, { organizationId: ORG, groupId: group.id, studentId: student.id });
      const discounted = lessonAmount(group.price - 50_000, 2, lessons.length);
      expect(discounted).toBeLessThan(full);
      expect((await tx.student.findUniqueOrThrow({ where: { id: student.id } })).balance).toBe(-discounted);

      await tx.payment.create({ data: { organizationId: ORG, studentId: student.id, amount: 100_000, date, type: "MANUAL", method: "CASH" } });
      await tx.student.update({ where: { id: student.id }, data: { balance: { increment: 100_000 } } });
      expect((await tx.student.findUniqueOrThrow({ where: { id: student.id } })).balance).toBe(100_000 - discounted);

      // Balans hisoblagichi to'lovlar yig'indisiga teng bo'lishi kerak (ta'mirlash funksiyasi hech narsani "tuzatmasligi" kerak)
      const before = (await tx.student.findUniqueOrThrow({ where: { id: student.id } })).balance;
      await tx.student.update({ where: { id: student.id }, data: { balance: 0 } });
      await recomputeBalances(tx as never, ORG);
      expect((await tx.student.findUniqueOrThrow({ where: { id: student.id } })).balance).toBe(before);
    });
  });
});
