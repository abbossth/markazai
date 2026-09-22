import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { daysBetween, toCenterParts } from "@markazai/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TenantInfo } from "@/lib/tenant";

/** Obuna qanchadan kam qolganda ogohlantirish ko'rsatiladi (kunlarda). */
const WARN_WITHIN_DAYS = 7;
const CONTACT_EMAIL = "hello@markazai.uz";

/**
 * Obuna muddati yaqinlashganda tenant ilovaning ichida (login sahifasidan tashqari) ko'rsatiladigan eslatma.
 * Muddat allaqachon o'tgan bo'lsa bu bannerga hech qachon yetib kelinmaydi — kirish `getSessionUser()`
 * darajasida bloklanadi (login sahifasidagi "Obunangiz tugagan" xabari orqali).
 */
export function SubscriptionBanner({ tenant }: { tenant: TenantInfo | null }) {
  if (!tenant?.subscriptionEnd) return null;
  const today = toCenterParts(new Date()).date;
  const daysLeft = daysBetween(today, tenant.subscriptionEnd);
  if (tenant.subscriptionEnd < today || daysLeft > WARN_WITHIN_DAYS) return null;

  const urgent = daysLeft <= 2;
  const dateLabel = `${tenant.subscriptionEnd.slice(8, 10)}.${tenant.subscriptionEnd.slice(5, 7)}.${tenant.subscriptionEnd.slice(0, 4)} — 23:59`;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 border-b px-4 py-2.5 text-sm print:hidden",
        urgent ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300" : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      )}
    >
      <CalendarClock className="size-4 shrink-0" />
      <span>
        Obunaning amal qilish muddati: <span className="font-medium">{dateLabel}</span>
      </span>
      <Badge variant="outline" className={cn("border-current", urgent && "animate-pulse")}>
        {daysLeft === 0 ? "Bugun tugaydi" : `${daysLeft} kundan kam vaqt qoldi`}
      </Badge>
      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" variant="outline" className="border-current bg-transparent" nativeButton={false} render={<Link href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Obunani to'lash — ${tenant.name}`)}`} />}>
          To&apos;lash
        </Button>
      </div>
    </div>
  );
}
