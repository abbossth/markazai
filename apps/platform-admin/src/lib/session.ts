import { cache } from "react";
import { redirect } from "next/navigation";
import { platformPrisma } from "@markazai/db/platform";
import { auth } from "@/auth";

export type AdminRole = "OWNER" | "BILLING" | "SUPPORT";
export type Admin = { id: string; email: string; name: string; role: AdminRole };

const findAdmin = cache(async (id: string) => platformPrisma.platformAdmin.findUnique({ where: { id }, select: { id: true, email: true, name: true, role: true, isActive: true } }));

/** Amaldagi platforma xodimi: har so'rovda bazadan tekshiriladi (bloklangan/rol o'zgargan xodim darhol ta'sir oladi). */
export async function getAdmin(): Promise<Admin | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const a = await findAdmin(session.user.id);
  return a && a.isActive ? { id: a.id, email: a.email, name: a.name, role: a.role } : null;
}

/** Sahifa/action himoyasi. `roles` berilsa — faqat shu rollar (OWNER har doim ruxsatli). */
export async function requireAdmin(roles?: AdminRole[]): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  if (roles && admin.role !== "OWNER" && !roles.includes(admin.role)) redirect("/?forbidden=1");
  return admin;
}

export function can(admin: Admin, roles: AdminRole[]) {
  return admin.role === "OWNER" || roles.includes(admin.role);
}
