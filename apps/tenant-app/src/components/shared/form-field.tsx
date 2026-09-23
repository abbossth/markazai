/**
 * `<label>` — matn va input BITTA elementda (implicit label, `htmlFor`/`id` shart emas): 124+ joyda ishlatiladigan
 * bu komponent avval faqat vizual edi (input bilan dasturiy bog'lanmagan — skrin-riderlar uchun nomsiz qolardi).
 */
export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm leading-none font-medium select-none">{label}</span>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </label>
  );
}
