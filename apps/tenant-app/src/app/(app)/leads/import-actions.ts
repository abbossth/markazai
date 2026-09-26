"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { ensureDefaultLeadColumns, prisma } from "@markazai/db";
import { LEAD_SOURCES, phoneSchema, type LeadSourceValue } from "@markazai/types";
import { requirePermission } from "@/lib/session";

export type ImportResult = { ok: boolean; error?: "forbidden" | "badFile" | "tooBig"; created: number; skipped: number; failed: number; errors: string[] };

const MAX_ROWS = 1000;
const MAX_BYTES = 2 * 1024 * 1024;
const empty = (error?: ImportResult["error"]): ImportResult => ({ ok: false, error, created: 0, skipped: 0, failed: 0, errors: [] });

const HEADER_KEYS: Record<"name" | "phone" | "source" | "section", string[]> = {
  name: ["name", "ism", "fio", "имя"],
  phone: ["phone", "telefon", "tel", "телефон"],
  source: ["source", "manba", "источник"],
  section: ["section", "bo'lim", "bolim", "list", "ro'yxat", "раздел"],
};

// Matn -> LeadSource: qiymatning o'zi, qisqartma yoki keng tarqalgan nomlar.
const SOURCE_ALIASES: Record<string, LeadSourceValue> = {
  sayt: "WEBSITE", site: "WEBSITE", tavsiya: "REFERRAL", "o'zi kelgan": "WALK_IN", "walk-in": "WALK_IN", walkin: "WALK_IN", telefon: "PHONE", boshqa: "OTHER",
};
function parseSource(text: string): LeadSourceValue | undefined {
  const v = text.trim().toLowerCase();
  if (!v) return undefined;
  return LEAD_SOURCES.find((s) => s.value.toLowerCase() === v || s.abbr.toLowerCase() === v)?.value ?? SOURCE_ALIASES[v] ?? "OTHER";
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text !== undefined) return String(o.text);
    if (o.result !== undefined) return String(o.result);
    return "";
  }
  return String(v).trim();
}

/** Excel (.xlsx) dan lidlarni import qiladi: name, phone, source, section. Takroriy telefonlar o'tkazib yuboriladi. */
export async function importLeads(formData: FormData): Promise<ImportResult> {
  let user;
  try {
    user = await requirePermission("leads:write");
  } catch {
    return empty("forbidden");
  }
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) return empty("badFile");
  if (file.size > MAX_BYTES) return empty("tooBig");

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ExcelJS.Buffer);
  } catch {
    return empty("badFile");
  }
  const ws = wb.worksheets[0];
  if (!ws) return empty("badFile");

  const raw: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => raw.push((row.values as ExcelJS.CellValue[]).slice(1).map(cellText)));

  // Sarlavha bor bo'lsa ustunlar nomi bo'yicha, bo'lmasa tartib bo'yicha (name, phone, source, section).
  const first = (raw[0] ?? []).map((c) => c.toLowerCase());
  const idx = { name: 0, phone: 1, source: 2, section: 3 };
  let dataStart = 0;
  if (first.some((c) => Object.values(HEADER_KEYS).flat().includes(c))) {
    dataStart = 1;
    for (const k of Object.keys(HEADER_KEYS) as (keyof typeof HEADER_KEYS)[]) {
      const i = first.findIndex((c) => HEADER_KEYS[k].includes(c));
      idx[k] = i;
    }
  }
  const rows = raw.slice(dataStart);
  if (rows.length > MAX_ROWS) return empty("tooBig");

  const columns = await ensureDefaultLeadColumns(prisma, user.orgId);
  const firstColumn = columns[0]!;
  const lists = await prisma.leadList.findMany({ where: { organizationId: user.orgId } });
  const listByName = new Map(lists.map((l) => [l.name.toLowerCase(), l]));
  const columnByName = new Map(columns.map((c) => [c.name.toLowerCase(), c]));

  const parsed: { line: number; name: string; phone: string; source?: LeadSourceValue; section: string }[] = [];
  const errors: string[] = [];
  let failed = 0;
  rows.forEach((r, i) => {
    const line = i + 1 + dataStart;
    const name = (idx.name >= 0 ? r[idx.name] : "")?.trim() ?? "";
    const phone = phoneSchema.safeParse(idx.phone >= 0 ? (r[idx.phone] ?? "") : "");
    if (name.length < 2 || !phone.success) {
      failed++;
      if (errors.length < 10) errors.push(`${line}: ${name.length < 2 ? "name" : "phone"}`);
      return;
    }
    parsed.push({ line, name: name.slice(0, 120), phone: phone.data, source: idx.source >= 0 ? parseSource(r[idx.source] ?? "") : undefined, section: idx.section >= 0 ? (r[idx.section] ?? "").trim() : "" });
  });

  // Takroriy: faylning o'zida va bazadagi (arxivlanmagan lid yoki talaba) telefonlar.
  const phones = [...new Set(parsed.map((p) => p.phone))];
  const [dupLeads, dupStudents] = await Promise.all([
    prisma.lead.findMany({ where: { organizationId: user.orgId, phone: { in: phones }, convertedStudentId: null, archivedAt: null }, select: { phone: true } }),
    prisma.student.findMany({ where: { organizationId: user.orgId, phone: { in: phones } }, select: { phone: true } }),
  ]);
  const taken = new Set([...dupLeads, ...dupStudents].map((d) => d.phone));

  // Har konteyner (ustun/ro'yxat) uchun keyingi tartib raqami.
  const maxes = await prisma.lead.groupBy({ by: ["columnId", "listId"], where: { organizationId: user.orgId, convertedStudentId: null, archivedAt: null }, _max: { position: true } });
  const next = new Map(maxes.map((m) => [`${m.columnId}|${m.listId ?? ""}`, (m._max.position ?? -1) + 1]));
  let listPosition = ((await prisma.leadList.aggregate({ where: { organizationId: user.orgId, columnId: firstColumn.id }, _max: { position: true } }))._max.position ?? -1) + 1;

  const data: { organizationId: string; name: string; phone: string; source?: LeadSourceValue; columnId: string; listId: string | null; position: number }[] = [];
  let skipped = 0;
  for (const p of parsed) {
    if (taken.has(p.phone)) {
      skipped++;
      continue;
    }
    taken.add(p.phone);

    let columnId = firstColumn.id;
    let listId: string | null = null;
    const key = p.section.toLowerCase();
    if (key) {
      const list = listByName.get(key);
      const col = columnByName.get(key);
      if (list) {
        columnId = list.columnId;
        listId = list.id;
      } else if (col) columnId = col.id;
      else {
        // Bo'lim topilmadi: birinchi ustunda shu nomli ro'yxat yaratiladi.
        const created = await prisma.leadList.create({ data: { organizationId: user.orgId, columnId: firstColumn.id, name: p.section.slice(0, 40), position: listPosition++ } });
        listByName.set(key, created);
        listId = created.id;
      }
    }
    const pk = `${columnId}|${listId ?? ""}`;
    const position = next.get(pk) ?? 0;
    next.set(pk, position + 1);
    data.push({ organizationId: user.orgId, name: p.name, phone: p.phone, source: p.source, columnId, listId, position });
  }

  if (data.length > 0) await prisma.lead.createMany({ data });
  revalidatePath("/leads");
  return { ok: true, created: data.length, skipped, failed, errors };
}
