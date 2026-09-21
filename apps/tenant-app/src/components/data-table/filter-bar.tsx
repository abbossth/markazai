"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ListFilter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect, type Option } from "@/components/ui/simple-select";
import { useUrlState } from "./use-url-state";

export type FilterField =
  | { name: string; label: string; type: "select"; options: Option[] }
  | { name: string; label: string; type: "text" }
  | { name: string; label: string; type: "date" };

const ALL = "__all";

type Props = {
  searchPlaceholder: string;
  fields: FilterField[];
  /** Tepa qatorning o'ng tomoni ("Yangisini qo'shish" kabi). */
  actions?: React.ReactNode;
};

export function FilterBar({ searchPlaceholder, fields, actions }: Props) {
  const t = useTranslations("filters");
  const { searchParams, update, reset, pending } = useUrlState();
  const [open, setOpen] = useState(() => fields.some((f) => searchParams.get(f.name)));
  // Qidiruv maydoni uncontrolled: URL yangilanishi yozish paytida kursorni buzmasligi uchun.
  const [inputKey, setInputKey] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Panel qiymatlari = URL + hali "Qo'llash" bosilmagan o'zgarishlar (draft).
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const urlQ = searchParams.get("q") ?? "";
  const values = Object.fromEntries(fields.map((f) => [f.name, draft[f.name] ?? searchParams.get(f.name) ?? ""]));
  const activeCount = fields.filter((f) => searchParams.get(f.name)).length;

  const onSearchChange = (value: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => update({ q: value.trim() || undefined }), 300);
  };

  const apply = () => {
    update(Object.fromEntries(fields.map((f) => [f.name, values[f.name] || undefined])));
    setDraft({});
  };
  const clear = () => {
    reset(["q", ...fields.map((f) => f.name)]);
    setDraft({});
    setInputKey((k) => k + 1);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input key={inputKey} defaultValue={urlQ} onChange={(e) => onSearchChange(e.target.value)} placeholder={searchPlaceholder} className="pl-8" />
        </div>
        <Button variant={open ? "secondary" : "outline"} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <ListFilter className="size-4" />
          {t("filters")}
          {activeCount > 0 && <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs">{activeCount}</span>}
        </Button>
        {(activeCount > 0 || urlQ) && (
          <Button variant="ghost" onClick={clear} disabled={pending}>
            <X className="size-4" />
            {t("reset")}
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>

      {open && (
        <form
          className="bg-card grid gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          {fields.map((f) => (
            <div key={f.name} className="flex flex-col gap-1.5">
              <Label htmlFor={`f-${f.name}`}>{f.label}</Label>
              {f.type === "select" ? (
                <SimpleSelect
                  id={`f-${f.name}`}
                  value={values[f.name] || ALL}
                  onValueChange={(v) => setDraft((d) => ({ ...d, [f.name]: v === ALL ? "" : v }))}
                  options={[{ value: ALL, label: t("all") }, ...f.options]}
                />
              ) : (
                <Input
                  id={`f-${f.name}`}
                  type={f.type === "date" ? "date" : "text"}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.name]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            <Button type="submit" disabled={pending}>
              {t("apply")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
