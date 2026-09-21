/** Hisobot tepasidagi qisqa ko'rsatkichlar (server komponent). */
export function SummaryTiles({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((i, idx) => (
        <div key={`${i.label}-${idx}`} className="bg-card flex min-w-32 flex-col gap-0.5 rounded-lg border px-4 py-2">
          <span className="text-muted-foreground text-xs">{i.label}</span>
          <span className="text-xl font-semibold tabular-nums">{i.value}</span>
        </div>
      ))}
    </div>
  );
}
