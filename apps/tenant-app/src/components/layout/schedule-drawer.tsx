"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays } from "lucide-react";
import { loadScheduleDrawerData } from "@/app/(app)/dashboard/actions";
import { ScheduleWidget } from "@/app/(app)/dashboard/widgets";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Data = Awaited<ReturnType<typeof loadScheduleDrawerData>>;

/**
 * O'ng chetga yopishgan taqvim tugmasi: istalgan sahifadan dars jadvalini (Toq/Juft kunlar, xona × vaqt) yon panelda ochadi.
 * Ma'lumot faqat ochilganda yuklanadi va keyingi ochilishlarda qayta yuklanadi (jadval o'zgargan bo'lishi mumkin).
 */
export function ScheduleDrawer() {
  const t = useTranslations("dashboard.schedule");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [loading, startTransition] = useTransition();

  const show = () => {
    setOpen(true);
    startTransition(async () => setData(await loadScheduleDrawerData()));
  };

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label={t("title")}
        title={t("title")}
        className="bg-card text-brand-500 hover:bg-muted fixed top-1/2 right-0 z-30 flex h-11 w-9 -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 shadow-md transition-colors print:hidden"
      >
        <CalendarDays className="size-5" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[min(82vw,1240px)]">
          <SheetHeader>
            <SheetTitle className="sr-only">{t("title")}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
            {data ? (
              <ScheduleWidget groups={data.groups} today={data.today} />
            ) : (
              <div className="flex flex-col gap-3" aria-busy={loading}>
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-40 w-full" />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
