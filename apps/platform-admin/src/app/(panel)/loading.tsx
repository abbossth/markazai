import { HeaderSkeleton, StatGridSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <StatGridSkeleton count={4} />
      <TableSkeleton rows={4} cols={4} />
    </>
  );
}
