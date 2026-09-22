"use server";

import { headers } from "next/headers";
import { prisma } from "@markazai/db";
import { buildLeadSubmissionSchema, normalizeLeadFormFields } from "@markazai/types";
import { rateLimit } from "@/lib/rate-limit";
import { currentTenant } from "@/lib/tenant";

export type SubmitResult = { ok: true } | { ok: false; error: "unavailable" | "rateLimited" | "validation" | "generic"; fieldErrors?: Record<string, string> };

/**
 * Ommaviy lid formasi (kirishsiz). Himoya: yoqilgan forma sharti, IP bo'yicha cheklov, honeypot maydon,
 * server tomonida maydonlar qayta tekshiriladi (kurs shu markazniki bo'lishi shart), takroriy telefon yangi lid yaratmaydi.
 */
export async function submitLead(input: unknown): Promise<SubmitResult> {
  const tenant = await currentTenant();
  if (!tenant?.access.allowed) return { ok: false, error: "unavailable" };
  const orgId = tenant.orgId;
  const form = await prisma.leadForm.findUnique({ where: { organizationId: orgId } });
  if (!form?.enabled) return { ok: false, error: "unavailable" };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`lead-form:${ip}`, 5, 10 * 60_000)) return { ok: false, error: "rateLimited" };

  // Honeypot: to'ldirilgan bo'lsa bot — muvaffaqiyat ko'rsatamiz, lekin hech narsa yaratmaymiz.
  if (input && typeof input === "object" && "website" in input && String((input as { website?: unknown }).website ?? "") !== "") return { ok: true };

  const parsed = buildLeadSubmissionSchema(normalizeLeadFormFields(form.fields)).safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, error: "validation", fieldErrors };
  }
  const d = parsed.data;

  if (d.course && !(await prisma.course.findFirst({ where: { id: d.course, organizationId: orgId }, select: { id: true } }))) return { ok: false, error: "validation", fieldErrors: { course: "invalid" } };

  // Takroriy so'rov: shu telefonli faol lid bor — foydalanuvchiga muvaffaqiyat, yangi lid yaratilmaydi.
  if (await prisma.lead.findFirst({ where: { organizationId: orgId, phone: d.phone, convertedStudentId: null }, select: { id: true } })) return { ok: true };

  const column =
    (form.columnId ? await prisma.leadColumn.findFirst({ where: { id: form.columnId, organizationId: orgId } }) : null) ?? (await prisma.leadColumn.findFirst({ where: { organizationId: orgId }, orderBy: { position: "asc" } }));
  if (!column) return { ok: false, error: "unavailable" };

  const last = await prisma.lead.aggregate({ where: { organizationId: orgId, columnId: column.id, listId: null, convertedStudentId: null }, _max: { position: true } });
  const lead = await prisma.lead.create({
    data: { organizationId: orgId, name: d.name, phone: d.phone, source: "WEBSITE", columnId: column.id, position: (last._max.position ?? -1) + 1, note: d.note, courseId: d.course, daysPattern: d.days },
  });
  await prisma.historyLog.create({ data: { organizationId: orgId, entityType: "lead", entityId: lead.id, action: "created", details: { source: "public_form" }, actorName: "Ommaviy forma" } });
  return { ok: true };
}
