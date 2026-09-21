import { z } from "zod";
import { phoneSchema } from "./phone";

/** 1–8-bosqichlarda ishlatiladigan yagona (statik) tenant. 9-bosqichda subdomen orqali aniqlanadi. */
export const DEFAULT_ORGANIZATION_ID =
  process.env.DEFAULT_ORGANIZATION_ID ?? "00000000-0000-4000-8000-000000000001";

export * from "./roles";

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
export * from "./billing";
export * from "./finance-forms";
export * from "./salary";
export * from "./teacher";
export * from "./dashboard";
export * from "./reports";
export * from "./settings";
export * from "./gamification";
