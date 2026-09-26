"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { createReason, renameReason, setReasonActive } from "../archive-actions";
import { NameDialog } from "../name-dialog";

type Reason = { id: string; name: string; isActive: boolean; createdBy: string };

export function ReasonsManager({ reasons, canConfigure }: { reasons: Reason[]; canConfigure: boolean }) {
  const t = useTranslations("lead.arch.reasons");
  const tc = useTranslations("common");
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [dialog, setDialog] = useState<{ id?: string; name?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = reasons.filter((r) => r.isActive === (tab === "active"));

  const toggleActive = (r: Reason) =>
    startTransition(async () => {
      const res = await setReasonActive(r.id, !r.isActive);
      if (res.ok) {
        toast.success(tc("saved"));
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon-sm" nativeButton={false} render={<Link href="/leads/archive" />} aria-label={tc("back")}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        {canConfigure && (
          <Button className="ml-auto" size="sm" onClick={() => setDialog({})}>
            <Plus className="size-4" /> {t("add")}
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-sm">{t("hint")}</p>

      <div className="bg-muted inline-flex w-fit gap-1 rounded-lg p-1" role="tablist">
        {(["active", "inactive"] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("rounded-md px-3 py-1 text-sm", tab === k ? "bg-background font-medium shadow-xs" : "text-muted-foreground")}>
            {t(k)}
          </button>
        ))}
      </div>

      <div className="bg-card overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">№</TableHead>
              <TableHead>{t("name")}</TableHead>
              {canConfigure && <TableHead className="text-right">{t("actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground py-6 text-center">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {visible.map((r, i) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                {canConfigure && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" aria-label={t("edit")} title={t("edit")} onClick={() => setDialog({ id: r.id, name: r.name })}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => toggleActive(r)}>
                      {r.isActive ? t("deactivate") : t("activate")}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {dialog && (
        <NameDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={dialog.id ? t("editTitle") : t("addTitle")}
          initial={dialog.name ?? ""}
          submitLabel={tc("save")}
          onSubmit={async (name) => {
            const res = dialog.id ? await renameReason(dialog.id, name) : await createReason(name);
            if (!res.ok && res.error === "duplicate") toast.error(t("duplicate"));
            return res;
          }}
        />
      )}
    </div>
  );
}
