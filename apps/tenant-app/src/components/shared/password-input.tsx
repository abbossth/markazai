"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<typeof Input>, "type"> & {
  /** Tarjima qilingan aria-label'lar (masalan login formasi) — berilmasa, o'zbekcha sukut qiymat ishlatiladi. */
  labels?: { show: string; hide: string };
};

/** Parol maydoni + ko'rsatish/yashirish tugmasi (ko'z ikonkasi). react-hook-form `register()` bilan mos. */
export const PasswordInput = ({ className, labels, ...props }: Props) => {
  const [show, setShow] = useState(false);
  const showLabel = labels?.show ?? "Parolni ko'rsatish";
  const hideLabel = labels?.hide ?? "Parolni yashirish";
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className={cn("pr-9", className)} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? hideLabel : showLabel}
        // w-8 — teginish nishoni kamida 24×24px (WCAG 2.5.8).
        className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-8 items-center justify-center"
      >
        {show ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </button>
    </div>
  );
};
