"use client";

import { cn } from "@/lib/utils";

// Validatsiya qilingan kategorik palitra (dataviz) — kurs/teg ranglari uchun tayyor tanlov.
export const PRESET_COLORS = ["#2563eb", "#0d9488", "#d97706", "#db2777", "#7c3aed", "#059669", "#dc2626", "#0891b2"];

export function ColorPicker({ value, onChange, allowEmpty }: { value: string; onChange: (v: string) => void; allowEmpty?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group">
      {allowEmpty && (
        <button type="button" aria-label="—" aria-pressed={!value} onClick={() => onChange("")} className={cn("bg-muted size-6 rounded-full border", !value && "ring-primary ring-2 ring-offset-2")} />
      )}
      {PRESET_COLORS.map((c) => (
        <button key={c} type="button" aria-label={c} aria-pressed={value === c} onClick={() => onChange(c)} style={{ backgroundColor: c }} className={cn("size-6 rounded-full border", value === c && "ring-primary ring-2 ring-offset-2")} />
      ))}
      <input type="color" aria-label="custom color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#2563eb"} onChange={(e) => onChange(e.target.value)} className="h-6 w-8 cursor-pointer rounded border bg-transparent p-0.5" />
    </div>
  );
}
