import ExcelJS from "exceljs";
import { canAccess } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

/** Import uchun namuna fayl: name, phone, source (instagram/telegram/…), section (ro'yxat nomi). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canAccess(user.roles, "leads")) return new Response("Forbidden", { status: 403 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Leads");
  ws.columns = [
    { header: "name", key: "name", width: 28 },
    { header: "phone", key: "phone", width: 16 },
    { header: "source", key: "source", width: 14 },
    { header: "section", key: "section", width: 28 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.addRow({ name: "Aliyev Vali", phone: 998901234567, source: "telegram", section: "Ingliz tili" });
  ws.addRow({ name: "Karimova Zilola", phone: 998931112233, source: "instagram", section: "" });
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="leads-sample.xlsx"' },
  });
}
