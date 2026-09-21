"use client";

import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/app/(app)/actions";
import { initials } from "@/lib/format";

type Props = { name: string; phone: string; image?: string | null; roles: string[] };

export function UserMenu({ name, phone, image, roles }: Props) {
  const t = useTranslations("common");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" aria-label={name} />}>
        <Avatar className="size-7">
          {image && <AvatarImage src={image} alt={name} />}
          <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-foreground text-sm font-medium">{name}</span>
            <span className="text-muted-foreground text-xs font-normal">+{phone}</span>
            <span className="text-muted-foreground text-xs font-normal">{roles.join(" · ")}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => logout()}>
          <LogOut />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
