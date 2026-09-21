"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** "+998" prefiksi bilan telefon maydoni. Qiymat sifatida faqat 9 ta raqam (operator+abonent) qaytariladi. */
function format(digits: string) {
  const d = digits.slice(0, 9);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return parts.join(" ");
}

type Props = Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onChange: (digits: string) => void;
};

export const PhoneInput = React.forwardRef<HTMLInputElement, Props>(function PhoneInput(
  { value, onChange, className, ...props },
  ref,
) {
  return (
    <div className="relative">
      <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm">
        +998
      </span>
      <Input
        ref={ref}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="90 123 45 67"
        className={cn("pl-12", className)}
        value={format(value)}
        onChange={(e) => {
          let digits = e.target.value.replace(/\D/g, "");
          // To'liq raqam (998...) qo'yilsa, prefiks olib tashlanadi.
          if (digits.length > 9 && digits.startsWith("998")) digits = digits.slice(3);
          onChange(digits.slice(0, 9));
        }}
        {...props}
      />
    </div>
  );
});
