import { describe, expect, it } from "vitest";
import {
  buildLeadSubmissionSchema,
  canManageRoles,
  courseSchema,
  defaultLeadFormFields,
  generalSettingsSchema,
  holidayDates,
  holidaySchema,
  maskSecret,
  mergeIntegrationConfig,
  normalizeLeadFormFields,
  parseStaffImport,
  readableForeground,
  staffSchema,
} from "./settings";

const general = { name: "Markaz", lessonStartStep: 30, defaultTheme: "system", locales: ["uz"], gamificationEnabled: false } as const;

describe("generalSettingsSchema", () => {
  it("minimal to'g'ri kirish", () => {
    expect(generalSettingsSchema.safeParse(general).success).toBe(true);
  });
  it("noto'g'ri qadam va rang rad etiladi", () => {
    expect(generalSettingsSchema.safeParse({ ...general, lessonStartStep: 7 }).success).toBe(false);
    expect(generalSettingsSchema.safeParse({ ...general, brandColor: "red" }).success).toBe(false);
    expect(generalSettingsSchema.safeParse({ ...general, brandColor: "#2563eb" }).success).toBe(true);
  });
  it("kamida bitta til kerak", () => {
    expect(generalSettingsSchema.safeParse({ ...general, locales: [] }).success).toBe(false);
  });
  it("tashqi URL logotip sifatida rad etiladi, o'z fayl yo'li qabul qilinadi", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(generalSettingsSchema.safeParse({ ...general, logoUrl: "https://evil.example/x.png" }).success).toBe(false);
    expect(generalSettingsSchema.safeParse({ ...general, logoUrl: `/api/files/${id}/${id}.png` }).success).toBe(true);
    expect(generalSettingsSchema.safeParse({ ...general, logoUrl: `/api/files/${id}/../../etc.png` }).success).toBe(false);
  });
  it("telefon normallashtiriladi, bo'sh bo'lsa undefined", () => {
    const ok = generalSettingsSchema.parse({ ...general, phone: "+998 90 123 45 67" });
    expect(ok.phone).toBe("998901234567");
    expect(generalSettingsSchema.parse({ ...general, phone: "" }).phone).toBeUndefined();
  });
});

describe("readableForeground", () => {
  it("to'q fonda oq, och fonda qora matn", () => {
    expect(readableForeground("#1e3a8a")).toBe("#ffffff");
    expect(readableForeground("#fde047")).toBe("#111111");
    expect(readableForeground("#000000")).toBe("#ffffff");
    expect(readableForeground("#ffffff")).toBe("#111111");
  });
});

describe("staffSchema", () => {
  const base = { name: "Ali Valiyev", phone: "901234567", roles: ["CASHIER"], branchIds: [], isActive: true } as const;
  it("telefon 998 bilan normallashtiriladi", () => {
    expect(staffSchema.parse(base).phone).toBe("998901234567");
  });
  it("kamida bitta rol", () => {
    expect(staffSchema.safeParse({ ...base, roles: [] }).success).toBe(false);
  });
  it("parol: bo'sh — ruxsat (o'zgarmaydi), 8 belgidan qisqa — rad", () => {
    expect(staffSchema.parse({ ...base, password: "" }).password).toBeUndefined();
    expect(staffSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(staffSchema.safeParse({ ...base, password: "longenough1" }).success).toBe(true);
  });
  it("noto'g'ri email rad etiladi", () => {
    expect(staffSchema.safeParse({ ...base, email: "abc" }).success).toBe(false);
    expect(staffSchema.safeParse({ ...base, email: "a@b.uz" }).success).toBe(true);
  });
});

describe("canManageRoles", () => {
  it("CEO va Filial direktori hammasini boshqaradi", () => {
    expect(canManageRoles(["CEO"], ["CEO"])).toBe(true);
    expect(canManageRoles(["BRANCH_DIRECTOR"], ["ADMINISTRATOR"])).toBe(true);
  });
  it("Administrator yuqori ruxsatli rollarni bermaydi va o'zgartirmaydi", () => {
    expect(canManageRoles(["ADMINISTRATOR"], ["CEO"])).toBe(false);
    expect(canManageRoles(["ADMINISTRATOR"], ["CASHIER", "ADMINISTRATOR"])).toBe(false);
    expect(canManageRoles(["ADMINISTRATOR"], ["CASHIER", "MARKETER"])).toBe(true);
  });
});

describe("parseStaffImport", () => {
  it("to'g'ri qatorlar va xatolar", () => {
    const { valid, errors } = parseStaffImport([
      ["Ali Valiyev", "90 123 45 67", "cashier, marketer", "Kassir", "ali@x.uz", "parol12345"],
      ["", "", "", "", "", ""],
      ["X", "123", "CASHIER"],
      ["Vali Aliyev", "901112233", "teacher"],
      ["Sardor", "901234567", "CASHIER"],
      ["Bir Ikki", "902223344", "NOROLE"],
    ]);
    expect(valid.map((v) => v.phone)).toEqual(["998901234567", "998901112233"]);
    expect(valid[0]).toMatchObject({ roles: ["CASHIER", "MARKETER"], position: "Kassir", email: "ali@x.uz", password: "parol12345" });
    expect(errors).toEqual([
      { row: 4, field: "name" },
      { row: 6, field: "duplicate" },
      { row: 7, field: "roles" },
    ]);
  });
  it("rol nomi bo'shliq/defis bilan ham qabul qilinadi", () => {
    expect(parseStaffImport([["Aziz Karim", "901234567", "branch director"]]).valid[0]?.roles).toEqual(["BRANCH_DIRECTOR"]);
  });
  it("bo'sh kirish", () => {
    expect(parseStaffImport([])).toEqual({ valid: [], errors: [] });
  });
});

describe("courseSchema", () => {
  it("chegaralar", () => {
    const ok = { name: "Ingliz tili", price: 500000, durationMonths: 6, color: "#2563eb" };
    expect(courseSchema.safeParse(ok).success).toBe(true);
    expect(courseSchema.safeParse({ ...ok, price: -1 }).success).toBe(false);
    expect(courseSchema.safeParse({ ...ok, durationMonths: 0 }).success).toBe(false);
    expect(courseSchema.safeParse({ ...ok, color: "blue" }).success).toBe(false);
  });
});

describe("holidays", () => {
  it("holidayDates chegaralarni qo'shadi", () => {
    expect(holidayDates("2026-03-20", "2026-03-22")).toEqual(["2026-03-20", "2026-03-21", "2026-03-22"]);
    expect(holidayDates("2026-03-20", "2026-03-20")).toEqual(["2026-03-20"]);
  });
  it("teskari oraliq va juda uzun oraliq rad etiladi", () => {
    expect(holidaySchema.safeParse({ from: "2026-03-22", to: "2026-03-20", name: "Navro'z" }).success).toBe(false);
    expect(holidaySchema.safeParse({ from: "2026-01-01", to: "2026-12-31", name: "Yil" }).success).toBe(false);
    expect(holidaySchema.safeParse({ from: "2026-03-20", to: "2026-03-22", name: "Navro'z" }).success).toBe(true);
  });
});

describe("lead form fields", () => {
  it("ism va telefon doim yoqilgan va majburiy", () => {
    const f = normalizeLeadFormFields([
      { key: "name", enabled: false, required: false },
      { key: "phone", enabled: false, required: false },
    ]);
    expect(f.find((x) => x.key === "name")).toMatchObject({ enabled: true, required: true });
    expect(f.find((x) => x.key === "phone")).toMatchObject({ enabled: true, required: true });
  });
  it("noma'lum kalit tashlanadi, o'chirilgan maydon majburiy bo'lolmaydi", () => {
    const f = normalizeLeadFormFields([{ key: "evil", enabled: true, required: true }, { key: "note", enabled: false, required: true }]);
    expect(f.map((x) => x.key)).toEqual(["name", "phone", "course", "days", "note"]);
    expect(f.find((x) => x.key === "note")?.required).toBe(false);
  });
  it("noto'g'ri kirish — sukut bo'yicha maydonlar", () => {
    expect(normalizeLeadFormFields("x")).toEqual(normalizeLeadFormFields(defaultLeadFormFields()));
  });
});

describe("buildLeadSubmissionSchema", () => {
  const course = "22222222-2222-4222-8222-222222222222";
  it("faqat ism va telefon bo'lganda qo'shimcha maydonlar e'tiborga olinmaydi", () => {
    const schema = buildLeadSubmissionSchema(normalizeLeadFormFields([{ key: "course", enabled: false, required: false }]));
    const out = schema.parse({ name: "Ali", phone: "901234567", course, note: "salom" });
    expect(out.course).toBeUndefined();
    expect(out.phone).toBe("998901234567");
  });
  it("majburiy kurs bo'sh bo'lsa rad etiladi", () => {
    const schema = buildLeadSubmissionSchema(normalizeLeadFormFields([{ key: "course", enabled: true, required: true }]));
    expect(schema.safeParse({ name: "Ali", phone: "901234567" }).success).toBe(false);
    expect(schema.safeParse({ name: "Ali", phone: "901234567", course }).success).toBe(true);
  });
  it("honeypot to'ldirilgan bo'lsa rad etiladi", () => {
    const schema = buildLeadSubmissionSchema(defaultLeadFormFields());
    expect(schema.safeParse({ name: "Ali", phone: "901234567", website: "spam.com" }).success).toBe(false);
    expect(schema.safeParse({ name: "Ali", phone: "901234567", website: "" }).success).toBe(true);
  });
  it("ixtiyoriy kurs bo'sh satr bilan yuborilsa undefined", () => {
    const schema = buildLeadSubmissionSchema(defaultLeadFormFields());
    expect(schema.parse({ name: "Ali", phone: "901234567", course: "" }).course).toBeUndefined();
  });
});

describe("integrations", () => {
  it("maskSecret", () => {
    expect(maskSecret("")).toBe("");
    expect(maskSecret("abc")).toBe("••••");
    expect(maskSecret("abcdefgh12345678")).toBe("••••5678");
  });
  it("sir bo'sh yuborilsa eskisi saqlanadi, oddiy maydon bo'sh bo'lsa tozalanadi", () => {
    const merged = mergeIntegrationConfig("PAYME", { merchantId: "M1", key: "old-secret-key" }, { merchantId: "", key: "" });
    expect(merged).toEqual({ key: "old-secret-key" });
  });
  it("yangi sir eskisini almashtiradi; noma'lum kalitlar olinmaydi", () => {
    const merged = mergeIntegrationConfig("CLICK", { serviceId: "1", secretKey: "old" }, { serviceId: "2", merchantId: "9", secretKey: "new-secret", evil: "x" } as Record<string, string>);
    expect(merged).toEqual({ serviceId: "2", merchantId: "9", secretKey: "new-secret" });
  });
});
