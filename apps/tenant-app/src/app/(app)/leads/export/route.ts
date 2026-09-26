import ExcelJS from "exceljs";
import { prisma } from "@markazai/db";
import { toISODate } from "@markazai/types";
import { canAccess } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session";

// exceljs Node API'lariga tayanadi.
export const runtime = "nodejs";

/** Faol (arxivlanmagan, talabaga aylanmagan) lidlar — Excel (.xlsx). Ustunlar importga mos: name, phone, source, section. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canAccess(user.roles, "leads")) return new Response("Forbidden", { status: 403 });

  const [leads, users] = await Promise.all([
    prisma.lead.findMany({
      where: { organizationId: user.orgId, convertedStudentId: null, archivedAt: null },
      orderBy: [{ columnId: "asc" }, { position: "asc" }],
      include: { column: { select: { name: true } }, list: { select: { name: true } }, tags: { include: { tag: { select: { name: true } } } } },
    }),
    prisma.user.findMany({ where: { organizationId: user.orgId }, select: { id: true, name: true } }),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Leads");
  ws.columns = [
    { header: "name", key: "name", width: 30 },
    { header: "phone", key: "phone", width: 16 },
    { header: "source", key: "source", width: 12 },
    { header: "section", key: "section", width: 32 },
    { header: "column", key: "column", width: 16 },
    { header: "tags", key: "tags", width: 22 },
    { header: "assignee", key: "assignee", width: 24 },
    { header: "note", key: "note", width: 30 },
    { header: "created", key: "created", width: 12 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const l of leads) {
    ws.addRow({
      name: l.name,
      phone: Number(l.phone),
      source: l.source?.toLowerCase() ?? "",
      section: l.list?.name ?? l.column.name,
      column: l.column.name,
      tags: l.tags.map((t) => t.tag.name).join(", "),
      assignee: l.assignedToId ? (userName.get(l.assignedToId) ?? "") : "",
      note: l.note ?? "",
      created: toISODate(l.createdAt),
    });
  }
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="leads-${toISODate(new Date())}.xlsx"`,
    },
  });
}
