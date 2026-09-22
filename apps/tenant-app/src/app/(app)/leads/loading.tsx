import { HeaderSkeleton, FilterBarSkeleton, KanbanSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <HeaderSkeleton actions={1} />
      <FilterBarSkeleton />
      <KanbanSkeleton columns={4} />
    </div>
  );
}
