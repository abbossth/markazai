"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNavContent } from "./sidebar";

/**
 * md'dan kichik ekranlar (mobil, planshet) uchun: desktop `<Sidebar>` shu kengliklarda yashiringan
 * (`hidden md:flex`), aks holda navigatsiya butunlay yo'qolib qolardi — o'rniga shu "gamburger" + tortma panel.
 */
export function MobileNav({ roles }: { roles: string[] }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Havola bosilib, sahifa almashganda panel avtomatik yopiladi — render vaqtida moslashtiriladi
  // (effekt emas: React'ning tavsiya etilgan "state ni render paytida moslashtirish" andozasi).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" aria-label={t("menu")} className="md:hidden" />}>
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="bg-sidebar text-sidebar-foreground w-72 gap-0 p-0">
        <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
        <SheetDescription className="sr-only">{t("menu")}</SheetDescription>
        <SidebarNavContent roles={roles} />
      </SheetContent>
    </Sheet>
  );
}
