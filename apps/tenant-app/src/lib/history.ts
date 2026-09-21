import { prisma } from "@markazai/db";
import type { SessionUser } from "./session";

export async function logHistory(
  user: SessionUser,
  entityType: "student" | "group" | "lead" | "teacher",
  entityId: string,
  action: string,
  details?: Record<string, string | number | null | undefined>,
) {
  await prisma.historyLog.create({
    data: {
      organizationId: user.orgId,
      entityType,
      entityId,
      action,
      details: details ?? undefined,
      actorId: user.id,
      actorName: user.name,
    },
  });
}
