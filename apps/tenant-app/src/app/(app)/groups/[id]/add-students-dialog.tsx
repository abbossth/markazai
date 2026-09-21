"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { toast } from "sonner";
import { toISODate } from "@markazai/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhone } from "@/lib/format";
import { addStudentsToGroup } from "../../students/actions";
import { searchStudentsForGroup } from "./actions";

type Candidate = { id: string; name: string; phone: string };

export function AddStudentsDialog({ open, onOpenChange, groupId }: { open: boolean; onOpenChange: (open: boolean) => void; groupId: string }) {
  const t = useTranslations("group");
  const ts = useTranslations("student");
  const tc = useTranslations("common");
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [picked, setPicked] = useState<Candidate[]>([]);
  const [joinedAt, setJoinedAt] = useState(() => toISODate(new Date()));
  const [pending, startTransition] = useTransition();

  // Qidiruv so'rovi (debounce 250ms); natijalar server action'dan keladi.
  useEffect(() => {
    if (q.trim().length < 2) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      const found = await searchStudentsForGroup(groupId, q);
      if (!cancelled) setResults(found);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [q, groupId]);

  const shown = q.trim().length < 2 ? [] : results.filter((r) => !picked.some((p) => p.id === r.id));

  const submit = () =>
    startTransition(async () => {
      const res = await addStudentsToGroup(
        picked.map((p) => p.id),
        groupId,
        joinedAt,
      );
      if (!res.ok) return void toast.error(res.error === "groupInactive" ? ts("groupInactive") : res.error === "forbidden" ? tc("forbidden") : tc("error"));
      toast.success(ts("addedToGroup", { added: res.added, skipped: res.skipped }));
      if (res.overCapacity) toast.warning(ts("overCapacity"));
      setPicked([]);
      setQ("");
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addStudents")}</DialogTitle>
          <DialogDescription>{t("addStudentsHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ts("searchPlaceholder")} autoFocus />
          {shown.length > 0 && (
            <ul className="max-h-48 divide-y overflow-auto rounded-lg border">
              {shown.map((r) => (
                <li key={r.id}>
                  <button type="button" className="hover:bg-muted flex w-full items-center justify-between px-3 py-2 text-left text-sm" onClick={() => setPicked((p) => [...p, r])}>
                    <span>{r.name}</span>
                    <span className="text-muted-foreground text-xs">{formatPhone(r.phone)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {picked.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {picked.map((p) => (
                <span key={p.id} className="bg-secondary inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs">
                  {p.name}
                  <button type="button" aria-label={tc("delete")} onClick={() => setPicked((x) => x.filter((y) => y.id !== p.id))} className="hover:bg-muted rounded-full p-0.5">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="join-date">{ts("joinedAt")}</Label>
            <Input id="join-date" type="date" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button disabled={picked.length === 0 || pending} onClick={submit}>
            {tc("add")} ({picked.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
