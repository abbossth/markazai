import { HeaderSkeleton, CardListSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <CardListSkeleton count={4} fields={4} />
      <TableSkeleton rows={5} cols={6} />
    </>
  );
}
