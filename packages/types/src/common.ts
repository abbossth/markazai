import { z } from "zod";

/** Bo'sh satrni undefined'ga aylantiradigan ixtiyoriy matn. */
export const optText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** YYYY-MM-DD yoki bo'sh. */
export const optDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "invalidDate" });

export const requiredDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "invalidDate" });

export const optUuid = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || z.uuid().safeParse(v).success, { message: "invalid" });

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };
