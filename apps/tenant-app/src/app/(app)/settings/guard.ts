import type { ActionResult } from "@markazai/types";
import { requirePermission, type SessionUser } from "@/lib/session";

export type Result<T = object> = ActionResult<T> & { fieldErrors?: Record<string, string> };

/** Sozlamalar server action'lari uchun umumiy tekshiruv (forbidden bo'lsa null). */
export async function guardSettings(): Promise<SessionUser | null> {
  try {
    return await requirePermission("settings:manage");
  } catch {
    return null;
  }
}

/** zod xatolarini { maydon: xabar } ko'rinishiga (birinchi xabar) aylantiradi. */
export function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}
