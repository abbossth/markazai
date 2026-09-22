"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Bosh sahifa" },
  { href: "/organizations", label: "Tashkilotlar" },
  { href: "/plans", label: "Rejalar" },
  { href: "/admins", label: "Platforma xodimlari" },
  { href: "/audit", label: "Audit-log" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map((i) => {
        const active = i.href === "/" ? pathname === "/" : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg px-3 py-2 text-sm transition-colors",
              active && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
