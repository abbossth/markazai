"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Gorizontal aylantiriladigan hudud: ingichka, yumaloq skroll chizig'i (jadvaldan ozgina pastda) va chetlarda
 * chapga/o'ngga surish tugmalari (faqat surish mumkin bo'lganda ko'rinadi). Ichidagi `sticky left-0` ustun ishlayveradi.
 */
export function HScroll({ children, stickyOffset = 72, className }: { children: React.ReactNode; /** Chap tugma joylashishi (px): qotirilgan birinchi ustun kengligi. */ stickyOffset?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [update]);

  const scrollBy = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * Math.max(240, (ref.current?.clientWidth ?? 0) * 0.6), behavior: "smooth" });
  const btn = "bg-card text-foreground/80 hover:bg-muted absolute top-1/2 z-20 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border shadow-md transition-colors";

  return (
    <div className={cn("relative", className)}>
      <div ref={ref} onScroll={update} className="thin-scroll overflow-x-auto pb-5">
        {children}
      </div>
      {edge.left && (
        <button type="button" aria-label="←" className={btn} style={{ left: stickyOffset }} onClick={() => scrollBy(-1)}>
          <ChevronLeft className="size-4" />
        </button>
      )}
      {edge.right && (
        <button type="button" aria-label="→" className={cn(btn, "right-2")} onClick={() => scrollBy(1)}>
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}
