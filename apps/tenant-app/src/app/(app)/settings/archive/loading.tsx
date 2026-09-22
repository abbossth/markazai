import { TableSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return <TableSkeleton rows={6} cols={6} />;
}
