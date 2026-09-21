import { z } from "zod";

/** Telefon: faqat raqamlar, +998 prefiksi bilan saqlanadi (masalan 998901234567). */
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .transform((v) => (v.length === 9 ? `998${v}` : v))
  .refine((v) => /^998\d{9}$/.test(v), { message: "invalidPhone" });
