"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPhone } from "@/lib/format";
import { purgeLeads, restoreLeads } from "../archive-actions";

type Row = { id: string; name: string; phone: string; section: string; reason: string; note: string; archivedBy: string; archivedAt: string };

export function ArchiveTable({ rows, canRestore, canPurge }: { rows: Row[]; canRestore: boolean; canPurge: boolean }) {
  const t = useTranslations("lead.arch.page");
  const tc = useTranslations("common");
  const router = useRouter();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [pending, startTransition] = useTransition();

  const ids = [...selected].filter((id) => rows.some((r) => r.id === id));
  const allOn = rows.length > 0 && ids.length === rows.length;
  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const run = (fn: () => Promise<{ ok: boolean; error?: string; count?: number }>, okKey: "restored" | "purged") =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(t(okKey, { count: res.count ?? 0 }));
        setSelected(new Set());
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  if (rows.length === 0) return <EmptyState title={t("empty")} />;

  return (
    <div className="flex flex-col gap-3">
      {ids.length > 0 && (
        <div className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <span className="font-medium">{t("selected", { count: ids.length })}</span>
          <span className="ml-auto flex gap-2">
            {canRestore && (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => restoreLeads(ids), "restored")}>
                <RotateCcw className="size-4" /> {t("restore")}
              </Button>
            )}
            {canPurge && (
              <Button size="sm" variant="destructive" disabled={pending} onClick={() => setConfirmPurge(true)}>
                <Trash2 className="size-4" /> {t("purge")}
              </Button>
            )}
          </span>
        </div>
      )}
      <div className="bg-card overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allOn} onCheckedChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())} aria-label="all" />
              </TableHead>
              <TableHead className="w-10">{t("no")}</TableHead>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("section")}</TableHead>
              <TableHead>{t("phone")}</TableHead>
              <TableHead>{t("reason")}</TableHead>
              <TableHead>{t("note")}</TableHead>
              <TableHead>{t("archived")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} aria-label={r.name} />
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-muted-foreground">{r.section}</TableCell>
                <TableCell className="tabular-nums">{formatPhone(r.phone)}</TableCell>
                <TableCell>{r.reason}</TableCell>
                <TableCell className="text-muted-foreground max-w-56 truncate" title={r.note}>
                  {r.note}
                </TableCell>
                <TableCell className="text-xs">
                  <div className="text-muted-foreground">{r.archivedBy}</div>
                  <div className="tabular-nums">{r.archivedAt}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ConfirmDialog
        open={confirmPurge}
        onOpenChange={setConfirmPurge}
        title={t("purge")}
        description={t("purgeConfirm", { count: ids.length })}
        confirmLabel={t("purge")}
        destructive
        onConfirm={() => {
          setConfirmPurge(false);
          run(() => purgeLeads(ids), "purged");
        }}
      />
    </div>
  );
}
