import { ChartSkeleton, HeaderSkeleton, StatGridSkeleton, TabsSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <HeaderSkeleton actions={0} />
      <TabsSkeleton count={5} />
      <StatGridSkeleton count={4} />
      <div className="bg-card flex flex-col gap-3 rounded-lg border p-4">
        <Skeleton className="h-4 w-40" />
        <ChartSkeleton />
      </div>
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}
