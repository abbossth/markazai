import { HeaderSkeleton, CardListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <CardListSkeleton count={3} fields={4} />
    </>
  );
}
