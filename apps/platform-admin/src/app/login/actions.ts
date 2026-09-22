"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import type { FormState } from "@/components/action-form";

export async function login(_prev: FormState, data: FormData): Promise<FormState> {
  try {
    await signIn("credentials", { email: String(data.get("email") ?? ""), password: String(data.get("password") ?? ""), redirectTo: "/" });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Email yoki parol noto'g'ri" };
    throw e; // NEXT_REDIRECT
  }
  return null;
}
