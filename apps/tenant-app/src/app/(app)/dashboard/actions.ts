"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@markazai/db";
import { sanitizeLayout, type ActionResult } from "@markazai/types";
import { can } from "@/lib/permissions";
import { requireModule, requireUser } from "@/lib/session";
import { allowedWidgetIds, loadScheduleGroups } from "./queries";

/**
 * Dashboard tartibini saqlaydi. Kirish qayta tozalanadi (noma'lum/ruxsatsiz vidjetlar va yaroqsiz o'lchamlar
 * tashlanadi), shuning uchun mijoz ruxsat etilmagan vidjetni "yoqib" ololmaydi.
 */
export async function saveDashboardLayout(widgets: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const clean = sanitizeLayout(widgets, allowedWidgetIds(user));
  await prisma.dashboardLayout.upsert({
    where: { userId: user.id },
    update: { widgets: clean },
    create: { organizationId: user.orgId, userId: user.id, widgets: clean },
  });
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Tartibni sukut bo'yicha holatga qaytaradi. */
export async function resetDashboardLayout(): Promise<ActionResult> {
  const user = await requireUser();
  await prisma.dashboardLayout.deleteMany({ where: { userId: user.id, organizationId: user.orgId } });
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * "Markaz yuklamasi" vidjeti uchun sig'im — xonalar ma'lumotidan avtomatik emas, qo'lda kiritiladi (bir
 * markaz bir vaqtda nechta o'quvchini o'qita olishini xodim o'zi biladi). `null` — yuklama ko'rsatilmaydi.
 */
export async function saveCenterCapacity(capacity: number | null): Promise<ActionResult> {
  const user = await requireUser();
  if (!can(user.roles, "settings:manage")) return { ok: false, error: "forbidden" };
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 0 || capacity > 1_000_000)) return { ok: false, error: "validation" };

  await prisma.centerSettings.upsert({
    where: { organizationId: user.orgId },
    update: { capacity },
    create: { organizationId: user.orgId, name: "", capacity },
  });
  revalidatePath("/dashboard");
  return { ok: true };
}

/** O'ng chetdagi "Dars jadvali" paneli ochilganda yuklanadi (har sahifada oldindan yuklanmaydi). */
export async function loadScheduleDrawerData() {
  const user = await requireModule("groups");
  return loadScheduleGroups(user);
}
