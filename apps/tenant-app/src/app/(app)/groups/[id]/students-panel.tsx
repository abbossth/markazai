"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Money } from "@/components/shared/money";
import { StudentQuickCard, type QuickCardStudent } from "@/components/shared/student-quick-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { JoinDateDialog } from "@/components/shared/join-date-dialog";
import { addStudentsToGroup, removeStudentFromGroup } from "../../students/actions";

export type PanelStudent = QuickCardStudent & { archived: boolean; joinedAt: string };

export function GroupStudentsPanel({ groupId, students, canWrite }: { groupId: string; students: PanelStudent[]; canWrite: boolean }) {
  const t = useTranslations("group");
  const ts = useTranslations("student");
  const tc = useTranslations("common");
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<PanelStudent | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = students.filter((s) => s.archived === showArchived);
  const archivedCount = students.filter((s) => s.archived).length;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(tc("saved"));
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {t("studentsList")} <span className="text-muted-foreground font-normal">({students.length - archivedCount})</span>
        </h2>
        {archivedCount > 0 && (
          <div className="flex items-center gap-2">
            <Checkbox id="archived" checked={showArchived} onCheckedChange={(v) => setShowArchived(!!v)} />
            <Label htmlFor="archived" className="text-xs font-normal">
              {t("showArchived", { count: archivedCount })}
            </Label>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground py-4 text-sm">{t("noStudents")}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {visible.map((s) => (
            <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <div className="flex min-w-0 flex-1 flex-col">
                <StudentQuickCard student={s} />
                {s.balance !== null && (
                  <span className="flex items-center gap-1.5 text-xs">
                    <Money value={s.balance} />
                    {s.balance < 0 && <Badge variant="destructive">{ts("debtor")}</Badge>}
                  </span>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" disabled={pending} aria-label={tc("actions")} />}>
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem render={<Link href={`/students/${s.id}`} />}>{ts("goToProfile")}</DropdownMenuItem>
                  {canWrite && <DropdownMenuItem onClick={() => setEditing(s)}>{ts("editJoinDate")}</DropdownMenuItem>}
                  {canWrite &&
                    (s.archived ? (
                      <DropdownMenuItem onClick={() => run(() => addStudentsToGroup([s.id], groupId))}>{t("restoreStudent")}</DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem variant="destructive" onClick={() => run(() => removeStudentFromGroup(s.id, groupId))}>
                        {t("removeStudent")}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}
      {editing && <JoinDateDialog key={editing.id} studentId={editing.id} groupId={groupId} joinedAt={editing.joinedAt} open onOpenChange={(o) => !o && setEditing(null)} />}
    </div>
  );
}
