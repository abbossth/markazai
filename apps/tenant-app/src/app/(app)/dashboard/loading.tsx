import { ChartSkeleton, HeaderSkeleton, StatGridSkeleton } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <HeaderSkeleton actions={2} />
      <StatGridSkeleton count={9} />
      <div className="bg-card flex flex-col gap-3 rounded-lg border p-4">
        <Skeleton className="h-4 w-40" />
        <ChartSkeleton />
      </div>
    </div>
  );
}
