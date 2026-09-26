"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@markazai/db";
import type { ActionResult } from "@markazai/types";
import { logHistory } from "@/lib/history";
import { requirePermission, type SessionUser } from "@/lib/session";

async function guard(permission: Parameters<typeof requirePermission>[0]): Promise<SessionUser | null> {
  try {
    return await requirePermission(permission);
  } catch {
    return null;
  }
}

const refresh = () => {
  revalidatePath("/leads");
  revalidatePath("/leads/archive");
  revalidatePath("/leads/reasons");
};

const idsSchema = z.array(z.uuid()).min(1).max(500);
const nameSchema = z.string().trim().min(2, "required").max(60);

/** Lidni sabab bilan arxivlaydi (doskadan yo'qoladi, arxiv sahifasidan qayta tiklanadi). */
export async function archiveLead(id: string, reasonId: string, note: string): Promise<ActionResult> {
  const user = await guard("leads:delete");
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = z.object({ id: z.uuid(), reasonId: z.uuid(), note: z.string().trim().max(500) }).safeParse({ id, reasonId, note });
  if (!parsed.success) return { ok: false, error: "validation" };

  const [reason, lead] = await Promise.all([
    prisma.leadArchiveReason.findFirst({ where: { id: reasonId, organizationId: user.orgId, isActive: true }, select: { name: true } }),
    prisma.lead.findFirst({ where: { id, organizationId: user.orgId, convertedStudentId: null, archivedAt: null }, select: { id: true } }),
  ]);
  if (!reason) return { ok: false, error: "validation" };
  if (!lead) return { ok: false, error: "notFound" };

  await prisma.lead.update({ where: { id }, data: { archivedAt: new Date(), archivedById: user.id, archiveReasonId: reasonId, archiveNote: parsed.data.note || null } });
  await logHistory(user, "lead", id, "archived", { reason: reason.name });
  refresh();
  return { ok: true };
}

/** Arxivdagi lidlarni doskaga qaytaradi (avvalgi ustun/ro'yxatiga). */
export async function restoreLeads(ids: string[]): Promise<ActionResult<{ count: number }>> {
  const user = await guard("leads:write");
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "validation" };
  const res = await prisma.lead.updateMany({
    where: { id: { in: parsed.data }, organizationId: user.orgId, archivedAt: { not: null } },
    data: { archivedAt: null, archivedById: null, archiveReasonId: null, archiveNote: null },
  });
  refresh();
  return { ok: true, count: res.count };
}

/** Arxivdagi lidlarni BUTUNLAY o'chiradi (qaytarib bo'lmaydi). */
export async function purgeLeads(ids: string[]): Promise<ActionResult<{ count: number }>> {
  const user = await guard("leads:delete");
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "validation" };
  const res = await prisma.lead.deleteMany({ where: { id: { in: parsed.data }, organizationId: user.orgId, archivedAt: { not: null } } });
  refresh();
  return { ok: true, count: res.count };
}

// ───────────── Arxivlash sabablari ─────────────

export async function createReason(name: string): Promise<ActionResult> {
  const user = await guard("leads:configure");
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: "validation" };
  try {
    await prisma.leadArchiveReason.create({ data: { organizationId: user.orgId, name: parsed.data, createdById: user.id } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { ok: false, error: "duplicate" };
    throw e;
  }
  refresh();
  return { ok: true };
}

export async function renameReason(id: string, name: string): Promise<ActionResult> {
  const user = await guard("leads:configure");
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: "validation" };
  try {
    const res = await prisma.leadArchiveReason.updateMany({ where: { id, organizationId: user.orgId }, data: { name: parsed.data } });
    if (res.count === 0) return { ok: false, error: "notFound" };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { ok: false, error: "duplicate" };
    throw e;
  }
  refresh();
  return { ok: true };
}

/** Sabab o'chirilmaydi — faolsizlantiriladi (eski arxivlardagi sabab nomi saqlanadi). */
export async function setReasonActive(id: string, isActive: boolean): Promise<ActionResult> {
  const user = await guard("leads:configure");
  if (!user) return { ok: false, error: "forbidden" };
  const res = await prisma.leadArchiveReason.updateMany({ where: { id, organizationId: user.orgId }, data: { isActive } });
  if (res.count === 0) return { ok: false, error: "notFound" };
  refresh();
  return { ok: true };
}
