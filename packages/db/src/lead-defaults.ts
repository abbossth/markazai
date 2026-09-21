import type { PrismaClient } from "./generated/client";

export const DEFAULT_LEAD_COLUMNS = ["Lidlar", "Expectation", "Set"] as const;

/** Tashkilotda hali ustunlar bo'lmasa, standart Kanban ustunlarini yaratadi. Ustunlar ro'yxatini qaytaradi. */
export async function ensureDefaultLeadColumns(prisma: PrismaClient, organizationId: string) {
  const existing = await prisma.leadColumn.findMany({ where: { organizationId }, orderBy: { position: "asc" } });
  if (existing.length > 0) return existing;
  await prisma.leadColumn.createMany({
    data: DEFAULT_LEAD_COLUMNS.map((name, position) => ({ organizationId, name, position })),
  });
  return prisma.leadColumn.findMany({ where: { organizationId }, orderBy: { position: "asc" } });
}
