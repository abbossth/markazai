import { z } from "zod";
import { phoneSchema } from "./phone";

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

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, "required"),
});
export type LoginInput = z.input<typeof loginSchema>;
export type LoginOutput = z.output<typeof loginSchema>;

export * from "./schedule";
export * from "./phone";
export * from "./student";
export * from "./common";
export * from "./finance";
export * from "./attendance";
export * from "./group";
export * from "./group-extras";
export * from "./ordering";
export * from "./timezone";
export * from "./lead";
