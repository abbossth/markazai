"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUrlState } from "./use-url-state";

export function Pagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const t = useTranslations("table");
  const { update } = useUrlState();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="text-muted-foreground flex items-center justify-between text-sm">
      <span>{t("range", { from, to, total })}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, { keepPage: true })} aria-label={t("prev")}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2">
          {page} / {pages}
        </span>
        <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => update({ page: String(page + 1) }, { keepPage: true })} aria-label={t("next")}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
