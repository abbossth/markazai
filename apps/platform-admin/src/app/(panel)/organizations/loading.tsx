import { HeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton actions={1} />
      <TableSkeleton rows={8} cols={6} />
    </>
  );
}
