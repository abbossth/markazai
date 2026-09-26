import type { PrismaClient } from "./generated/client";

export const DEFAULT_LEAD_COLUMNS = ["Lidlar", "Expectation", "Set"] as const;

/** Tashkilotda hali ustunlar bo'lmasa, standart Kanban ustunlarini yaratadi. Ustunlar ro'yxatini qaytaradi. */
export async function ensureDefaultLeadColumns(prisma: PrismaClient, organizationId: string) {
  const existing = await prisma.leadColumn.findMany({ where: { organizationId }, orderBy: { position: "asc" } });
  if (existing.length > 0) return existing;
  await prisma.leadColumn.createMany({
    data: DEFAULT_LEAD_COLUMNS.map((name, position) => ({ organizationId, name, position, isSet: name === "Set" })),
  });
  return prisma.leadColumn.findMany({ where: { organizationId }, orderBy: { position: "asc" } });
}

export const DEFAULT_ARCHIVE_REASONS = ["Boshqa o'quv markazda o'qiydi", "Ishlaydi, vaqti yo'q", "Mavjud talaba", "Vaqti to'g'ri kelmadi", "Boshqa"] as const;

/** Tashkilotda hali arxivlash sabablari bo'lmasa, standartlarini yaratadi. */
export async function ensureDefaultArchiveReasons(prisma: PrismaClient, organizationId: string) {
  if ((await prisma.leadArchiveReason.count({ where: { organizationId } })) > 0) return;
  await prisma.leadArchiveReason.createMany({ data: DEFAULT_ARCHIVE_REASONS.map((name) => ({ organizationId, name })), skipDuplicates: true });
}
