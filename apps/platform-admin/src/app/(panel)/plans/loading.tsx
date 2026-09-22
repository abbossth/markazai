import { HeaderSkeleton, CardListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <CardListSkeleton count={4} fields={5} />
    </>
  );
}
