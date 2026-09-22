"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { platformPrisma } from "@markazai/db/platform";
import { PLAN_MODULES } from "@markazai/types";
import type { FormState } from "@/components/action-form";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/session";

const limit = z.union([z.literal(""), z.coerce.number().int().min(1).max(1_000_000)]).transform((v) => (v === "" ? null : v));
const planSchema = z.object({
  name: z.string().trim().min(2, "Nomi kamida 2 belgi").max(40),
  monthlyPrice: z.coerce.number("Narx kerak").int().min(0).max(1_000_000_000),
  maxStaff: limit,
  maxBranches: limit,
  maxStudents: limit,
});

/** Reja yaratish/yangilash (id berilsa yangilanadi). Limit bo'sh — cheksiz. Modullar — belgilangan katakchalar. */
export async function savePlan(id: string | null, _prev: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin(["BILLING"]);
  const parsed = planSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };
  const modules = PLAN_MODULES.filter((m) => data.get(`module_${m}`) === "on");
  const isActive = data.get("isActive") === "on";
  const values = { ...parsed.data, modules, isActive };
  try {
    const plan = id ? await platformPrisma.plan.update({ where: { id }, data: values }) : await platformPrisma.plan.create({ data: values });
    await audit(admin, id ? "plan.updated" : "plan.created", "plan", plan.id, { name: plan.name });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { error: "Bu nomli reja bor" };
    throw e;
  }
  revalidatePath("/plans");
  return { ok: true, message: "Saqlandi" };
}
