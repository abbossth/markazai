"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui";

/** Parol maydoni + ko'rsatish/yashirish tugmasi (ko'z ikonkasi). */
export function PasswordInput(props: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-9" />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Parolni yashirish" : "Parolni ko'rsatish"}
        className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-8 items-center justify-center"
      >
        {show ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </button>
    </div>
  );
}
