"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import type { BellItem } from "@/app/(app)/reminders/queries";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Menga tegishli, bugun yoki undan oldin muddati kelgan bajarilmagan eslatmalar. */
export function NotificationsBell({ count, items }: { count: number; items: BellItem[] }) {
  const t = useTranslations("reminders");
  const tc = useTranslations("common");

  // Badge ichidagi ko'rinadigan raqam ("9+"/soni) accessible name'ga kiritilishi kerak (WCAG 2.5.3) —
  // aks holda faqat "Bildirishnomalar" deb o'qiladi-yu, ko'rinadigan matn bilan mos kelmaydi.
  const badge = count > 9 ? "9+" : count > 0 ? String(count) : "";
  const label = badge ? `${tc("notifications")} (${badge})` : tc("notifications");

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative" aria-label={label} title={label} />}>
        <Bell className="size-4" />
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 flex min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] leading-4 font-medium text-white">
            {badge}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-1 p-2">
        <p className="px-2 pt-1 text-sm font-semibold">{t("bellTitle")}</p>
        {items.length === 0 ? (
          <p className="text-muted-foreground px-2 py-3 text-sm">{t("bellEmpty")}</p>
        ) : (
          <ul className="flex flex-col">
            {items.map((r) => (
              <li key={r.id}>
                <Link href={r.href} className="hover:bg-muted flex flex-col rounded-md px-2 py-1.5 text-sm">
                  <span className="font-medium">{r.title}</span>
                  <span className={cn("text-xs", r.overdue ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>
                    {r.context && `${r.context} · `}
                    {formatDateTime(r.dueAt)}
                  </span>
                </Link>
              </li>
            ))}
            {count > items.length && <li className="text-muted-foreground px-2 py-1 text-xs">{t("bellMore", { count: count - items.length })}</li>}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
