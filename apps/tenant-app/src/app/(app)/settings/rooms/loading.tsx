import { TableSkeleton } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Skeleton className="h-9 w-36" />
      </div>
      <TableSkeleton rows={6} cols={3} />
    </div>
  );
}
