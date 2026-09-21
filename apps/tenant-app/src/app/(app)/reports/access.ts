import { REPORT_KEYS, type ReportKey } from "@markazai/types";
import { canAccess, isTeacherOnly, type AppModule } from "@/lib/permissions";

// Har bir hisobot tegishli modul ruxsatini talab qiladi (marketer — faqat lid/konversiya/jurnal).
const REQUIRES: Record<ReportKey, AppModule> = {
  rating: "students",
  attendance: "groups",
  conversion: "leads",
  leads: "leads",
  churn: "students",
  logs: "leads",
  coins: "students",
};

/**
 * Foydalanuvchi ko'ra oladigan hisobotlar. Faqat-o'qituvchi: reyting, davomat va coin (o'z guruhlari).
 * "coins" faqat gamifikatsiya yoqilgan bo'lsa.
 */
export function visibleReports(roles: string[], gamification = false): ReportKey[] {
  return REPORT_KEYS.filter((k) => canAccess(roles, REQUIRES[k]) && !(isTeacherOnly(roles) && (k === "churn" || k === "logs")) && (k !== "coins" || gamification));
}
