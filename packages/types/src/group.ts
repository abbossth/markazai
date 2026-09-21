import { z } from "zod";
import { optDate, optUuid, requiredDate } from "./common";
import { DAYS_PATTERNS } from "./schedule";

export const GROUP_STATUSES = ["ACTIVE", "ARCHIVED", "COMPLETED"] as const;
export type GroupStatusValue = (typeof GROUP_STATUSES)[number];

export const groupSchema = z
  .object({
    name: z.string().trim().min(1, "required").max(60),
    courseId: z.uuid("required"),
    teacherId: z.uuid("required"),
    roomId: optUuid,
    days: z.enum(DAYS_PATTERNS),
    // 1 = Dushanba ... 7 = Yakshanba; faqat days = OTHER bo'lganda ishlatiladi.
    customDays: z.array(z.number().int().min(1).max(7)),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "invalidTime"),
    durationMinutes: z.number("required").int().min(15, "invalid").max(600, "invalid"),
    startDate: requiredDate,
    endDate: optDate,
    price: z.number("required").int().min(0, "invalid"),
    tagIds: z.array(z.uuid()),
  })
  .refine((v) => v.days !== "OTHER" || v.customDays.length > 0, { path: ["customDays"], message: "daysRequired" })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { path: ["endDate"], message: "endBeforeStart" });

export type GroupInput = z.input<typeof groupSchema>;
export type GroupOutput = z.output<typeof groupSchema>;
