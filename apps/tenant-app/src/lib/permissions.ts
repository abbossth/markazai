import type { Role } from "@markazai/types";

export type AppModule = "dashboard" | "leads" | "teachers" | "groups" | "students" | "finance" | "reports" | "settings";

const ALL: AppModule[] = ["dashboard", "leads", "teachers", "groups", "students", "finance", "reports", "settings"];

// Bir nechta rol berilgan bo'lsa, ruxsatlar birlashtiriladi.
const MODULE_ACCESS: Record<Role, AppModule[]> = {
  CEO: ALL,
  BRANCH_DIRECTOR: ALL,
  ADMINISTRATOR: ALL,
  ADMINISTRATOR2: ["dashboard", "leads", "teachers", "groups", "students", "finance", "reports"],
  LIMITED_ADMINISTRATOR: ["dashboard", "leads", "groups", "students"],
  INTERN_ADMINISTRATOR: ["dashboard", "leads", "groups", "students"],
  CASHIER: ["dashboard", "students", "finance"],
  MARKETER: ["dashboard", "leads", "reports"],
  TEACHER: ["dashboard", "groups", "students"],
};

export type Permission = "students:write" | "students:delete" | "groups:write" | "groups:delete";

const PERMISSIONS: Record<Role, Permission[]> = {
  CEO: ["students:write", "students:delete", "groups:write", "groups:delete"],
  BRANCH_DIRECTOR: ["students:write", "students:delete", "groups:write", "groups:delete"],
  ADMINISTRATOR: ["students:write", "students:delete", "groups:write", "groups:delete"],
  ADMINISTRATOR2: ["students:write", "students:delete", "groups:write", "groups:delete"],
  LIMITED_ADMINISTRATOR: ["students:write", "groups:write"],
  INTERN_ADMINISTRATOR: ["students:write"],
  CASHIER: [],
  MARKETER: [],
  TEACHER: [],
};

export function canAccess(roles: string[], module: AppModule) {
  return roles.some((r) => MODULE_ACCESS[r as Role]?.includes(module));
}

export function can(roles: string[], permission: Permission) {
  return roles.some((r) => PERMISSIONS[r as Role]?.includes(permission));
}

/** Faqat TEACHER roli bor (boshqa rolsiz) foydalanuvchi faqat o'z guruhlarini ko'radi. */
export function isTeacherOnly(roles: string[]) {
  return roles.length > 0 && roles.every((r) => r === "TEACHER");
}
