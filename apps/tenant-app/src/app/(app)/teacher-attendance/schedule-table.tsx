"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveTeacherSchedule } from "./actions";

export type ScheduleTeacher = {
  id: string;
  name: string;
  salaryType: "PERCENT" | "FIXED";
  workDays: number[];
  workStart: string | null;
  workEnd: string | null;
  fixedSalary: number | null;
  workStartDate: string | null;
};

/** "Ustozlar ish jadvali": har bir qator mustaqil tahrirlanadi va alohida saqlanadi. */
export function ScheduleTable({ teachers, canWrite, canSalary }: { teachers: ScheduleTeacher[]; canWrite: boolean; canSalary: boolean }) {
  const t = useTranslations("teacherAttendance");
  return (
    <div className="bg-card overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="px-3 py-2 font-medium">{t("teacher")}</th>
            <th className="px-3 py-2 font-medium">{t("workDays")}</th>
            <th className="px-3 py-2 font-medium">{t("workStart")}</th>
            <th className="px-3 py-2 font-medium">{t("workEnd")}</th>
            {canSalary && <th className="px-3 py-2 font-medium">{t("monthlySalary")}</th>}
            <th className="px-3 py-2 font-medium">{t("workStartDate")}</th>
            {canWrite && <th className="px-2" />}
          </tr>
        </thead>
        <tbody>
          {teachers.map((teacher) => (
            <ScheduleRow key={teacher.id} teacher={teacher} canWrite={canWrite} canSalary={canSalary} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScheduleRow({ teacher, canWrite, canSalary }: { teacher: ScheduleTeacher; canWrite: boolean; canSalary: boolean }) {
  const t = useTranslations("teacherAttendance");
  const tc = useTranslations("common");
  const tw = useTranslations("enums.weekdaysShort");
  const tv = useTranslations("validation");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [days, setDays] = useState(teacher.workDays);
  const [start, setStart] = useState(teacher.workStart ?? "");
  const [end, setEnd] = useState(teacher.workEnd ?? "");
  const [salary, setSalary] = useState(teacher.fixedSalary?.toString() ?? "");
  const [startDate, setStartDate] = useState(teacher.workStartDate ?? "");
  const [error, setError] = useState<string | null>(null);

  const dirty =
    days.join() !== teacher.workDays.join() ||
    start !== (teacher.workStart ?? "") ||
    end !== (teacher.workEnd ?? "") ||
    salary !== (teacher.fixedSalary?.toString() ?? "") ||
    startDate !== (teacher.workStartDate ?? "");

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await saveTeacherSchedule(teacher.id, {
        workDays: days,
        workStart: start,
        workEnd: end,
        fixedSalary: salary === "" ? undefined : Number(salary),
        workStartDate: startDate,
      });
      if (res.ok) {
        toast.success(tc("saved"));
        router.refresh();
      } else if (res.fieldErrors) {
        const first = Object.values(res.fieldErrors)[0];
        setError(first && tv.has(first as "required") ? tv(first as "required") : tv("invalid"));
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  return (
    <tr className="border-b align-top last:border-0">
      <td className="px-3 py-2">
        <div className="font-medium">{teacher.name}</div>
        <Badge variant="outline" className="mt-1">
          {teacher.salaryType === "PERCENT" ? t("modelPercent") : t("modelFixed")}
        </Badge>
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
            const on = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                disabled={!canWrite}
                aria-pressed={on}
                onClick={() => setDays((cur) => (on ? cur.filter((x) => x !== d) : [...cur, d].sort()))}
                className={cn("size-8 rounded-md border text-xs transition-colors", on ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted", !canWrite && "cursor-default")}
              >
                {tw(String(d) as "1")}
              </button>
            );
          })}
        </div>
      </td>
      <td className="px-3 py-2">
        <Input type="time" className="w-28" value={start} disabled={!canWrite} onChange={(e) => setStart(e.target.value)} />
      </td>
      <td className="px-3 py-2">
        <Input type="time" className="w-28" value={end} disabled={!canWrite} onChange={(e) => setEnd(e.target.value)} />
      </td>
      {canSalary && (
        <td className="px-3 py-2">
          <Input type="number" min={0} step={10000} className="w-36" value={salary} disabled={!canWrite || teacher.salaryType !== "FIXED"} onChange={(e) => setSalary(e.target.value)} />
        </td>
      )}
      <td className="px-3 py-2">
        <Input type="date" className="w-40" value={startDate} disabled={!canWrite} onChange={(e) => setStartDate(e.target.value)} />
      </td>
      {canWrite && (
        <td className="px-2 py-2">
          <Button size="sm" disabled={!dirty || pending} onClick={save}>
            {tc("save")}
          </Button>
          {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
        </td>
      )}
    </tr>
  );
}
