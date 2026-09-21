import { z } from "zod";
import { optDate, optText, requiredDate } from "./common";

/** Faqat http(s) — javascript:/data: kabi sxemalar havola sifatida qabul qilinmaydi. */
export function isHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const httpUrl = z.string().trim().max(500).refine(isHttpUrl, { message: "invalidUrl" });
const optHttpUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || isHttpUrl(v), { message: "invalidUrl" });

export const onlineLessonSchema = z.object({
  title: z.string().trim().min(1, "required").max(120),
  url: httpUrl,
});
export type OnlineLessonInput = z.input<typeof onlineLessonSchema>;

export const discountSchema = z
  .object({
    studentId: z.uuid("required"),
    amount: z.number("required").int().min(1, "invalid"),
    fromDate: requiredDate,
    toDate: optDate,
    reason: optText(200),
  })
  .refine((v) => !v.toDate || v.toDate >= v.fromDate, { path: ["toDate"], message: "endBeforeStart" });
export type DiscountInput = z.input<typeof discountSchema>;

export const examSchema = z
  .object({
    name: z.string().trim().min(1, "required").max(120),
    date: requiredDate,
    durationMinutes: z.number("required").int().min(5, "invalid").max(600, "invalid"),
    maxScore: z.number("required").int().min(1, "invalid").max(1000, "invalid"),
    passScore: z.number("required").int().min(0, "invalid"),
    fileUrl: optHttpUrl,
  })
  .refine((v) => v.passScore <= v.maxScore, { path: ["passScore"], message: "passAboveMax" });
export type ExamInput = z.input<typeof examSchema>;

export const gradeScoreSchema = z.number().int().min(0).max(100);
