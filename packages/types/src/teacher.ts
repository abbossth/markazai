import { z } from "zod";
import { optDate, optText, requiredDate } from "./common";
import { phoneSchema } from "./phone";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Bo'sh/NaN → undefined, aks holda butun son diapazonda. */
const optInt = (min: number, max: number) =>
  z
    .number()
    .int("invalid")
    .min(min, "invalid")
    .max(max, "invalid")
    .optional()
    .or(z.nan().transform(() => undefined));

const optTime = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || HHMM.test(v), { message: "invalidTime" });

const workDaysSchema = z.array(z.number().int().min(1).max(7)).transform((d) => [...new Set(d)].sort((a, b) => a - b));

/** Ish jadvali va oylik — ham forma ichida, ham "Ustozlar ish jadvali" qatorida ishlatiladi. */
export const teacherScheduleSchema = z
  .object({
    workDays: workDaysSchema,
    workStart: optTime,
    workEnd: optTime,
    fixedSalary: optInt(0, 1_000_000_000),
    workStartDate: optDate,
  })
  .refine((v) => !v.workStart || !v.workEnd || v.workEnd > v.workStart, { path: ["workEnd"], message: "endBeforeStart" });
export type TeacherScheduleInput = z.input<typeof teacherScheduleSchema>;

export const teacherSchema = z
  .object({
    name: z.string().trim().min(2, "nameRequired").max(120),
    phone: phoneSchema,
    birthDate: optDate,
    gender: z
      .enum(["MALE", "FEMALE", ""])
      .optional()
      .transform((v) => (v ? v : undefined)),
    branchIds: z.array(z.uuid()),
    salaryType: z.enum(["PERCENT", "FIXED"]),
    percent: optInt(0, 100),
    fixedSalary: optInt(0, 1_000_000_000),
    workDays: workDaysSchema,
    workStart: optTime,
    workEnd: optTime,
    workStartDate: optDate,
    // Ixtiyoriy: berilsa, o'qituvchiga tizimga kirish (TEACHER roli) yaratiladi/yangilanadi.
    password: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => v === undefined || v.length >= 8, { message: "passwordShort" }),
  })
  .refine((v) => v.salaryType !== "PERCENT" || v.percent !== undefined, { path: ["percent"], message: "required" })
  .refine((v) => v.salaryType !== "FIXED" || (v.fixedSalary !== undefined && v.fixedSalary > 0), { path: ["fixedSalary"], message: "required" })
  .refine((v) => !v.workStart || !v.workEnd || v.workEnd > v.workStart, { path: ["workEnd"], message: "endBeforeStart" });
export type TeacherInput = z.input<typeof teacherSchema>;
export type TeacherOutput = z.output<typeof teacherSchema>;

export const salaryPaymentSchema = z.object({
  teacherId: z.uuid("required"),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "invalid"),
  amount: z.number("required").int("invalid").min(1, "invalid").max(1_000_000_000, "invalid"),
  date: requiredDate,
  note: optText(300),
});
export type SalaryPaymentInput = z.input<typeof salaryPaymentSchema>;
