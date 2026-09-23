"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCenterConfig } from "@/components/providers/providers";
import { LOCALES } from "@/i18n/config";
import { setLocale } from "@/i18n/actions";

export function LocaleSwitcher() {
  const t = useTranslations("common");
  const current = useLocale();
  const [pending, startTransition] = useTransition();
  const { locales: enabled } = useCenterConfig();
  const options = LOCALES.filter((l) => enabled.includes(l.code));
  const active = LOCALES.find((l) => l.code === current);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        // Ko'rinadigan matn (masalan "UZ") accessible name'ga kiritilishi kerak (WCAG 2.5.3) — aks holda ovozli
        // boshqaruv ("UZ" tugmasini bos) ishlamaydi; shuning uchun faqat "Til" emas, kod ham qo'shiladi.
        render={<Button variant="ghost" size="sm" disabled={pending} aria-label={`${t("language")}: ${active?.short ?? ""}`} />}
      >
        <Languages className="size-4" />
        {active?.short}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((l) => (
          <DropdownMenuItem key={l.code} onClick={() => startTransition(() => setLocale(l.code))}>
            <span className="flex-1">{l.label}</span>
            {l.code === current && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
