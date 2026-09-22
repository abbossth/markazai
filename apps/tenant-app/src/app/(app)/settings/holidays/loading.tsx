import { TableSkeleton } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="ml-auto h-9 w-40" />
      </div>
      <TableSkeleton rows={5} cols={2} />
    </div>
  );
}
