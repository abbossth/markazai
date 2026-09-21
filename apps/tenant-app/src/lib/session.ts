import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@markazai/db";
import { auth } from "@/auth";
import { canAccess, can, isTeacherOnly, type AppModule, type Permission } from "./permissions";

export type SessionUser = {
  id: string;
  name: string;
  orgId: string;
  roles: string[];
  /** TEACHER roli bo'lsa — bog'langan Teacher yozuvi ID'si (faqat o'z guruhlarini ko'rish uchun). */
  teacherId?: string;
};

// Sessiya JWT'da rollar eskirib qolishi mumkin (rol o'zgartirilgan yoki xodim o'chirilgan/bloklangan bo'lsa),
// shuning uchun har so'rovda foydalanuvchi bazadan tekshiriladi (birlamchi kalit bo'yicha, so'rov ichida keshlanadi).
const findAccount = cache(async (id: string) => prisma.user.findUnique({ where: { id }, select: { name: true, roles: true, organizationId: true, isActive: true } }));

/** Amaldagi foydalanuvchi; sessiya yo'q, xodim o'chirilgan yoki bloklangan bo'lsa — null. Rollar bazadagi joriy qiymat. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  const account = await findAccount(session.user.id);
  if (!account || !account.isActive) return null;
  return { id: session.user.id, name: account.name, orgId: account.organizationId, roles: account.roles };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  // "expired" — proksi bu holatda /login'ni ochiq qoldiradi (aks holda yaroqsiz cookie bilan cheksiz yo'naltirish bo'lardi).
  if (!user) redirect("/login?expired=1");
  return user;
}

/** Sahifa/route'ni modul bo'yicha himoyalaydi. Ruxsat bo'lmasa — bosh sahifaga. */
export async function requireModule(module: AppModule): Promise<SessionUser> {
  const user = await requireUser();
  if (!canAccess(user.roles, module)) redirect("/dashboard");

  if (isTeacherOnly(user.roles)) {
    const teacher = await prisma.teacher.findFirst({
      where: { organizationId: user.orgId, userId: user.id },
      select: { id: true },
    });
    user.teacherId = teacher?.id;
  }
  return user;
}

/** Server action'lar uchun: ruxsat yo'q bo'lsa xatolik tashlaydi. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.roles, permission)) throw new Error("forbidden");
  return user;
}
