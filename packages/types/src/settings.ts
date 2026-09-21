import { z } from "zod";
import { optText } from "./common";
import { phoneSchema } from "./phone";
import { ROLES } from "./roles";

// ───────────── Umumiy ─────────────

const HEX = /^#[0-9a-fA-F]{6}$/;
export const hexColor = z.string().regex(HEX, { message: "invalidColor" });
const optColor = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || HEX.test(v), { message: "invalidColor" });

export const LESSON_START_STEPS = [5, 10, 15, 30, 60] as const;
export const LOCALES = ["uz", "ru", "en"] as const;
export const THEMES = ["light", "dark", "system"] as const;

/** Yuklangan fayl havolasi (faqat o'z /api/files/ yo'li) — tashqi URL'ga ruxsat yo'q. */
const fileUrl = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || /^\/api\/files\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp|gif)$/.test(v), { message: "invalid" });

const optPhone = z
  .string()
  .optional()
  .transform((v) => (v && v.replace(/\D/g, "") ? v : undefined))
  .pipe(phoneSchema.optional());

export const generalSettingsSchema = z.object({
  name: z.string().trim().min(2, "required").max(80),
  phone: optPhone,
  address: optText(200),
  workingHours: optText(60),
  telegram: optText(80),
  instagram: optText(80),
  lessonStartStep: z.number().int().refine((v) => (LESSON_START_STEPS as readonly number[]).includes(v), { message: "invalid" }),
  returningStudentRule: optText(500),
  brandColor: optColor,
  defaultTheme: z.enum(THEMES),
  locales: z.array(z.enum(LOCALES)).min(1, "required"),
  loginWelcome: optText(200),
  offerText: optText(5000),
  logoUrl: fileUrl,
  loginBannerUrl: fileUrl,
  gamificationEnabled: z.boolean(),
});
export type GeneralSettingsInput = z.input<typeof generalSettingsSchema>;
export type GeneralSettingsOutput = z.output<typeof generalSettingsSchema>;

/** Brend rangi ustidagi matn rangi: WCAG nisbiy yorqinlik bo'yicha oq yoki qora (kontrast ≥ 4.5 ga intiladi). */
export function readableForeground(hex: string): "#ffffff" | "#111111" {
  const n = Number.parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Oq bilan kontrast 1.05/(lum+0.05), #111111 bilan — (lum+0.05)/0.0552 (uning yorqinligi 0.0052). Kattasi tanlanadi.
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.0552 ? "#ffffff" : "#111111";
}

// ───────────── Xodimlar ─────────────

export const MIN_PASSWORD = 8;

const optEmail = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || z.email().safeParse(v).success, { message: "invalidEmail" });

export const staffSchema = z.object({
  name: z.string().trim().min(2, "nameRequired").max(120),
  phone: phoneSchema,
  roles: z.array(z.enum(ROLES)).min(1, "rolesRequired"),
  position: optText(80),
  email: optEmail,
  // Yaratishda majburiy (server tekshiradi); tahrirlashda bo'sh — o'zgarmaydi.
  password: z
    .string()
    .max(72, "invalid")
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || v.length >= MIN_PASSWORD, { message: "passwordShort" }),
  branchIds: z.array(z.uuid()),
  isActive: z.boolean(),
});
export type StaffInput = z.input<typeof staffSchema>;
export type StaffOutput = z.output<typeof staffSchema>;

/** Yuqori ruxsatli rollar: ularni faqat CEO/Filial direktori berishi va o'zgartirishi mumkin (huquq oshirib yuborishning oldini olish). */
export const PRIVILEGED_ROLES = ["CEO", "BRANCH_DIRECTOR", "ADMINISTRATOR"] as const;

export function canManageRoles(actorRoles: string[], targetRoles: string[]): boolean {
  if (actorRoles.some((r) => r === "CEO" || r === "BRANCH_DIRECTOR")) return true;
  return !targetRoles.some((r) => (PRIVILEGED_ROLES as readonly string[]).includes(r));
}

export type StaffImportRow = { row: number; name: string; phone: string; roles: (typeof ROLES)[number][]; position?: string; email?: string; password?: string };
export type StaffImportError = { row: number; field: "name" | "phone" | "roles" | "email" | "password" | "duplicate" };

/**
 * Excel'dan xodim import qilish. Ustunlar tartibi: Ism, Telefon, Rollar (vergul bilan), Lavozim, Email, Parol.
 * `rows` — sarlavhasiz qatorlar (1-qator = jadvalning 2-qatori). Bo'sh qatorlar tashlab ketiladi.
 * Parol bo'sh bo'lsa server tasodifiy parol yaratadi (natijada ko'rsatiladi).
 */
export function parseStaffImport(rows: string[][]): { valid: StaffImportRow[]; errors: StaffImportError[] } {
  const valid: StaffImportRow[] = [];
  const errors: StaffImportError[] = [];
  const seen = new Set<string>();

  rows.forEach((raw, i) => {
    const cells = raw.map((c) => (c ?? "").toString().trim());
    if (cells.every((c) => c === "")) return;
    const row = i + 2; // jadvaldagi qator raqami (1-qator — sarlavha)
    const [name = "", phoneRaw = "", rolesRaw = "", position = "", email = "", password = ""] = cells;

    const parsed = staffSchema.safeParse({
      name,
      phone: phoneRaw,
      roles: rolesRaw
        .split(/[,;]/)
        .map((r) => r.trim().toUpperCase().replace(/[\s-]+/g, "_"))
        .filter(Boolean),
      position,
      email,
      password,
      branchIds: [],
      isActive: true,
    });
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      errors.push({ row, field: field === "phone" || field === "roles" || field === "email" || field === "password" ? field : "name" });
      return;
    }
    if (seen.has(parsed.data.phone)) {
      errors.push({ row, field: "duplicate" });
      return;
    }
    seen.add(parsed.data.phone);
    valid.push({ row, name: parsed.data.name, phone: parsed.data.phone, roles: parsed.data.roles, position: parsed.data.position, email: parsed.data.email, password: parsed.data.password });
  });
  return { valid, errors };
}

// ───────────── Kurs, xona, teg, dam olish kunlari ─────────────

export const courseSchema = z.object({
  name: z.string().trim().min(2, "required").max(80),
  price: z.number("required").int("invalid").min(0, "invalid").max(1_000_000_000, "invalid"),
  durationMonths: z.number("required").int("invalid").min(1, "invalid").max(36, "invalid"),
  color: hexColor,
});
export type CourseInput = z.input<typeof courseSchema>;

export const roomSchema = z.object({
  name: z.string().trim().min(1, "required").max(40),
  capacity: z.number("required").int("invalid").min(1, "invalid").max(500, "invalid"),
});
export type RoomInput = z.input<typeof roomSchema>;

export const tagSchema = z.object({
  name: z.string().trim().min(1, "required").max(30),
  color: optColor,
});
export type TagInput = z.input<typeof tagSchema>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_HOLIDAY_RANGE_DAYS = 31;

export const holidaySchema = z
  .object({
    from: z.string().regex(ISO_DATE, { message: "invalidDate" }),
    to: z.string().regex(ISO_DATE, { message: "invalidDate" }),
    name: z.string().trim().min(1, "required").max(80),
  })
  .refine((v) => v.to >= v.from, { path: ["to"], message: "endBeforeStart" })
  .refine((v) => holidayDates(v.from, v.to).length <= MAX_HOLIDAY_RANGE_DAYS, { path: ["to"], message: "rangeTooLong" });
export type HolidayInput = z.input<typeof holidaySchema>;

/** [from, to] oralig'idagi barcha sanalar (ikkala chegara kiradi). */
export function holidayDates(from: string, to: string): string[] {
  const out: string[] = [];
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  // Cheksiz sikldan himoya: chegaradan bir kun ortiq bo'lsa to'xtaymiz.
  for (let t = new Date(`${from}T00:00:00.000Z`).getTime(); t <= end && out.length <= MAX_HOLIDAY_RANGE_DAYS; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

// ───────────── Chek shabloni ─────────────

export const receiptTemplateSchema = z.object({
  receiptHeader: optText(200),
  receiptFooter: optText(300),
  receiptShowLogo: z.boolean(),
  receiptShowBranch: z.boolean(),
  receiptShowCashier: z.boolean(),
});
export type ReceiptTemplateInput = z.input<typeof receiptTemplateSchema>;

// ───────────── Lid forma konstruktori ─────────────

export const LEAD_FORM_FIELD_KEYS = ["name", "phone", "course", "days", "note"] as const;
export type LeadFormFieldKey = (typeof LEAD_FORM_FIELD_KEYS)[number];
/** Ism va telefon doim yoqilgan va majburiy — aks holda lidni aniqlab/bog'lab bo'lmaydi. */
const LOCKED_FIELDS: LeadFormFieldKey[] = ["name", "phone"];

export const leadFormFieldSchema = z.object({
  key: z.enum(LEAD_FORM_FIELD_KEYS),
  enabled: z.boolean(),
  required: z.boolean(),
  label: optText(60),
});
export type LeadFormField = z.output<typeof leadFormFieldSchema>;

export const leadFormSchema = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(1, "required").max(100),
  description: optText(300),
  submitLabel: z.string().trim().min(1, "required").max(40),
  successMessage: z.string().trim().min(1, "required").max(200),
  columnId: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || z.uuid().safeParse(v).success, { message: "invalid" }),
  fields: z.array(leadFormFieldSchema),
});
export type LeadFormInput = z.input<typeof leadFormSchema>;
export type LeadFormOutput = z.output<typeof leadFormSchema>;

export function defaultLeadFormFields(): LeadFormField[] {
  return LEAD_FORM_FIELD_KEYS.map((key) => ({ key, enabled: key !== "days", required: LOCKED_FIELDS.includes(key), label: undefined }));
}

/** Saqlangan/kelgan maydonlarni tartibga soladi: noma'lumlar tashlanadi, takrorlar birlashadi, ism/telefon majburiy. */
export function normalizeLeadFormFields(raw: unknown): LeadFormField[] {
  const list = Array.isArray(raw) ? raw : [];
  return defaultLeadFormFields().map((def) => {
    const found = list.map((x) => leadFormFieldSchema.safeParse(x)).find((r) => r.success && r.data.key === def.key);
    const f = found?.success ? found.data : def;
    if (LOCKED_FIELDS.includes(def.key)) return { ...f, enabled: true, required: true };
    return { ...f, required: f.enabled && f.required };
  });
}

/** Ommaviy forma yuborilganda tekshiriladigan sxema (yoqilgan maydonlar bo'yicha quriladi). */
export function buildLeadSubmissionSchema(fields: LeadFormField[]) {
  const on = new Map(fields.filter((f) => f.enabled).map((f) => [f.key, f]));
  const text = (key: LeadFormFieldKey, max: number) => {
    const req = on.get(key)?.required;
    if (!on.has(key)) return z.string().optional().transform(() => undefined);
    return req ? z.string().trim().min(1, "required").max(max) : z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));
  };
  return z.object({
    name: z.string().trim().min(2, "nameRequired").max(120),
    phone: phoneSchema,
    course: (() => {
      if (!on.has("course")) return z.string().optional().transform(() => undefined);
      const base = z.uuid("required");
      return on.get("course")?.required ? base : z.union([base, z.literal("")]).optional().transform((v) => (v ? v : undefined));
    })(),
    days: (() => {
      if (!on.has("days")) return z.string().optional().transform(() => undefined);
      const base = z.enum(["ODD", "EVEN", "EVERY_DAY", "WEEKEND"]);
      return on.get("days")?.required ? base : z.union([base, z.literal("")]).optional().transform((v) => (v ? v : undefined));
    })(),
    note: text("note", 500),
    // Spam tuzog'i: haqiqiy foydalanuvchi ko'rmaydigan maydon — to'ldirilgan bo'lsa yuborish rad etiladi.
    website: z.string().max(0).optional(),
  });
}

// ───────────── Integratsiyalar ─────────────

export type IntegrationField = { key: string; secret: boolean };
export const INTEGRATIONS = {
  PAYME: { group: "payment", fields: [{ key: "merchantId", secret: false }, { key: "key", secret: true }] },
  CLICK: { group: "payment", fields: [{ key: "serviceId", secret: false }, { key: "merchantId", secret: false }, { key: "secretKey", secret: true }] },
  UZUM: { group: "payment", fields: [{ key: "merchantId", secret: false }, { key: "apiKey", secret: true }] },
  FACEBOOK: { group: "marketing", fields: [{ key: "pageId", secret: false }, { key: "accessToken", secret: true }] },
  AMOCRM: { group: "marketing", fields: [{ key: "subdomain", secret: false }, { key: "accessToken", secret: true }] },
  TELEGRAM: { group: "marketing", fields: [{ key: "botUsername", secret: false }, { key: "botToken", secret: true }] },
  WORKLY: { group: "staff", fields: [{ key: "companyId", secret: false }, { key: "apiKey", secret: true }] },
} as const satisfies Record<string, { group: string; fields: readonly IntegrationField[] }>;
export type IntegrationKind = keyof typeof INTEGRATIONS;
export const INTEGRATION_KINDS = Object.keys(INTEGRATIONS) as IntegrationKind[];

/** Sirni ko'rsatishda maskalaydi: faqat oxirgi 4 belgi ("••••1234"); qisqa sir — to'liq yashiriladi. */
export function maskSecret(value: string): string {
  if (!value) return "";
  return value.length <= 8 ? "••••" : `••••${value.slice(-4)}`;
}

/**
 * Yangi kiritilgan qiymatlarni saqlangan konfiguratsiya bilan birlashtiradi.
 * Sir maydoni bo'sh yuborilsa — eski qiymat saqlanadi (forma sirni ko'rsatmaydi, shuning uchun har safar qayta kiritish shart emas).
 * Oddiy maydon bo'sh yuborilsa — tozalanadi. Faqat ma'lum kalitlar olinadi.
 */
export function mergeIntegrationConfig(kind: IntegrationKind, existing: Record<string, string>, incoming: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of INTEGRATIONS[kind].fields) {
    const next = (incoming[f.key] ?? "").trim();
    const value = f.secret && next === "" ? (existing[f.key] ?? "") : next;
    if (value !== "") out[f.key] = value.slice(0, 500);
  }
  return out;
}
