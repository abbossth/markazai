"use server";

import { revalidatePath } from "next/cache";
import { decryptSecret, encryptSecret, prisma } from "@markazai/db";
import {
  INTEGRATIONS,
  leadFormSchema,
  mergeIntegrationConfig,
  normalizeLeadFormFields,
  receiptTemplateSchema,
  type IntegrationKind,
  type LeadFormInput,
  type ReceiptTemplateInput,
} from "@markazai/types";
import { fieldErrorsOf, guardSettings, type Result } from "./guard";

// ───────────── Chek shabloni ─────────────

export async function saveReceiptTemplate(input: ReceiptTemplateInput): Promise<Result> {
  const user = await guardSettings();
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = receiptTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const d = parsed.data;
  const data = { receiptHeader: d.receiptHeader ?? null, receiptFooter: d.receiptFooter ?? null, receiptShowLogo: d.receiptShowLogo, receiptShowBranch: d.receiptShowBranch, receiptShowCashier: d.receiptShowCashier };
  await prisma.centerSettings.upsert({ where: { organizationId: user.orgId }, update: data, create: { organizationId: user.orgId, name: "Markazai", ...data } });
  revalidatePath("/settings/receipt");
  return { ok: true };
}

// ───────────── Lid forma ─────────────

export async function saveLeadForm(input: LeadFormInput): Promise<Result> {
  const user = await guardSettings();
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = leadFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const d = parsed.data;

  if (d.columnId && !(await prisma.leadColumn.findFirst({ where: { id: d.columnId, organizationId: user.orgId }, select: { id: true } }))) return { ok: false, error: "validation", fieldErrors: { columnId: "invalid" } };
  const data = {
    enabled: d.enabled,
    title: d.title,
    description: d.description ?? null,
    submitLabel: d.submitLabel,
    successMessage: d.successMessage,
    columnId: d.columnId ?? null,
    // Ism/telefon majburiyligi va noma'lum maydonlarni server ham qayta tekshiradi.
    fields: normalizeLeadFormFields(d.fields),
  };
  await prisma.leadForm.upsert({ where: { organizationId: user.orgId }, update: data, create: { organizationId: user.orgId, ...data } });
  revalidatePath("/settings/lead-form");
  revalidatePath("/apply");
  return { ok: true };
}

// ───────────── Integratsiyalar ─────────────

export async function saveIntegration(kind: string, enabled: boolean, incoming: Record<string, string>): Promise<Result> {
  const user = await guardSettings();
  if (!user) return { ok: false, error: "forbidden" };
  if (!(kind in INTEGRATIONS)) return { ok: false, error: "validation" };
  const k = kind as IntegrationKind;
  const def = INTEGRATIONS[k];

  const row = await prisma.integration.findUnique({ where: { organizationId_kind: { organizationId: user.orgId, kind: k } } });
  const stored = (row?.config ?? {}) as Record<string, string>;
  // Saqlangan sirlar ochiladi → yangi qiymatlar bilan birlashtiriladi → sirlar qayta shifrlanadi.
  const existing = Object.fromEntries(def.fields.map((f) => [f.key, stored[f.key] ? (f.secret ? safeDecrypt(stored[f.key]!) : stored[f.key]!) : ""]));
  const merged = mergeIntegrationConfig(k, existing, incoming);
  const config = Object.fromEntries(Object.entries(merged).map(([key, value]) => [key, def.fields.find((f) => f.key === key)?.secret ? encryptSecret(value) : value]));

  await prisma.integration.upsert({
    where: { organizationId_kind: { organizationId: user.orgId, kind: k } },
    update: { enabled, config },
    create: { organizationId: user.orgId, kind: k, enabled, config },
  });
  revalidatePath("/settings/integrations");
  return { ok: true };
}

function safeDecrypt(value: string): string {
  try {
    return decryptSecret(value);
  } catch {
    return ""; // kalit almashtirilgan — sir yo'qolgan hisoblanadi, foydalanuvchi qayta kiritadi
  }
}
