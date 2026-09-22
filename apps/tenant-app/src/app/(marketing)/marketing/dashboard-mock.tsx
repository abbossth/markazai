/**
 * Dekorativ "brauzer mokapi": haqiqiy skrinshot emas, ilovaning o'zidagi ranglar/uslub bilan qurilgan
 * statik ko'rinish. `{slug}.ROOT_DOMAIN` manzil satrida ko'rinadi — mahsulotning subdomen g'oyasini tushuntiradi.
 */
export function DashboardMock({ host }: { host: string }) {
  const bars = [38, 62, 45, 78, 55, 90, 70];
  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-indigo-950/40 ring-1 ring-black/5">
      <div className="flex items-center gap-2 border-b border-white/10 bg-slate-950/60 px-4 py-3">
        <span className="size-2.5 rounded-full bg-rose-400/70" />
        <span className="size-2.5 rounded-full bg-amber-400/70" />
        <span className="size-2.5 rounded-full bg-emerald-400/70" />
        <div className="ml-3 flex-1 truncate rounded-md bg-white/5 px-3 py-1 text-center font-mono text-[11px] text-slate-400">{host}</div>
      </div>
      <div className="flex text-xs">
        <div className="hidden w-36 shrink-0 flex-col gap-1 border-r border-white/10 p-3 sm:flex">
          {["Bosh sahifa", "Lidlar", "Guruhlar", "Talabalar", "Moliya", "Hisobotlar"].map((item, i) => (
            <div key={item} className={`rounded-md px-2.5 py-1.5 ${i === 0 ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400"}`}>
              {item}
            </div>
          ))}
        </div>
        <div className="flex-1 p-4">
          <div className="mb-3 grid grid-cols-3 gap-2">
            {[
              ["Faol o'quvchilar", "248"],
              ["Guruhlar", "19"],
              ["Bu oy to'lagan", "163"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <div className="text-slate-400">{label}</div>
                <div className="mt-1 font-semibold text-white tabular-nums">{value}</div>
              </div>
            ))}
          </div>
          <div className="flex h-20 items-end gap-1.5 rounded-lg border border-white/10 bg-white/5 p-3">
            {bars.map((h, i) => (
              <div key={i} className="flex-1 rounded-t-sm bg-gradient-to-t from-indigo-500 to-violet-400" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
