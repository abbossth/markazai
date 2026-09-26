"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DAYS_PATTERNS, type DaysPattern } from "@markazai/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createList, updateList } from "./actions";
import type { BoardLookups } from "./queries";

export type ListDialogState = {
  /** Yangi ro'yxat uchun ustun; tahrirlash uchun ro'yxat ID'si. */
  columnId?: string;
  list?: { id: string; name: string; courseId: string | null; teacherId: string | null; daysPattern: DaysPattern | null; startTime: string | null };
};

const selectClass = "border-input bg-background h-9 w-full rounded-md border px-2 text-sm";

/** "Yaratishni o'rnating" formasi: ro'yxat nomi + ixtiyoriy set ma'lumotlari (kurs, o'qituvchi, kunlar, boshlanish vaqti). */
export function ListDialog({ state, onClose, lookups }: { state: ListDialogState; onClose: () => void; lookups: BoardLookups }) {
  const t = useTranslations("lead");
  const te = useTranslations("enums");
  const tc = useTranslations("common");
  const router = useRouter();
  const l = state.list;
  const [name, setName] = useState(l?.name ?? "");
  const [courseId, setCourseId] = useState(l?.courseId ?? "");
  const [teacherId, setTeacherId] = useState(l?.teacherId ?? "");
  const [daysPattern, setDaysPattern] = useState<string>(l?.daysPattern ?? "");
  const [startTime, setStartTime] = useState(l?.startTime ?? "");
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const details = { courseId, teacherId, daysPattern, startTime } as Parameters<typeof createList>[2];
      const res = l ? await updateList(l.id, name.trim(), details) : await createList(state.columnId!, name.trim(), details);
      if (res.ok) {
        toast.success(tc("saved"));
        onClose();
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : res.error === "locked" ? tc("locked") : tc("error"));
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{l ? t("editList") : t("newList")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="list-name">{t("listName")}</Label>
            <Input id="list-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="list-course">{t("course")}</Label>
            <select id="list-course" className={selectClass} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">—</option>
              {lookups.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="list-teacher">{t("teacher")}</Label>
            <select id="list-teacher" className={selectClass} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">—</option>
              {lookups.teachers.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="list-days">{t("days")}</Label>
              <select id="list-days" className={selectClass} value={daysPattern} onChange={(e) => setDaysPattern(e.target.value)}>
                <option value="">—</option>
                {DAYS_PATTERNS.map((d) => (
                  <option key={d} value={d}>
                    {te(`days.${d}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="list-time">{t("startTime")}</Label>
              <Input id="list-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {l ? tc("save") : t("createList")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
