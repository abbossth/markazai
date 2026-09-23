"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";

const LINKS = [
  { href: "#imkoniyatlar", label: "Imkoniyatlar" },
  { href: "#qanday-ishlaydi", label: "Qanday ishlaydi" },
  { href: "#narxlar", label: "Narxlar" },
  { href: "#savollar", label: "Savollar" },
];

/** md dan kichik ekranlarda — asosiy nav (`hidden md:flex`) yashiringan joyda "gamburger" + tortma panel. */
export function MarketingMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Menyu" className="md:hidden" />}>
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <SheetTitle className="sr-only">Menyu</SheetTitle>
        <SheetDescription className="sr-only">Menyu</SheetDescription>
        <nav className="flex flex-col gap-1 p-4">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="hover:bg-muted rounded-lg px-3 py-2.5 text-sm font-medium">
              {l.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
