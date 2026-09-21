"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Rasm yuklash: `/api/upload` ga yuboradi va qaytgan manzilni `onChange` orqali beradi (forma saqlanguncha bazaga yozilmaydi). */
export function ImageUpload({ value, onChange, shape = "square" }: { value?: string; onChange: (url: string) => void; shape?: "square" | "wide" }) {
  const t = useTranslations("settings.general");
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && json.url) onChange(json.url);
      else setError(json.error === "tooLarge" || json.error === "invalidType" ? t(`uploadErrors.${json.error}`) : t("uploadErrors.generic"));
    } catch {
      setError(t("uploadErrors.generic"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className={shape === "wide" ? "bg-muted h-16 w-40 overflow-hidden rounded-md border" : "bg-muted size-16 overflow-hidden rounded-md border"}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- ichki /api/files manzili
            <img src={value} alt="" className={shape === "wide" ? "h-full w-full object-cover" : "h-full w-full object-contain"} />
          ) : null}
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          <ImagePlus className="size-4" />
          {busy ? t("uploading") : t("upload")}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            <Trash2 className="size-4" />
            {t("remove")}
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs">{t("imageHint")}</p>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
