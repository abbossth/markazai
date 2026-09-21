import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";

/** Balans: manfiy — qizil (qarz), musbat — yashil, nol — kulrang. */
export function Money({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        value < 0 ? "text-rose-600 dark:text-rose-400" : value > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
        className,
      )}
    >
      {formatMoney(value)}
    </span>
  );
}
