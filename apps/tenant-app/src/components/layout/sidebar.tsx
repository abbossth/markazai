"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { MAIN_NAV, SETTINGS_NAV, type NavItem } from "@/config/nav";
import { canAccess, type AppModule } from "@/lib/permissions";
import { MarkazaiLogo } from "@/components/brand/logo";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const t = useTranslations("nav");
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active && "bg-sidebar-accent text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {t(item.key as "dashboard")}
    </Link>
  );
}

export function Sidebar({ roles }: { roles: string[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-60 shrink-0 flex-col border-r md:flex print:hidden">
      <Link href="/dashboard" className="flex h-14 items-center px-5">
        <MarkazaiLogo size={28} />
      </Link>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {MAIN_NAV.filter((item) => canAccess(roles, item.key as AppModule)).map((item) => (
          <NavLink key={item.key} item={item} active={isActive(item.href)} />
        ))}
      </nav>

      {canAccess(roles, "settings") && (
        <div className="border-sidebar-border border-t p-3">
          <NavLink item={SETTINGS_NAV} active={isActive(SETTINGS_NAV.href)} />
        </div>
      )}
    </aside>
  );
}
