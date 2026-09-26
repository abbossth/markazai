"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { platformPrisma } from "@markazai/db/platform";
import { BILLING_CYCLES, isChargeMode, ORG_STATUSES, PLAN_MODULES, cyclePrice, phoneSchema, slugSchema, subscriptionEndDate, type OrgStatus } from "@markazai/types";
import type { FormState } from "@/components/action-form";
import { audit } from "@/lib/audit";
import { fromISO, todayISO } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { tenantApi } from "@/lib/tenant-api";

const createSchema = z.object({
  name: z.string().trim().min(2, "Nomi kamida 2 belgi").max(80),
  slug: slugSchema,
  contactName: z.string().trim().min(2, "Rahbar ismi kerak").max(120),
  contactPhone: phoneSchema,
  contactEmail: z.union([z.email(), z.literal("")]).optional(),
  planId: z.union([z.uuid(), z.literal("")]).optional(),
  months: z.coerce.number().int().refine((v) => (BILLING_CYCLES as readonly number[]).includes(v)).optional(),
});

const SLUG_ERRORS: Record<string, string> = { invalidSlug: "Slug: 3–32 belgi, kichik lotin harflari, raqam va defis", reservedSlug: "Bu slug band qilingan (tizim nomi)", invalidPhone: "Telefon raqami noto'g'ri" };
const firstError = (issues: { message: string }[]) => SLUG_ERRORS[issues[0]?.message ?? ""] ?? issues[0]?.message ?? "Ma'lumot noto'g'ri";

/**
 * Yangi tashkilot (0.5): platforma bazasida yozuv → tenant-app'ning imzolangan ichki API'si orqali boshlang'ich
 * sozlamalar va CEO akkaunti yaratiladi (bu ilova tenant bazasiga ulanmaydi). Provisioning muvaffaqiyatsiz bo'lsa yozuv bekor qilinadi.
 */
export async function createOrganization(_prev: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin(["SUPPORT"]);
  const parsed = createSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: firstError(parsed.error.issues) };
  const d = parsed.data;

  if (await platformPrisma.organization.findUnique({ where: { slug: d.slug } })) return { error: "Bu slug allaqachon ishlatilgan" };
  const plan = d.planId ? await platformPrisma.plan.findUnique({ where: { id: d.planId } }) : null;

  const id = randomUUID();
  await platformPrisma.organization.create({ data: { id, name: d.name, slug: d.slug, status: plan ? "ACTIVE" : "TRIAL", contactName: d.contactName, contactPhone: d.contactPhone, contactEmail: d.contactEmail || null } });

  const res = await tenantApi<{ ceoPhone: string; ceoPassword: string }>("/api/internal/provision", { orgId: id, name: d.name, ceoName: d.contactName, ceoPhone: d.contactPhone });
  if (!res.ok) {
    await platformPrisma.organization.delete({ where: { id } }); // yarim qolgan tashkilot qoldirilmaydi
    await audit(admin, "organization.provision_failed", "organization", id, { slug: d.slug, error: res.error });
    return { error: `Provisioning muvaffaqiyatsiz: ${res.error}` };
  }

  if (plan) {
    const months = d.months ?? 1;
    const start = todayISO();
    await platformPrisma.subscription.create({ data: { organizationId: id, planId: plan.id, billingCycle: months, price: cyclePrice(plan.monthlyPrice, months), startDate: fromISO(start), endDate: fromISO(subscriptionEndDate(start, months)) } });
  }
  await audit(admin, "organization.created", "organization", id, { slug: d.slug, plan: plan?.name ?? null });
  revalidatePath("/organizations");
  const host = `${d.slug}.${process.env.ROOT_DOMAIN ?? "localhost"}`;
  return { ok: true, message: `Tashkilot yaratildi: ${host}\nCEO login: +${res.data.ceoPhone}\nBir martalik parol: ${res.data.ceoPassword}\n(Parol boshqa ko'rsatilmaydi — mijozga xavfsiz yo'l bilan yuboring.)` };
}

export async function setStatus(orgId: string, status: OrgStatus, _prev: FormState): Promise<FormState> {
  const admin = await requireAdmin(["BILLING"]);
  if (!(ORG_STATUSES as readonly string[]).includes(status)) return { error: "Holat noto'g'ri" };
  const org = await platformPrisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return { error: "Tashkilot topilmadi" };
  await platformPrisma.organization.update({ where: { id: orgId }, data: { status } });
  await audit(admin, "organization.status", "organization", orgId, { from: org.status, to: status });
  revalidatePath(`/organizations/${orgId}`);
  revalidatePath("/organizations");
  return { ok: true, message: "Holat yangilandi (tenant-app'da ≤30 soniyada kuchga kiradi)" };
}

/** Tashkilotning talabalardan pul yechish rejimi (footer'da "To'lov rejimi" sifatida ko'rinadi). */
export async function setChargeMode(orgId: string, _prev: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin(["BILLING", "SUPPORT"]);
  const mode = data.get("chargeMode");
  if (!isChargeMode(mode)) return { error: "To'lov rejimi noto'g'ri" };
  const org = await platformPrisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return { error: "Tashkilot topilmadi" };
  await platformPrisma.organization.update({ where: { id: orgId }, data: { chargeMode: mode } });
  await audit(admin, "organization.chargeMode", "organization", orgId, { from: org.chargeMode, to: mode });
  revalidatePath(`/organizations/${orgId}`);
  return { ok: true, message: "Saqlandi (tenant-app'da ≤30 soniyada ko'rinadi)" };
}

const paymentSchema = z.object({
  months: z.coerce.number().int().refine((v) => (BILLING_CYCLES as readonly number[]).includes(v), "Davr noto'g'ri"),
  planId: z.uuid("Reja tanlang"),
  amount: z.union([z.literal(""), z.coerce.number().int().min(0).max(1_000_000_000)]).optional(),
  method: z.string().trim().min(1).max(30),
  note: z.string().trim().max(200).optional(),
});

/**
 * "To'landi, +N oy": obuna uzaytiriladi (hali tugamagan bo'lsa tugash sanasidan, aks holda bugundan) va to'lov yozuvi yaratiladi.
 * Summa bo'sh bo'lsa reja narxi × oylar − uzoq muddat chegirmasi. Tashkilot TRIAL bo'lsa ACTIVE bo'ladi (to'xtatilgan bo'lsa o'zgarmaydi).
 */
export async function recordPayment(orgId: string, _prev: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin(["BILLING"]);
  const parsed = paymentSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };
  const d = parsed.data;
  const [org, plan] = await Promise.all([platformPrisma.organization.findUnique({ where: { id: orgId } }), platformPrisma.plan.findUnique({ where: { id: d.planId } })]);
  if (!org || !plan) return { error: "Tashkilot yoki reja topilmadi" };

  const today = todayISO();
  const current = await platformPrisma.subscription.findFirst({ where: { organizationId: orgId, status: "ACTIVE" }, orderBy: { endDate: "desc" } });
  const currentEnd = current ? current.endDate.toISOString().slice(0, 10) : null;
  const start = currentEnd && currentEnd >= today && current?.planId === plan.id ? currentEnd : today;
  const price = d.amount === "" || d.amount === undefined ? cyclePrice(plan.monthlyPrice, d.months) : d.amount;
  const endDate = subscriptionEndDate(start, d.months);

  const sub = await platformPrisma.$transaction(async (tx) => {
    // Boshqa rejaga o'tilsa eski obuna yopiladi; shu rejada bo'lsa davom ettiriladi.
    if (current && current.planId !== plan.id) await tx.subscription.update({ where: { id: current.id }, data: { status: "CANCELLED", endDate: fromISO(today) } });
    const s =
      current && current.planId === plan.id
        ? await tx.subscription.update({ where: { id: current.id }, data: { endDate: fromISO(subscriptionEndDate(currentEnd! >= today ? currentEnd! : today, d.months)), billingCycle: d.months, price } })
        : await tx.subscription.create({ data: { organizationId: orgId, planId: plan.id, billingCycle: d.months, price, startDate: fromISO(start), endDate: fromISO(endDate) } });
    await tx.paymentRecord.create({ data: { subscriptionId: s.id, amount: price, paidAt: fromISO(today), method: d.method, confirmedBy: admin.email, note: d.note || null } });
    if (org.status === "TRIAL") await tx.organization.update({ where: { id: orgId }, data: { status: "ACTIVE" } });
    return s;
  });
  await audit(admin, "subscription.payment", "organization", orgId, { plan: plan.name, months: d.months, amount: price, endDate: sub.endDate.toISOString().slice(0, 10) });
  revalidatePath(`/organizations/${orgId}`);
  revalidatePath("/");
  return { ok: true, message: `Qabul qilindi. Obuna ${sub.endDate.toISOString().slice(0, 10)} gacha.` };
}

export async function setFlag(orgId: string, module: string, _prev: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin(["BILLING"]);
  if (!(PLAN_MODULES as readonly string[]).includes(module)) return { error: "Modul noma'lum" };
  const value = String(data.get("value") ?? "plan");
  if (value === "plan") await platformPrisma.featureFlag.deleteMany({ where: { organizationId: orgId, module } });
  else await platformPrisma.featureFlag.upsert({ where: { organizationId_module: { organizationId: orgId, module } }, update: { enabled: value === "on" }, create: { organizationId: orgId, module, enabled: value === "on" } });
  await audit(admin, "flag.set", "organization", orgId, { module, value });
  revalidatePath(`/organizations/${orgId}`);
  return { ok: true, message: "Saqlandi" };
}

/** Agregat foydalanish ko'rsatkichlarini tenant-app'dan (imzolangan ichki API) olib, snapshot sifatida saqlaydi. */
export async function refreshUsage(orgId: string, _prev: FormState): Promise<FormState> {
  const admin = await requireAdmin(["SUPPORT"]);
  const res = await tenantApi<{ studentsCount: number; staffCount: number; groupsCount: number }>("/api/internal/usage", { orgId });
  if (!res.ok) return { error: `Olib bo'lmadi: ${res.error}` };
  await platformPrisma.usageMetric.create({ data: { organizationId: orgId, ...res.data } });
  await audit(admin, "usage.refresh", "organization", orgId);
  revalidatePath(`/organizations/${orgId}`);
  revalidatePath("/");
  return { ok: true, message: `Talabalar: ${res.data.studentsCount}, xodimlar: ${res.data.staffCount}, guruhlar: ${res.data.groupsCount}` };
}
