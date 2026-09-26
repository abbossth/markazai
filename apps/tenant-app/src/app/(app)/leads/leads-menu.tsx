"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Archive, Download, FileUp, MoreHorizontal, Tag, ClipboardList, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ImportDialog } from "./import-dialog";

/** Lidlar sahifasining "⋯" menyusi: arxiv, Excel import/export, teglar, shakllar, arxivlash sabablari. */
export function LeadsMenu({ canImport, canConfigure, canSettings }: { canImport: boolean; canConfigure: boolean; canSettings: boolean }) {
  const t = useTranslations("lead.arch.menu");
  const [importOpen, setImportOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label={t("more")} title={t("more")} />}>
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem render={<Link href="/leads/archive" />}>
            <Archive /> {t("archive")}
          </DropdownMenuItem>
          {canImport && (
            <DropdownMenuItem onClick={() => setImportOpen(true)}>
              <FileUp /> {t("import")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem render={<a href="/leads/export" download />}>
            <Download /> {t("export")}
          </DropdownMenuItem>
          {(canSettings || canConfigure) && <DropdownMenuSeparator />}
          {canSettings && (
            <>
              <DropdownMenuItem render={<Link href="/settings/tags" />}>
                <Tag /> {t("tags")}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings/lead-form" />}>
                <ClipboardList /> {t("forms")}
              </DropdownMenuItem>
            </>
          )}
          {canConfigure && (
            <DropdownMenuItem render={<Link href="/leads/reasons" />}>
              <Ban /> {t("reasons")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {canImport && <ImportDialog open={importOpen} onOpenChange={setImportOpen} />}
    </>
  );
}
