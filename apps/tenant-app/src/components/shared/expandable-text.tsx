"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function ExpandableText({ text, limit = 40 }: { text: string | null | undefined; limit?: number }) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  if (!text) return <span className="text-muted-foreground">—</span>;
  if (text.length <= limit) return <span>{text}</span>;
  return (
    <span>
      {open ? text : `${text.slice(0, limit)}…`}{" "}
      <button type="button" className="text-primary text-xs hover:underline" onClick={() => setOpen((o) => !o)}>
        {open ? t("less") : t("more")}
      </button>
    </span>
  );
}
