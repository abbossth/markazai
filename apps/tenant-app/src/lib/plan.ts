import { prisma } from "@markazai/db";
import { withinLimit } from "@markazai/types";
import { currentTenant } from "./tenant";

/** Reja limiti bo'yicha yangi yozuv qo'shish mumkinmi (0.4: max xodim/talaba). Tashkilot ma'lumoti RLS bilan cheklangan. */
export async function canAddWithinPlan(kind: "students" | "staff", adding = 1): Promise<boolean> {
  const tenant = await currentTenant();
  if (!tenant) return false;
  const limit = kind === "students" ? tenant.limits.maxStudents : tenant.limits.maxStaff;
  if (limit === null) return true;
  const current = kind === "students" ? await prisma.student.count() : await prisma.user.count();
  return withinLimit(current + adding - 1, limit);
}

/** Gamifikatsiya: tashkilot yoqqan VA reja/bayroq ruxsat bergan bo'lsa faol. */
export async function gamificationActive(settingEnabled: boolean | null | undefined): Promise<boolean> {
  if (!settingEnabled) return false;
  const tenant = await currentTenant();
  return !!tenant?.modules.includes("gamification");
}
