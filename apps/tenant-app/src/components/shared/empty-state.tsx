import { Inbox } from "lucide-react";

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-center">
      <Inbox className="size-8" />
      <p className="text-foreground text-sm font-medium">{title}</p>
      {hint && <p className="max-w-sm text-xs">{hint}</p>}
    </div>
  );
}
