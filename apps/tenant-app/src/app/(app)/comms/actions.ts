"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@markazai/db";
import { callSchema, smsSchema, type ActionResult, type CallInput } from "@markazai/types";
import { logHistory } from "@/lib/history";
import { getSmsProvider } from "@/lib/sms";
import { requirePermission, type SessionUser } from "@/lib/session";

export type CommsTarget = { leadId: string } | { studentId: string };
type Result = ActionResult & { fieldErrors?: Record<string, string> };

/** Qo'ng'iroq/SMS maqsadini (lid yoki talaba) tekshiradi va telefonini qaytaradi. */
async function resolveTarget(user: SessionUser, target: CommsTarget) {
  if ("leadId" in target) {
    const lead = await prisma.lead.findFirst({ where: { id: target.leadId, organizationId: user.orgId }, select: { id: true, phone: true, name: true } });
    return lead ? { kind: "lead" as const, id: lead.id, phone: lead.phone, name: lead.name } : null;
  }
  const student = await prisma.student.findFirst({ where: { id: target.studentId, organizationId: user.orgId }, select: { id: true, phone: true, name: true } });
  return student ? { kind: "student" as const, id: student.id, phone: student.phone, name: student.name } : null;
}

async function guard(target: CommsTarget): Promise<SessionUser | null> {
  try {
    return await requirePermission("leadId" in target ? "leads:write" : "students:write");
  } catch {
    return null;
  }
}

function revalidate(target: CommsTarget) {
  revalidatePath("leadId" in target ? `/leads/${target.leadId}` : `/students/${target.studentId}`);
}

export async function logCall(target: CommsTarget, input: CallInput): Promise<Result> {
  const user = await guard(target);
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = callSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const resolved = await resolveTarget(user, target);
  if (!resolved) return { ok: false, error: "notFound" };
  const d = parsed.data;

  await prisma.callLog.create({
    data: {
      organizationId: user.orgId,
      leadId: resolved.kind === "lead" ? resolved.id : null,
      studentId: resolved.kind === "student" ? resolved.id : null,
      direction: d.direction,
      outcome: d.outcome,
      durationSeconds: d.durationMinutes ? d.durationMinutes * 60 : null,
      note: d.note,
      createdById: user.id,
    },
  });
  await logHistory(user, resolved.kind, resolved.id, "call_logged", { outcome: d.outcome });
  revalidate(target);
  return { ok: true };
}

/** SMS yuboradi (hozircha mock provayder: faqat jurnalga yoziladi) va SmsLog'ga saqlaydi. */
export async function sendSms(target: CommsTarget, text: string): Promise<Result> {
  const user = await guard(target);
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = smsSchema.safeParse({ text });
  if (!parsed.success) return { ok: false, error: "validation" };
  const resolved = await resolveTarget(user, target);
  if (!resolved) return { ok: false, error: "notFound" };

  const provider = getSmsProvider();
  const result = await provider.send(resolved.phone, parsed.data.text).catch((e: unknown) => ({
    status: "FAILED" as const,
    provider: provider.name,
    error: e instanceof Error ? e.message : "unknown",
  }));

  await prisma.smsLog.create({
    data: {
      organizationId: user.orgId,
      leadId: resolved.kind === "lead" ? resolved.id : null,
      studentId: resolved.kind === "student" ? resolved.id : null,
      phone: resolved.phone,
      text: parsed.data.text,
      status: result.status,
      provider: result.provider,
      error: "error" in result ? result.error : null,
      sentById: user.id,
    },
  });
  await logHistory(user, resolved.kind, resolved.id, "sms_sent", { status: result.status });
  revalidate(target);
  return result.status === "FAILED" ? { ok: false, error: "smsFailed" } : { ok: true };
}
