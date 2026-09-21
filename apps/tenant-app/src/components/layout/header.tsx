"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, History, Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "./global-search";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

type Props = { user: { name: string; phone: string; image?: string | null; roles: string[] } };

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

export function Header({ user }: Props) {
  const t = useTranslations("common");

  return (
    <header className="bg-background flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-0.5">
        <LocaleSwitcher />
        <ThemeToggle />
        <FullscreenToggle />
        {/* Tarix va bildirishnomalar keyingi bosqichlarda ulanadi */}
        <Button variant="ghost" size="icon" aria-label={t("history")} title={t("history")}>
          <History className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label={t("notifications")} title={t("notifications")}>
          <Bell className="size-4" />
        </Button>
        <UserMenu {...user} />
      </div>
    </header>
  );
}
