import { HeaderSkeleton, StatGridSkeleton, TabsSkeleton, TableSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <HeaderSkeleton actions={0} />
      <TabsSkeleton count={6} />
      <StatGridSkeleton count={4} />
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}
