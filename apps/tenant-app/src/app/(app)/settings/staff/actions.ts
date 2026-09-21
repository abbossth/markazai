"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { prisma } from "@markazai/db";
import { MIN_PASSWORD, canManageRoles, parseStaffImport, staffSchema, type StaffInput } from "@markazai/types";
import { fieldErrorsOf, guardSettings, type Result } from "../guard";

const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_IMPORT_ROWS = 500;

/** O'qib bo'ladigan, noaniq belgilarsiz (0/O, 1/l) tasodifiy parol. */
function generatePassword(length = 10) {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Faol CEO'lar orasida `exceptId` dan boshqa kimdir bormi (oxirgi CEO'ni yo'qotmaslik uchun). */
async function hasOtherActiveCeo(orgId: string, exceptId: string) {
  return (await prisma.user.count({ where: { organizationId: orgId, isActive: true, roles: { has: "CEO" }, id: { not: exceptId } } })) > 0;
}

async function validBranchIds(orgId: string, ids: string[]) {
  if (!ids.length) return [];
  return (await prisma.branch.findMany({ where: { organizationId: orgId, id: { in: ids } }, select: { id: true } })).map((b) => b.id);
}

export async function saveStaff(id: string | null, input: StaffInput): Promise<Result<{ id: string }>> {
  const actor = await guardSettings();
  if (!actor) return { ok: false, error: "forbidden" };
  const parsed = staffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const d = parsed.data;

  const existing = id ? await prisma.user.findFirst({ where: { id, organizationId: actor.orgId }, select: { id: true, roles: true, isActive: true } }) : null;
  if (id && !existing) return { ok: false, error: "notFound" };
  if (!id && !d.password) return { ok: false, error: "validation", fieldErrors: { password: "required" } };

  // Huquq oshirib yuborishdan himoya: yuqori rollarni faqat CEO/Filial direktori beradi va o'zgartiradi.
  if (!canManageRoles(actor.roles, d.roles) || (existing && !canManageRoles(actor.roles, existing.roles))) return { ok: false, error: "forbidden" };
  if (existing && existing.id === actor.id && !d.isActive) return { ok: false, error: "cannotDeactivateSelf" };
  if (existing && existing.roles.includes("CEO") && existing.isActive && (!d.roles.includes("CEO") || !d.isActive) && !(await hasOtherActiveCeo(actor.orgId, existing.id))) return { ok: false, error: "lastCeo" };

  const clash = await prisma.user.findFirst({ where: { organizationId: actor.orgId, phone: d.phone, ...(existing && { id: { not: existing.id } }) }, select: { id: true } });
  if (clash) return { ok: false, error: "validation", fieldErrors: { phone: "phoneTaken" } };

  const branchIds = await validBranchIds(actor.orgId, d.branchIds);
  const passwordHash = d.password ? await bcrypt.hash(d.password, 10) : undefined;
  const base = { name: d.name, phone: d.phone, roles: d.roles, position: d.position ?? null, email: d.email ?? null, isActive: d.isActive, ...(passwordHash && { passwordHash }) };

  const saved = await prisma.$transaction(async (tx) => {
    const user = existing
      ? await tx.user.update({ where: { id: existing.id }, data: base, select: { id: true } })
      : await tx.user.create({ data: { ...base, organizationId: actor.orgId, passwordHash: passwordHash! }, select: { id: true } });
    await tx.userBranch.deleteMany({ where: { userId: user.id } });
    if (branchIds.length) await tx.userBranch.createMany({ data: branchIds.map((branchId) => ({ organizationId: actor.orgId, userId: user.id, branchId })) });
    return user;
  });
  revalidatePath("/settings/staff");
  return { ok: true, id: saved.id };
}

export async function deleteStaff(id: string): Promise<Result> {
  const actor = await guardSettings();
  if (!actor) return { ok: false, error: "forbidden" };
  if (id === actor.id) return { ok: false, error: "cannotDeleteSelf" };
  const target = await prisma.user.findFirst({ where: { id, organizationId: actor.orgId }, select: { id: true, roles: true, isActive: true } });
  if (!target) return { ok: false, error: "notFound" };
  if (!canManageRoles(actor.roles, target.roles)) return { ok: false, error: "forbidden" };
  if (target.roles.includes("CEO") && target.isActive && !(await hasOtherActiveCeo(actor.orgId, id))) return { ok: false, error: "lastCeo" };

  await prisma.$transaction([
    // O'qituvchi yozuvi saqlanadi (davomat, ish haqi tarixi), faqat tizimga kirish bog'lanishi uziladi.
    prisma.teacher.updateMany({ where: { organizationId: actor.orgId, userId: id }, data: { userId: null } }),
    prisma.user.delete({ where: { id } }),
  ]);
  revalidatePath("/settings/staff");
  return { ok: true };
}

/** Yangi tasodifiy parol o'rnatadi va bir marta qaytaradi (bazada faqat hash saqlanadi). */
export async function resetStaffPassword(id: string): Promise<Result<{ password: string }>> {
  const actor = await guardSettings();
  if (!actor) return { ok: false, error: "forbidden" };
  const target = await prisma.user.findFirst({ where: { id, organizationId: actor.orgId }, select: { roles: true } });
  if (!target) return { ok: false, error: "notFound" };
  if (!canManageRoles(actor.roles, target.roles)) return { ok: false, error: "forbidden" };
  const password = generatePassword();
  await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  return { ok: true, password };
}

export type ImportResult = {
  created: { name: string; phone: string; password: string }[];
  errors: { row: number; field: string }[];
};

/** Excel'dan ommaviy import: yaroqli qatorlar yaratiladi, xatolar qator raqami bilan qaytariladi (bo'sh parol — tasodifiy). */
export async function importStaff(formData: FormData): Promise<Result<ImportResult>> {
  const actor = await guardSettings();
  if (!actor) return { ok: false, error: "forbidden" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "noFile" };
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, error: "tooLarge" };

  let rows: string[][] = [];
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet) return { ok: false, error: "invalidFile" };
    sheet.eachRow({ includeEmpty: false }, (row, n) => {
      if (n === 1 || rows.length >= MAX_IMPORT_ROWS) return; // 1-qator — sarlavha
      const cell = (i: number) => {
        const v = row.getCell(i).value;
        // Hujayra formula/rich text bo'lishi mumkin — faqat matn ko'rinishini olamiz.
        return v === null || v === undefined ? "" : typeof v === "object" ? String((v as { text?: string; result?: unknown }).text ?? (v as { result?: unknown }).result ?? "") : String(v);
      };
      rows[n - 2] = [1, 2, 3, 4, 5, 6].map(cell);
    });
    rows = Array.from(rows, (r) => r ?? []); // siyrak indekslarni to'ldirish (bo'sh qatorlar)
  } catch {
    return { ok: false, error: "invalidFile" };
  }

  const { valid, errors } = parseStaffImport(rows);
  const existing = new Set((await prisma.user.findMany({ where: { organizationId: actor.orgId, phone: { in: valid.map((v) => v.phone) } }, select: { phone: true } })).map((u) => u.phone));
  const created: ImportResult["created"] = [];
  const outErrors: ImportResult["errors"] = errors.map((e) => ({ row: e.row, field: e.field }));

  for (const v of valid) {
    if (existing.has(v.phone)) {
      outErrors.push({ row: v.row, field: "phoneTaken" });
      continue;
    }
    if (!canManageRoles(actor.roles, v.roles)) {
      outErrors.push({ row: v.row, field: "forbidden" });
      continue;
    }
    const password = v.password && v.password.length >= MIN_PASSWORD ? v.password : generatePassword();
    await prisma.user.create({ data: { organizationId: actor.orgId, name: v.name, phone: v.phone, roles: v.roles, position: v.position ?? null, email: v.email ?? null, passwordHash: await bcrypt.hash(password, 10) } });
    created.push({ name: v.name, phone: v.phone, password });
  }
  revalidatePath("/settings/staff");
  return { ok: true, created, errors: outErrors.sort((a, b) => a.row - b.row) };
}
