import { FilterBarSkeleton, HeaderSkeleton, TableSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <HeaderSkeleton actions={1} />
      <FilterBarSkeleton />
      <TableSkeleton rows={10} cols={7} />
    </div>
  );
}
