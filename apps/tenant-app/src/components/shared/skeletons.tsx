import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Qayta ishlatiladigan skeleton bloklari. Har bir `loading.tsx` shu bloklardan sahifaning haqiqiy
 * qatlamiga (sarlavha, filtr, jadval, kartalar...) yaqin ko'rinish yig'adi — shunda ma'lumot kelganda
 * joylashuv deyarli sakramaydi (layout shift kam).
 */

export function HeaderSkeleton({ actions = 1, sub }: { actions?: number; sub?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        {sub && <Skeleton className="h-4 w-32" />}
      </div>
      <div className="ml-auto flex gap-2">
        {Array.from({ length: actions }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28" />
        ))}
      </div>
    </div>
  );
}

export function FilterBarSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-9 w-full max-w-sm" />
      <Skeleton className="h-9 w-24" />
      <Skeleton className="ml-auto h-9 w-32" />
    </div>
  );
}

export function TabsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="bg-muted inline-flex w-fit gap-1 rounded-lg p-1">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-7 w-24 bg-black/10 dark:bg-white/10" />
      ))}
    </div>
  );
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card flex flex-col gap-2 rounded-lg border p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-56 w-full", className)} />;
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <div className="border-b p-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 flex-1" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b p-3 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-4 flex-1", c === 0 && "max-w-40")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card flex flex-col gap-3 rounded-lg border p-4">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({ sections = 3, fields = 3 }: { sections?: number; fields?: number }) {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {Array.from({ length: sections }).map((_, s) => (
        <div key={s} className="bg-card flex flex-col gap-4 rounded-lg border p-5">
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: fields }).map((_, f) => (
              <div key={f} className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Talaba/guruh/o'qituvchi/lid profili: chapda asosiy ma'lumot, o'ngda tablar + kontent. */
export function ProfileSkeleton({ tabs = 5 }: { tabs?: number }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-4">
        <Skeleton className="size-16 shrink-0 rounded-full" />
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="flex gap-6">
          <Skeleton className="h-12 w-20" />
          <Skeleton className="h-12 w-20" />
        </div>
      </div>
      <TabsSkeleton count={tabs} />
      <TableSkeleton rows={5} cols={4} />
    </div>
  );
}

export function KanbanSkeleton({ columns = 3, cards = 4 }: { columns?: number; cards?: number }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: columns }).map((_, c) => (
        <div key={c} className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-2">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="bg-card flex flex-col gap-2 rounded-md border p-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
