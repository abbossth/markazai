"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { importLeads, type ImportResult } from "./import-actions";

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("lead.arch.import");
  const tc = useTranslations("common");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await importLeads(fd);
      setResult(res);
      if (res.ok) {
        toast.success(t("result", { created: res.created, skipped: res.skipped, failed: res.failed }));
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : res.error === "tooBig" ? t("tooBig") : t("badFile"));
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setResult(null);
          setFileName("");
        }
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("hint")}</DialogDescription>
        </DialogHeader>
        <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => { setFileName(e.target.files?.[0]?.name ?? ""); setResult(null); }} />
        <button type="button" onClick={() => inputRef.current?.click()} className="hover:bg-muted/50 flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-sm transition-colors">
          <FileSpreadsheet className="text-muted-foreground size-8" />
          <span className={fileName ? "font-medium" : "text-muted-foreground"}>{fileName || t("pick")}</span>
        </button>
        {result?.ok && (
          <div className="text-sm">
            <p className="font-medium">{t("result", { created: result.created, skipped: result.skipped, failed: result.failed })}</p>
            {result.errors.length > 0 && (
              <p className="text-muted-foreground mt-1 text-xs">
                {t("errors")}: {result.errors.join(", ")}
              </p>
            )}
          </div>
        )}
        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" nativeButton={false} render={<a href="/leads/import-sample" download />}>
            {t("sample")}
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !fileName}>
            {t("upload")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
