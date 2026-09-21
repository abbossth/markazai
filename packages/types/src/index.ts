import { z } from "zod";

/** 1–8-bosqichlarda ishlatiladigan yagona (statik) tenant. 9-bosqichda subdomen orqali aniqlanadi. */
export const DEFAULT_ORGANIZATION_ID =
  process.env.DEFAULT_ORGANIZATION_ID ?? "00000000-0000-4000-8000-000000000001";

export const ROLES = [
  "CEO",
  "ADMINISTRATOR",
  "LIMITED_ADMINISTRATOR",
  "ADMINISTRATOR2",
  "INTERN_ADMINISTRATOR",
  "CASHIER",
  "MARKETER",
  "BRANCH_DIRECTOR",
  "TEACHER",
] as const;
export type Role = (typeof ROLES)[number];

/** Telefon: faqat raqamlar, +998 prefiksi bilan saqlanadi (masalan 998901234567). */
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .transform((v) => (v.length === 9 ? `998${v}` : v))
  .refine((v) => /^998\d{9}$/.test(v), { message: "invalidPhone" });

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, "required"),
});
export type LoginInput = z.input<typeof loginSchema>;
export type LoginOutput = z.output<typeof loginSchema>;
