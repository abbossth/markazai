import { Skeleton } from "@/components/ui";

/** platform-admin uchun qayta ishlatiladigan skeleton bloklari (tenant-app'dagi bilan bir xil g'oya). */

export function HeaderSkeleton({ actions = 0 }: { actions?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Skeleton className="h-7 w-48" />
      <div className="ml-auto flex gap-2">
        {Array.from({ length: actions }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-32" />
        ))}
      </div>
    </div>
  );
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card flex flex-col gap-2 rounded-xl border p-5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-card overflow-hidden rounded-xl border">
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
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardListSkeleton({ count = 3, fields = 4 }: { count?: number; fields?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card flex flex-col gap-3 rounded-xl border p-5">
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: fields }).map((_, f) => (
              <Skeleton key={f} className="h-9 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return <CardListSkeleton count={1} fields={4} />;
}
