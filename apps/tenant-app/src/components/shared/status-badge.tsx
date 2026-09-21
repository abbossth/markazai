"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  FROZEN: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  NO_GROUP: "bg-muted text-muted-foreground",
  TRIAL: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  LEFT_AFTER_TRIAL: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  LEFT_ACTIVE_GROUP: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  JOINED_THIS_MONTH: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  // Guruh statuslari
  ARCHIVED: "bg-muted text-muted-foreground",
  COMPLETED: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
};

export function StudentStatusBadge({ status }: { status: string }) {
  const t = useTranslations("enums.studentStatus");
  return <Badge className={cn(STYLES[status])}>{t(status as "ACTIVE")}</Badge>;
}

export function GroupStatusBadge({ status }: { status: string }) {
  const t = useTranslations("enums.groupStatus");
  return <Badge className={cn(STYLES[status])}>{t(status as "ACTIVE")}</Badge>;
}
