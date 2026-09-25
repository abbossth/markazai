"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { loginSchema, type LoginInput, type LoginOutput } from "@markazai/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/shared/password-input";
import { PhoneInput } from "@/components/layout/phone-input";
import { login } from "./actions";

export function LoginForm() {
  const t = useTranslations("login");
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput, unknown, LoginOutput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const res = await login(values);
      // Muvaffaqiyatda server redirect qiladi; bu yerga faqat xatolik bilan keladi.
      setServerError(t(res.error));
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">{t("phone")}</Label>
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <PhoneInput
              id="phone"
              ref={field.ref}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={!!errors.phone}
              autoFocus
            />
          )}
        />
        {errors.phone && <p className="text-destructive text-xs">{t(errors.phone.message as "required")}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{t("password")}</Label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          labels={{ show: t("showPassword"), hide: t("hidePassword") }}
          {...register("password")}
        />
        {errors.password && <p className="text-destructive text-xs">{t(errors.password.message as "required")}</p>}
      </div>

      {serverError && (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      )}

      <Button type="submit" size="lg" className="mt-2 h-10 w-full text-sm font-semibold tracking-wide" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
