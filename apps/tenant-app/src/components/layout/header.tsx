"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { History, Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "./global-search";
import type { BellItem } from "@/app/(app)/reminders/queries";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileNav } from "./mobile-nav";
import { NotificationsBell } from "./notifications-bell";
import { QuickCreate } from "./quick-create";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

type Props = {
  user: { name: string; phone: string; image?: string | null; roles: string[] };
  reminders: { count: number; items: BellItem[] };
  quick: { canStudent: boolean; canPayment: boolean; today: string };
};

function FullscreenToggle() {
  const t = useTranslations("common");
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onChange = () => setActive(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("fullscreen")}
      title={t("fullscreen")}
      onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
    >
      {active ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
    </Button>
  );
}

export function Header({ user, reminders, quick }: Props) {
  const t = useTranslations("common");

  return (
    <header className="bg-background flex h-14 shrink-0 items-center gap-3 border-b px-4 print:hidden">
      <MobileNav roles={user.roles} />
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-1">
        <QuickCreate {...quick} />
        {/* Mobil ekranda faqat kerakli tugmalar qoladi: "+", rejim (mavzu), eslatmalar va profil. */}
        <div className="hidden items-center gap-0.5 md:flex">
          <LocaleSwitcher />
        </div>
        <ThemeToggle />
        <div className="hidden items-center gap-0.5 md:flex">
          <FullscreenToggle />
          {/* Tarix keyingi bosqichlarda ulanadi */}
          <Button variant="ghost" size="icon" aria-label={t("history")} title={t("history")}>
            <History className="size-4" />
          </Button>
        </div>
        <NotificationsBell count={reminders.count} items={reminders.items} />
        <UserMenu {...user} />
      </div>
    </header>
  );
}
