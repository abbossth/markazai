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
};

/** Foydalanuvchi ko'ra oladigan hisobotlar. Faqat-o'qituvchi: faqat reyting va davomat (o'z guruhlari). */
export function visibleReports(roles: string[]): ReportKey[] {
  return REPORT_KEYS.filter((k) => canAccess(roles, REQUIRES[k]) && !(isTeacherOnly(roles) && (k === "churn" || k === "logs")));
}
