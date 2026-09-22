import { FormSkeleton } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,30rem)_1fr]">
      <FormSkeleton sections={1} fields={2} />
      <Skeleton className="h-96 w-full max-w-md justify-self-center" />
    </div>
  );
}
