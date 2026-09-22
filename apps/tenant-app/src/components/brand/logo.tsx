import { cn } from "@/lib/utils";
import { MarkazaiMark, type MarkTone } from "./mark";

/** "markazai" so'z belgisi — Onest 700, harflar orasi torroq (brend qo'llanmasi, 06-bet). */
export function MarkazaiWordmark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span className={cn("font-bold tracking-tight", className)} style={{ letterSpacing: "-0.02em", ...style }}>
      markazai
    </span>
  );
}

/**
 * To'liq lockup (belgi + yozuv). `size` — belgi kattaligi (px); yozuv shunga nisbatan miqyoslanadi.
 * `direction="vertical"` — belgi ustida, yozuv pastida markazlashtirilgan (login/kirish ekranlari uchun).
 */
export function MarkazaiLogo({
  size = 32,
  tone = "blue",
  direction = "horizontal",
  textClassName,
  className,
}: {
  size?: number;
  tone?: MarkTone;
  direction?: "horizontal" | "vertical";
  textClassName?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center", direction === "vertical" ? "flex-col gap-2" : "gap-2.5", className)}>
      <MarkazaiMark size={size} tone={tone} />
      <MarkazaiWordmark className={textClassName} style={{ fontSize: size * 0.72 }} />
    </span>
  );
}
