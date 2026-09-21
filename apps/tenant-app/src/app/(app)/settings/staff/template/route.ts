import ExcelJS from "exceljs";
import { getTranslations } from "next-intl/server";
import { ROLES } from "@markazai/types";
import { can } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

/** Import uchun namuna .xlsx: sarlavha, bitta namunaviy qator va ruxsat etilgan rollar ro'yxati. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!can(user.roles, "settings:manage")) return new Response("Forbidden", { status: 403 });

  const t = await getTranslations("settings.staff.import");
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(t("sheet"));
  sheet.columns = [
    { header: t("cols.name"), key: "name", width: 28 },
    { header: t("cols.phone"), key: "phone", width: 18 },
    { header: t("cols.roles"), key: "roles", width: 30 },
    { header: t("cols.position"), key: "position", width: 22 },
    { header: t("cols.email"), key: "email", width: 26 },
    { header: t("cols.password"), key: "password", width: 18 },
  ];
  sheet.addRow({ name: "Ali Valiyev", phone: "90 123 45 67", roles: "CASHIER, MARKETER", position: "Kassir", email: "ali@example.uz", password: "" });
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn(2).numFmt = "@";
  const roles = wb.addWorksheet(t("rolesSheet"));
  roles.columns = [{ header: t("cols.roles"), key: "r", width: 28 }];
  ROLES.forEach((r) => roles.addRow({ r }));
  roles.getRow(1).font = { bold: true };

  return new Response((await wb.xlsx.writeBuffer()) as ArrayBuffer, {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="markazai-staff-template.xlsx"', "Cache-Control": "no-store" },
  });
}
