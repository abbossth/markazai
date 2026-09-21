import { z } from "zod";
import { optDate, optText, optUuid } from "./common";
import { phoneSchema } from "./phone";

export const STUDENT_STATUSES = [
  "ACTIVE",
  "FROZEN",
  "NO_GROUP",
  "TRIAL",
  "LEFT_AFTER_TRIAL",
  "LEFT_ACTIVE_GROUP",
  "JOINED_THIS_MONTH",
] as const;
export type StudentStatusValue = (typeof STUDENT_STATUSES)[number];

export const studentSchema = z.object({
  name: z.string().trim().min(2, "nameRequired").max(120),
  phone: phoneSchema,
  // Bo'sh qatorlar tashlab yuboriladi, qolganlari telefon sifatida tekshiriladi.
  extraPhones: z.preprocess(
    (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.replace(/\D/g, "").length > 0) : v),
    z.array(phoneSchema).max(5),
  ),
  birthDate: optDate,
  gender: z
    .enum(["MALE", "FEMALE", ""])
    .optional()
    .transform((v) => (v ? v : undefined)),
  note: optText(1000),
  contactPerson: optText(120),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || z.email().safeParse(v).success, { message: "invalidEmail" }),
  telegram: optText(120),
  socialLink: optText(300),
  address: optText(300),
  externalId: optText(60),
  tagIds: z.array(z.uuid()),
  // Faqat yaratishda: guruhga qo'shish va boshlanish sanasi.
  groupId: optUuid,
  joinedAt: optDate,
});

export type StudentInput = z.input<typeof studentSchema>;
export type StudentOutput = z.output<typeof studentSchema>;

export const studentStatusSchema = z
  .object({
    status: z.enum(STUDENT_STATUSES),
    freezeReason: optText(300),
  })
  .refine((v) => v.status !== "FROZEN" || !!v.freezeReason, { path: ["freezeReason"], message: "freezeReasonRequired" });
