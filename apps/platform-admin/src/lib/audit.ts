import { platformPrisma } from "@markazai/db/platform";
import type { Admin } from "./session";

/** Control Plane harakatlari o'zgarmas audit-logga yoziladi (0.6). */
export async function audit(admin: Admin, action: string, entityType: string, entityId?: string, details?: Record<string, unknown>) {
  await platformPrisma.auditLog.create({ data: { adminId: admin.id, adminEmail: admin.email, action, entityType, entityId, details: (details ?? undefined) as never } });
}
