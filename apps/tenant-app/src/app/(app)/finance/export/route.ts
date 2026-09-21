import ExcelJS from "exceljs";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { canAccess } from "@/lib/permissions";
import type { RawSearchParams } from "@/lib/search-params";
import type { SessionUser } from "@/lib/session";
import { listDebtors, listExpenses, listPayments, listWithdrawals, resolveRange } from "../queries";

// exceljs Node API'lariga tayanadi.
export const runtime = "nodejs";

const EXPORTABLE = ["payments", "expenses", "withdrawals", "debtors"] as const;
type Exportable = (typeof EXPORTABLE)[number];

/** Excel (.xlsx) eksport: joriy tab va filtrlar bilan. Hujjat ruxsati — Moliya moduli. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const { id, name, organizationId, roles } = session.user;
  if (!canAccess(roles, "finance")) return new Response("Forbidden", { status: 403 });
  const user: SessionUser = { id, name: name ?? "", orgId: organizationId, roles };

  const url = new URL(request.url);
  const sp: RawSearchParams = Object.fromEntries(url.searchParams.entries());
  const tab = EXPORTABLE.find((x) => x === sp.tab) as Exportable | undefined;
  if (!tab) return new Response("Bad request", { status: 400 });

  const range = resolveRange(sp);
  const [tf, tc, tl, te] = await Promise.all([getTranslations("finance"), getTranslations("finance.columns"), getTranslations("finance.ledger"), getTranslations("enums")]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Markazai";
  const sheet = workbook.addWorksheet(tf(`tabs.${tab}`).slice(0, 31));

  type Col = { header: string; key: string; width: number; money?: boolean };
  let columns: Col[] = [];
  let rows: Record<string, string | number | null>[] = [];
  const iso = (d: string | null) => (d ? d.slice(0, 10) : "");

  if (tab === "payments") {
    const list = await listPayments(user, sp, range, { all: true });
    columns = [
      { header: tc("date"), key: "date", width: 12 },
      { header: tc("student"), key: "student", width: 28 },
      { header: tc("group"), key: "group", width: 14 },
      { header: tc("type"), key: "type", width: 12 },
      { header: tf("payment.method"), key: "method", width: 12 },
      { header: tc("amount"), key: "amount", width: 16, money: true },
      { header: tc("teacher"), key: "teacher", width: 24 },
      { header: tc("comment"), key: "comment", width: 36 },
      { header: tc("staff"), key: "staff", width: 22 },
    ];
    rows = list.rows.map((r) => ({
      date: iso(r.date),
      student: r.studentName,
      group: r.groupName ?? "",
      type: te(`paymentType.${r.type}`),
      method: r.type === "MANUAL" ? te(`paymentMethod.${r.method as "CASH"}`) : "",
      amount: r.amount,
      teacher: r.teacherName ?? "",
      comment: r.type === "SYSTEM" && r.lessonDate ? tf("lessonCharge", { date: iso(r.lessonDate) }) : (r.description ?? ""),
      staff: r.receivedByName ?? "",
    }));
  } else if (tab === "expenses") {
    const list = await listExpenses(user, sp, range, { all: true });
    columns = [
      { header: tl("date"), key: "date", width: 12 },
      { header: tl("category"), key: "category", width: 22 },
      { header: tl("amount"), key: "amount", width: 16, money: true },
      { header: tl("comment"), key: "comment", width: 40 },
      { header: tl("staff"), key: "staff", width: 22 },
    ];
    rows = list.rows.map((r) => ({ date: iso(r.date), category: r.category, amount: r.amount, comment: r.description ?? "", staff: r.createdByName ?? "" }));
  } else if (tab === "withdrawals") {
    const list = await listWithdrawals(user, sp, range, { all: true });
    columns = [
      { header: tl("date"), key: "date", width: 12 },
      { header: tl("amount"), key: "amount", width: 16, money: true },
      { header: tl("comment"), key: "comment", width: 40 },
      { header: tl("staff"), key: "staff", width: 22 },
    ];
    rows = list.rows.map((r) => ({ date: iso(r.date), amount: r.amount, comment: r.note ?? "", staff: r.createdByName ?? "" }));
  } else {
    const list = await listDebtors(user, sp, { all: true });
    columns = [
      { header: tl("student"), key: "student", width: 28 },
      { header: tl("phone"), key: "phone", width: 18 },
      { header: tl("group"), key: "group", width: 24 },
      { header: tl("debt"), key: "debt", width: 16, money: true },
      { header: tl("lastPayment"), key: "last", width: 14 },
    ];
    rows = list.rows.map((r) => ({ student: r.name, phone: `+${r.phone}`, group: r.groups.map((g) => g.name).join(", "), debt: r.balance, last: iso(r.lastPaymentDate) }));
  }

  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  columns.forEach((c, i) => {
    if (c.money) sheet.getColumn(i + 1).numFmt = "#,##0";
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `markazai-${tab}-${tab === "debtors" ? range.today : `${range.from}_${range.to}`}.xlsx`;
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
