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

export type Permission =
  | "students:write"
  | "students:delete"
  | "groups:write"
  | "groups:delete"
  | "attendance:write"
  | "leads:write"
  | "leads:delete"
  | "leads:configure";

const ADMIN_PERMISSIONS: Permission[] = [
  "students:write",
  "students:delete",
  "groups:write",
  "groups:delete",
  "attendance:write",
  "leads:write",
  "leads:delete",
  "leads:configure",
];

const PERMISSIONS: Record<Role, Permission[]> = {
  CEO: ADMIN_PERMISSIONS,
  BRANCH_DIRECTOR: ADMIN_PERMISSIONS,
  ADMINISTRATOR: ADMIN_PERMISSIONS,
  ADMINISTRATOR2: ADMIN_PERMISSIONS,
  LIMITED_ADMINISTRATOR: ["students:write", "groups:write", "attendance:write", "leads:write"],
  INTERN_ADMINISTRATOR: ["students:write", "attendance:write", "leads:write"],
  CASHIER: [],
  MARKETER: ["leads:write"],
  // O'qituvchi faqat o'z guruhlarida davomat/baho qo'ya oladi (server tomonida egalik tekshiriladi).
  TEACHER: ["attendance:write"],
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
