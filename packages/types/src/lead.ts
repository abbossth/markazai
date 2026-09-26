import { z } from "zod";
import { optText, optUuid, requiredDate } from "./common";
import { phoneSchema } from "./phone";
import { DAYS_PATTERNS } from "./schedule";

export const LEAD_SOURCES = [
  { value: "INSTAGRAM", abbr: "IG" },
  { value: "TELEGRAM", abbr: "TG" },
  { value: "FACEBOOK", abbr: "FB" },
  { value: "WEBSITE", abbr: "WEB" },
  { value: "REFERRAL", abbr: "REF" },
  { value: "WALK_IN", abbr: "WLK" },
  { value: "PHONE", abbr: "TEL" },
  { value: "OTHER", abbr: "OTH" },
] as const;
export type LeadSourceValue = (typeof LEAD_SOURCES)[number]["value"];
const SOURCE_VALUES = LEAD_SOURCES.map((s) => s.value) as [LeadSourceValue, ...LeadSourceValue[]];

export const CALL_OUTCOMES = ["ANSWERED", "NO_ANSWER", "BUSY", "WRONG_NUMBER"] as const;

export const leadSchema = z.object({
  name: z.string().trim().min(2, "nameRequired").max(120),
  phone: phoneSchema,
  source: z
    .enum([...SOURCE_VALUES, ""])
    .optional()
    .transform((v) => (v ? v : undefined)),
  columnId: z.uuid("required"),
  listId: optUuid,
  note: optText(1000),
  assignedToId: optUuid,
  courseId: optUuid,
  daysPattern: z
    .enum([...DAYS_PATTERNS, ""])
    .optional()
    .transform((v) => (v ? v : undefined)),
  tagIds: z.array(z.uuid()),
});
export type LeadInput = z.input<typeof leadSchema>;
export type LeadOutput = z.output<typeof leadSchema>;

export const columnSchema = z.object({ name: z.string().trim().min(1, "required").max(40) });
export const listSchema = z.object({ name: z.string().trim().min(1, "required").max(40) });

export const callSchema = z.object({
  outcome: z.enum(CALL_OUTCOMES),
  direction: z.enum(["OUTGOING", "INCOMING"]),
  durationMinutes: z
    .number()
    .int()
    .min(0, "invalid")
    .max(600, "invalid")
    .optional()
    .or(z.nan().transform(() => undefined)),
  note: optText(500),
});
export type CallInput = z.input<typeof callSchema>;

export const smsSchema = z.object({ text: z.string().trim().min(1, "required").max(500, "invalid") });

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Eslatma: aynan bitta bog'liq obyekt (lid, guruh, talaba yoki o'qituvchi). */
export const reminderSchema = z
  .object({
    title: z.string().trim().min(1, "required").max(120),
    note: optText(1000),
    dueDate: requiredDate,
    dueTime: z.string().regex(HHMM, "invalidTime"),
    responsibleId: z.uuid("required"),
    tagIds: z.array(z.uuid()),
    leadId: optUuid,
    groupId: optUuid,
    studentId: optUuid,
    teacherId: optUuid,
  })
  .refine((v) => [v.leadId, v.groupId, v.studentId, v.teacherId].filter(Boolean).length === 1, { path: ["title"], message: "invalid" });
export type ReminderInput = z.input<typeof reminderSchema>;
