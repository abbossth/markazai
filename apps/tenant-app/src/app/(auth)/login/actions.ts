"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { loginSchema } from "@markazai/types";

export type LoginError = "invalidPhone" | "invalidCredentials" | "genericError";

export async function login(input: unknown): Promise<{ error: LoginError }> {
  // Backend validatsiya (frontend bilan bir xil zod sxema).
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    const phoneBad = parsed.error.issues.some((i) => i.path[0] === "phone");
    return { error: phoneBad ? "invalidPhone" : "invalidCredentials" };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/dashboard" });
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: e.type === "CredentialsSignin" ? "invalidCredentials" : "genericError" };
    }
    throw e; // NEXT_REDIRECT muvaffaqiyatli kirishda shu yerdan o'tadi
  }
  return { error: "genericError" };
}
