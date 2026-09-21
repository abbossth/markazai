import { attendanceCoins } from "@markazai/types";
import type { Prisma, PrismaClient } from "./generated/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Bitta (talaba, guruh, dars kuni) uchun davomat coinini davomat holatiga moslaydi (idempotent, `syncLessonCharge` kabi):
 * "keldi" → `coinsPerLesson` ATTENDANCE yozuvi; boshqa holat yoki belgi olib tashlansa → yozuv o'chadi.
 * Gamifikatsiya o'chiq bo'lsa hech narsa qilinmaydi (mavjud tarix saqlanadi). Qaytaradi: coin o'zgarishi.
 */
export async function syncAttendanceCoins(db: Db, p: { organizationId: string; groupId: string; studentId: string; date: Date }): Promise<number> {
  const settings = await db.centerSettings.findUnique({ where: { organizationId: p.organizationId }, select: { gamificationEnabled: true, coinsPerLesson: true } });
  if (!settings?.gamificationEnabled) return 0;

  const [attendance, existing] = await Promise.all([
    db.attendance.findFirst({ where: { groupId: p.groupId, studentId: p.studentId, date: p.date }, select: { status: true } }),
    db.coinLog.findFirst({ where: { studentId: p.studentId, groupId: p.groupId, lessonDate: p.date, kind: "ATTENDANCE" } }),
  ]);
  const expected = attendanceCoins(attendance?.status, settings.coinsPerLesson);
  const current = existing?.amount ?? 0;
  if (expected === current) return 0;

  if (expected === 0 && existing) await db.coinLog.delete({ where: { id: existing.id } });
  else if (existing) await db.coinLog.update({ where: { id: existing.id }, data: { amount: expected } });
  else await db.coinLog.create({ data: { organizationId: p.organizationId, studentId: p.studentId, groupId: p.groupId, amount: expected, kind: "ATTENDANCE", date: p.date, lessonDate: p.date } });
  return expected - current;
}

/**
 * Mavjud davomatga qarab davomat coinlarini ommaviy tenglashtiradi (gamifikatsiya yoqilganda yoki `coinsPerLesson` o'zgarganda):
 * har bir "keldi" darsi uchun yozuv yaratadi, mavjudlarining qiymatini yangilaydi; qiymat 0 bo'lsa davomat coinlarini o'chiradi.
 * Qo'lda berilgan (MANUAL) coinlarga tegilmaydi. Idempotent. Qaytaradi: { created, updated, removed }.
 */
export async function backfillAttendanceCoins(db: Db, organizationId: string, perLesson: number) {
  const amount = Math.max(0, Math.trunc(perLesson));
  if (amount === 0) {
    const removed = await db.coinLog.deleteMany({ where: { organizationId, kind: "ATTENDANCE" } });
    return { created: 0, updated: 0, removed: removed.count };
  }
  const present = await db.attendance.findMany({ where: { organizationId, status: "PRESENT" }, select: { groupId: true, studentId: true, date: true } });
  const created = await db.coinLog.createMany({
    data: present.map((a) => ({ organizationId, studentId: a.studentId, groupId: a.groupId, amount, kind: "ATTENDANCE" as const, date: a.date, lessonDate: a.date })),
    skipDuplicates: true,
  });
  const updated = await db.coinLog.updateMany({ where: { organizationId, kind: "ATTENDANCE", amount: { not: amount } }, data: { amount } });
  return { created: created.count, updated: updated.count, removed: 0 };
}
