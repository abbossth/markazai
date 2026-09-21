"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "general", href: "/settings" },
  { key: "staff", href: "/settings/staff" },
  { key: "courses", href: "/settings/courses" },
  { key: "rooms", href: "/settings/rooms" },
  { key: "tags", href: "/settings/tags" },
  { key: "holidays", href: "/settings/holidays" },
  { key: "receipt", href: "/settings/receipt" },
  { key: "leadForm", href: "/settings/lead-form" },
  { key: "integrations", href: "/settings/integrations" },
  { key: "archive", href: "/settings/archive" },
  { key: "changelog", href: "/settings/changelog" },
] as const;

export function SettingsNav() {
  const t = useTranslations("settings.nav");
  const pathname = usePathname();
  return (
    <nav className="flex flex-row flex-wrap gap-1 lg:flex-col print:hidden" aria-label={t("general")}>
      {ITEMS.map((i) => {
        const active = i.href === "/settings" ? pathname === "/settings" : pathname.startsWith(i.href);
        return (
          <Link
            key={i.key}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn("text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-3 py-1.5 text-sm transition-colors", active && "bg-secondary text-foreground font-medium")}
          >
            {t(i.key)}
          </Link>
        );
      })}
    </nav>
  );
}
