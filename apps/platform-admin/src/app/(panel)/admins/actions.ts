"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { platformPrisma } from "@markazai/db/platform";
import type { FormState } from "@/components/action-form";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/session";

const schema = z.object({
  name: z.string().trim().min(2, "Ism kamida 2 belgi").max(80),
  email: z.email("Email noto'g'ri").transform((v) => v.toLowerCase()),
  role: z.enum(["OWNER", "BILLING", "SUPPORT"]),
  password: z.union([z.literal(""), z.string().min(10, "Parol kamida 10 belgi").max(72)]),
});

/** Platforma xodimlarini faqat OWNER boshqaradi. Oxirgi faol OWNER'ni o'chirib/pasaytirib bo'lmaydi; o'zini bloklab bo'lmaydi. */
export async function saveAdmin(id: string | null, _prev: FormState, data: FormData): Promise<FormState> {
  const actor = await requireAdmin([]);
  if (actor.role !== "OWNER") return { error: "Faqat OWNER" };
  const parsed = schema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };
  const d = parsed.data;
  const isActive = data.get("isActive") === "on";
  if (!id && !d.password) return { error: "Yangi xodim uchun parol kerak" };

  if (id) {
    const target = await platformPrisma.platformAdmin.findUnique({ where: { id } });
    if (!target) return { error: "Topilmadi" };
    if (id === actor.id && !isActive) return { error: "O'zingizni bloklab bo'lmaydi" };
    const losesOwner = target.role === "OWNER" && target.isActive && (d.role !== "OWNER" || !isActive);
    if (losesOwner && (await platformPrisma.platformAdmin.count({ where: { role: "OWNER", isActive: true, id: { not: id } } })) === 0) return { error: "Oxirgi faol OWNER'ni o'zgartirib bo'lmaydi" };
  }
  try {
    const passwordHash = d.password ? await bcrypt.hash(d.password, 10) : undefined;
    const values = { name: d.name, email: d.email, role: d.role, isActive, ...(passwordHash && { passwordHash }) };
    const saved = id ? await platformPrisma.platformAdmin.update({ where: { id }, data: values }) : await platformPrisma.platformAdmin.create({ data: { ...values, passwordHash: passwordHash! } });
    await audit(actor, id ? "admin.updated" : "admin.created", "platform_admin", saved.id, { email: saved.email, role: saved.role, isActive });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { error: "Bu email band" };
    throw e;
  }
  revalidatePath("/admins");
  return { ok: true, message: "Saqlandi" };
}
