"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export type FormState = { ok?: boolean; error?: string; message?: string } | null;

/**
 * Server action bilan ishlaydigan forma: yuborilganda tugma bloklanadi, natija (xato/muvaffaqiyat xabari) shu yerda ko'rsatiladi.
 * `children` — maydonlar (name atributlari bilan); xabar `message` da bir necha qator bo'lishi mumkin (masalan, bir martalik parol).
 */
export function ActionForm({ action, submit, variant = "default", className, children, confirm }: {
  action: (prev: FormState, data: FormData) => Promise<FormState>;
  submit: string;
  variant?: "default" | "outline" | "destructive" | "sm";
  className?: string;
  children?: React.ReactNode;
  confirm?: string;
}) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form
      action={run}
      className={cn("flex flex-col gap-3", className)}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <div className="flex items-center gap-3">
        <Button type="submit" variant={variant} disabled={pending}>
          {submit}
        </Button>
      </div>
      {state?.error && (
        <p role="alert" className="text-destructive text-sm whitespace-pre-line">
          {state.error}
        </p>
      )}
      {state?.ok && state.message && <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm whitespace-pre-line">{state.message}</p>}
    </form>
  );
}
