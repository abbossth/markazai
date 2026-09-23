"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { loginSchema, type LoginInput, type LoginOutput } from "@markazai/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/layout/phone-input";
import { login } from "./actions";

export function LoginForm() {
  const t = useTranslations("login");
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="pr-9"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            // w-8 (32px) — teginish nishoni kamida 24×24px bo'lishi kerak (WCAG 2.5.8); faqat ikonka (16px) yetarli emas edi.
            className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-8 items-center justify-center"
          >
            {/* Yozilganda "ko'z" ochiladi, yashirilganda yumiladi */}
            {showPassword ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
        </div>
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
