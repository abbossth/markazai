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

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id, name, organizationId, roles } = session.user;
  return { id, name: name ?? "", orgId: organizationId, roles };
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
