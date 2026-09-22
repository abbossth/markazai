import { HeaderSkeleton, TableSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <HeaderSkeleton actions={0} sub />
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}
