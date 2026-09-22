import { HeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <TableSkeleton rows={10} cols={5} />
    </>
  );
}
