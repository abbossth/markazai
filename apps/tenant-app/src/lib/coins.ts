import { prisma } from "@markazai/db";
import { toISODate } from "@markazai/types";
import type { CoinEntry } from "@/components/shared/coins";

/** Talabaning coin jami va oxirgi 50 yozuvi. `groupIds` berilsa (faqat-o'qituvchi) — faqat shu guruhlar bo'yicha. */
export async function loadStudentCoins(orgId: string, studentId: string, groupIds: string[] | null) {
  const where = { organizationId: orgId, studentId, ...(groupIds && { groupId: { in: groupIds } }) };
  const [sum, rows] = await Promise.all([
    prisma.coinLog.aggregate({ where, _sum: { amount: true } }),
    prisma.coinLog.findMany({ where, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 50, include: { group: { select: { name: true } } } }),
  ]);
  const history: CoinEntry[] = rows.map((r) => ({ id: r.id, amount: r.amount, kind: r.kind, reason: r.reason, date: toISODate(r.date), groupName: r.group?.name ?? null }));
  return { total: sum._sum.amount ?? 0, history };
}
