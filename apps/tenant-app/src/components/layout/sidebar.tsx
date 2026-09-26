"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { MAIN_NAV, SETTINGS_NAV, type NavItem } from "@/config/nav";
import { canAccess, type AppModule } from "@/lib/permissions";
import { MarkazaiLogo } from "@/components/brand/logo";
import { MarkazaiMark } from "@/components/brand/mark";

function NavLink({ item, active, rail }: { item: NavItem; active: boolean; rail?: boolean }) {
  const t = useTranslations("nav");
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      // Sidebar HAR sahifada butunlay ko'rinadi — sukut prefetch barcha modullarni bir vaqtda oldindan
      // yuklardi (productionda bir necha o'nlab bir zumdagi so'rov, ulanish pool'ini zo'riqtirib, tasodifiy
      // sessiya uzilishlariga hissa qo'shgani kuzatildi). Havola bosilganda oddiy navigatsiya yetarli.
      prefetch={false}
      aria-current={active ? "page" : undefined}
      className={
        rail
          ? cn(
              // Ixcham "rail" ko'rinish: belgi tepada, nom pastda, bo'limlar ajratuvchi chiziq bilan; faol bo'lim rangli chiziq bilan.
              "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border-sidebar-border/60 relative flex flex-col items-center gap-1.5 border-b px-1 py-3.5 text-center text-[11px] leading-tight font-medium break-words transition-colors",
              active && "text-brand-500 bg-brand-500/5",
            )
          : cn(
              "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active && "bg-sidebar-accent text-sidebar-accent-foreground",
            )
      }
    >
      {rail && active && <span className="bg-brand-500 absolute top-1/2 left-0 h-9 w-1 -translate-y-1/2 rounded-r-full" aria-hidden />}
      <Icon className={rail ? "size-6 shrink-0" : "size-4 shrink-0"} strokeWidth={rail ? 1.6 : undefined} />
      {t(item.key as "dashboard")}
    </Link>
  );
}

/** Nav ro'yxati — desktop `<aside>` va mobil `Sheet` ikkalasida ham ishlatiladi (bitta manba). */
export function SidebarNavContent({ roles, rail }: { roles: string[]; rail?: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <Link href="/dashboard" className={rail ? "flex h-16 items-center justify-center" : "flex h-14 items-center px-5"} aria-label="Markazai">
        {rail ? <MarkazaiMark size={34} /> : <MarkazaiLogo size={28} />}
      </Link>

      <nav className={rail ? "border-sidebar-border/60 flex flex-1 flex-col overflow-y-auto border-t" : "flex flex-1 flex-col gap-1 px-3 py-2"}>
        {MAIN_NAV.filter((item) => canAccess(roles, item.key as AppModule)).map((item) => (
          <NavLink key={item.key} item={item} active={isActive(item.href)} rail={rail} />
        ))}
        {/* Sozlamalar — boshqa bo'limlar qatorida, ro'yxat oxirida. */}
        {canAccess(roles, "settings") && <NavLink item={SETTINGS_NAV} active={isActive(SETTINGS_NAV.href)} rail={rail} />}
      </nav>
    </>
  );
}

// md dan katta ekranlarda doim ko'rinadi; kichikroqlarda (mobil/planshet) — `MobileNav` (header'dagi) o'rniga ishlaydi.
export function Sidebar({ roles }: { roles: string[] }) {
  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-[92px] shrink-0 flex-col border-r md:flex print:hidden">
      <SidebarNavContent roles={roles} rail />
    </aside>
  );
}
