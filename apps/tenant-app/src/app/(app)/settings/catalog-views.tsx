"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { courseSchema, holidaySchema, roomSchema, tagSchema, type CourseInput, type HolidayInput, type RoomInput, type TagInput } from "@markazai/types";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { addHolidays, deleteCourse, deleteHoliday, deleteRoom, deleteTag, restoreGroup, saveCourse, saveRoom, saveTag } from "./catalog-actions";
import { ColorPicker } from "./color-picker";

type Res = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

function useErr() {
  const tv = useTranslations("validation");
  return (m?: string) => (m ? (tv.has(m as "required") ? tv(m as "required") : tv("invalid")) : undefined);
}

/** Saqlash/o'chirish natijasini xabarga aylantiradi; maydon xatolari formaga qaytariladi. */
function useResultHandler(ns: "courses" | "rooms" | "tags" | "holidays" | "archive") {
  const t = useTranslations(`settings.${ns}`);
  const tc = useTranslations("common");
  const router = useRouter();
  return (res: Res, opts: { onOk?: () => void; onFieldError?: (name: string, message: string) => void } = {}) => {
    if (res.ok) {
      toast.success(tc("saved"));
      opts.onOk?.();
      router.refresh();
    } else if (res.fieldErrors && opts.onFieldError) {
      for (const [n, m] of Object.entries(res.fieldErrors)) opts.onFieldError(n, m);
    } else toast.error(res.error === "forbidden" ? tc("forbidden") : t.has(`errors.${res.error}` as "errors.inUse") ? t(`errors.${res.error}` as "errors.inUse") : tc("error"));
  };
}

function FormButtons({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  const tc = useTranslations("common");
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onCancel}>
        {tc("cancel")}
      </Button>
      <Button type="submit" disabled={pending}>
        {tc("save")}
      </Button>
    </DialogFooter>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete: () => void }) {
  const tc = useTranslations("common");
  return (
    <div className="flex justify-end gap-1">
      {onEdit && (
        <Button variant="ghost" size="icon-sm" aria-label={tc("edit")} onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" aria-label={tc("delete")} onClick={onDelete}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function useDelete(action: (id: string) => Promise<Res>, ns: Parameters<typeof useResultHandler>[0]) {
  const handle = useResultHandler(ns);
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = () =>
    startTransition(async () => {
      if (!target) return;
      handle(await action(target.id), { onOk: () => setTarget(null) });
      setTarget((cur) => (cur ? null : cur));
    });
  return { target, setTarget, pending, confirm };
}

// ───────────── Kurslar ─────────────

export type CourseItem = { id: string; name: string; price: number; durationMonths: number; color: string; groups: number };

export function CoursesView({ items }: { items: CourseItem[] }) {
  const t = useTranslations("settings.courses");
  const [editing, setEditing] = useState<CourseItem | "new" | null>(null);
  const del = useDelete(deleteCourse, "courses");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => (
            <div key={c.id} className="bg-card flex flex-col gap-3 rounded-lg border border-l-4 p-4" style={{ borderLeftColor: c.color }}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{c.name}</h3>
                <RowActions onEdit={() => setEditing(c)} onDelete={() => del.setTarget({ id: c.id, name: c.name })} />
              </div>
              <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span className="text-foreground font-medium tabular-nums">{formatMoney(c.price)}</span>
                <span>{t("months", { count: c.durationMonths })}</span>
                <span>{t("groups", { count: c.groups })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && <CourseDialog course={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!del.target} onOpenChange={(o) => !o && del.setTarget(null)} title={t("deleteTitle", { name: del.target?.name ?? "" })} destructive pending={del.pending} onConfirm={del.confirm} />
    </div>
  );
}

function CourseDialog({ course, onClose }: { course?: CourseItem; onClose: () => void }) {
  const t = useTranslations("settings.courses");
  const err = useErr();
  const handle = useResultHandler("courses");
  const [pending, startTransition] = useTransition();
  const { control, register, handleSubmit, setError, formState: { errors } } = useForm<CourseInput>({
    resolver: zodResolver(courseSchema),
    defaultValues: { name: course?.name ?? "", price: course?.price ?? (undefined as unknown as number), durationMonths: course?.durationMonths ?? 6, color: course?.color ?? "#2563eb" },
  });
  const submit = (v: CourseInput) => startTransition(async () => handle(await saveCourse(course?.id ?? null, v), { onOk: onClose, onFieldError: (n, m) => setError(n as keyof CourseInput, { message: m }) }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{course ? t("edit") : t("add")}</DialogTitle>
          </DialogHeader>
          <Field label={t("name")} error={err(errors.name?.message)}>
            <Input {...register("name")} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("price")} error={err(errors.price?.message)}>
              <Input type="number" min={0} step={10000} inputMode="numeric" {...register("price", { valueAsNumber: true })} />
            </Field>
            <Field label={t("duration")} error={err(errors.durationMonths?.message)}>
              <Input type="number" min={1} max={36} inputMode="numeric" {...register("durationMonths", { valueAsNumber: true })} />
            </Field>
          </div>
          <Field label={t("color")} error={err(errors.color?.message)}>
            <Controller control={control} name="color" render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />} />
          </Field>
          <FormButtons pending={pending} onCancel={onClose} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── Xonalar ─────────────

export type RoomItem = { id: string; name: string; capacity: number; groups: number };

export function RoomsView({ items }: { items: RoomItem[] }) {
  const t = useTranslations("settings.rooms");
  const [editing, setEditing] = useState<RoomItem | "new" | null>(null);
  const del = useDelete(deleteRoom, "rooms");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead className="text-right">{t("capacity")}</TableHead>
                <TableHead className="text-right">{t("groupsCol")}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.capacity}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.groups}</TableCell>
                  <TableCell>
                    <RowActions onEdit={() => setEditing(r)} onDelete={() => del.setTarget({ id: r.id, name: r.name })} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing && <RoomDialog room={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!del.target} onOpenChange={(o) => !o && del.setTarget(null)} title={t("deleteTitle", { name: del.target?.name ?? "" })} destructive pending={del.pending} onConfirm={del.confirm} />
    </div>
  );
}

function RoomDialog({ room, onClose }: { room?: RoomItem; onClose: () => void }) {
  const t = useTranslations("settings.rooms");
  const err = useErr();
  const handle = useResultHandler("rooms");
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, setError, formState: { errors } } = useForm<RoomInput>({ resolver: zodResolver(roomSchema), defaultValues: { name: room?.name ?? "", capacity: room?.capacity ?? 15 } });
  const submit = (v: RoomInput) => startTransition(async () => handle(await saveRoom(room?.id ?? null, v), { onOk: onClose, onFieldError: (n, m) => setError(n as keyof RoomInput, { message: m }) }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{room ? t("edit") : t("add")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("name")} error={err(errors.name?.message)}>
              <Input {...register("name")} autoFocus />
            </Field>
            <Field label={t("capacity")} error={err(errors.capacity?.message)}>
              <Input type="number" min={1} inputMode="numeric" {...register("capacity", { valueAsNumber: true })} />
            </Field>
          </div>
          <FormButtons pending={pending} onCancel={onClose} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── Teglar ─────────────

export type TagItem = { id: string; name: string; color: string | null; students: number; groups: number; leads: number };

export function TagsView({ items }: { items: TagItem[] }) {
  const t = useTranslations("settings.tags");
  const [editing, setEditing] = useState<TagItem | "new" | null>(null);
  const del = useDelete(deleteTag, "tags");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("usage")}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <span className="inline-flex items-center gap-2 font-medium">
                      <span className="size-3 rounded-full border" style={{ backgroundColor: g.color ?? "transparent" }} aria-hidden />
                      {g.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t("usageValue", { students: g.students, groups: g.groups, leads: g.leads })}</TableCell>
                  <TableCell>
                    <RowActions onEdit={() => setEditing(g)} onDelete={() => del.setTarget({ id: g.id, name: g.name })} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing && <TagDialog tag={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!del.target} onOpenChange={(o) => !o && del.setTarget(null)} title={t("deleteTitle", { name: del.target?.name ?? "" })} description={t("deleteHint")} destructive pending={del.pending} onConfirm={del.confirm} />
    </div>
  );
}

function TagDialog({ tag, onClose }: { tag?: TagItem; onClose: () => void }) {
  const t = useTranslations("settings.tags");
  const err = useErr();
  const handle = useResultHandler("tags");
  const [pending, startTransition] = useTransition();
  const { control, register, handleSubmit, setError, formState: { errors } } = useForm<TagInput>({ resolver: zodResolver(tagSchema), defaultValues: { name: tag?.name ?? "", color: tag?.color ?? "" } });
  const submit = (v: TagInput) => startTransition(async () => handle(await saveTag(tag?.id ?? null, v), { onOk: onClose, onFieldError: (n, m) => setError(n as keyof TagInput, { message: m }) }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{tag ? t("edit") : t("add")}</DialogTitle>
          </DialogHeader>
          <Field label={t("name")} error={err(errors.name?.message)}>
            <Input {...register("name")} autoFocus />
          </Field>
          <Field label={t("color")} error={err(errors.color?.message)}>
            <Controller control={control} name="color" render={({ field }) => <ColorPicker allowEmpty value={field.value ?? ""} onChange={field.onChange} />} />
          </Field>
          <FormButtons pending={pending} onCancel={onClose} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── Dam olish kunlari ─────────────

export type HolidayItem = { id: string; date: string; name: string; weekday: number };

export function HolidaysView({ items, year, today }: { items: HolidayItem[]; year: number; today: string }) {
  const t = useTranslations("settings.holidays");
  const tw = useTranslations("enums.weekdaysShort");
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const del = useDelete(deleteHoliday, "holidays");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => router.push(`/settings/holidays?year=${year - 1}`)}>
          ‹
        </Button>
        <span className="min-w-12 text-center font-medium tabular-nums">{year}</span>
        <Button variant="outline" size="sm" onClick={() => router.push(`/settings/holidays?year=${year + 1}`)}>
          ›
        </Button>
        <Button className="ml-auto" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">{t("hint")}</p>
      {items.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("name")}</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatDate(h.date)} <span className="text-muted-foreground">({tw(String(h.weekday) as "1")})</span>
                  </TableCell>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell>
                    <RowActions onDelete={() => del.setTarget({ id: h.id, name: h.name })} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {adding && <HolidayDialog today={today} onClose={() => setAdding(false)} />}
      <ConfirmDialog open={!!del.target} onOpenChange={(o) => !o && del.setTarget(null)} title={t("deleteTitle", { name: del.target?.name ?? "" })} description={t("deleteHint")} destructive pending={del.pending} onConfirm={del.confirm} />
    </div>
  );
}

function HolidayDialog({ today, onClose }: { today: string; onClose: () => void }) {
  const t = useTranslations("settings.holidays");
  const err = useErr();
  const handle = useResultHandler("holidays");
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, setError, formState: { errors } } = useForm<HolidayInput>({ resolver: zodResolver(holidaySchema), defaultValues: { from: today, to: today, name: "" } });
  const submit = (v: HolidayInput) => startTransition(async () => handle(await addHolidays(v), { onOk: onClose, onFieldError: (n, m) => setError(n as keyof HolidayInput, { message: m }) }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t("add")}</DialogTitle>
          </DialogHeader>
          <Field label={t("name")} error={err(errors.name?.message)}>
            <Input placeholder={t("namePlaceholder")} {...register("name")} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("from")} error={err(errors.from?.message)}>
              <Input type="date" {...register("from")} />
            </Field>
            <Field label={t("to")} error={err(errors.to?.message)}>
              <Input type="date" {...register("to")} />
            </Field>
          </div>
          <FormButtons pending={pending} onCancel={onClose} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── Arxiv ─────────────

export type ArchivedGroup = { id: string; name: string; courseName: string; teacherName: string; status: string; endDate: string | null; students: number };

export function ArchiveView({ groups }: { groups: ArchivedGroup[] }) {
  const t = useTranslations("settings.archive");
  const te = useTranslations("enums.groupStatus");
  const handle = useResultHandler("archive");
  const [pending, startTransition] = useTransition();
  if (groups.length === 0) return <EmptyState title={t("empty")} />;
  return (
    <div className="bg-card rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("group")}</TableHead>
            <TableHead>{t("course")}</TableHead>
            <TableHead>{t("teacher")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("endDate")}</TableHead>
            <TableHead className="text-right">{t("students")}</TableHead>
            <TableHead className="w-32" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((g) => (
            <TableRow key={g.id}>
              <TableCell className="font-medium">{g.name}</TableCell>
              <TableCell>{g.courseName}</TableCell>
              <TableCell>{g.teacherName}</TableCell>
              <TableCell>
                <Badge variant="outline">{te(g.status as "ARCHIVED")}</Badge>
              </TableCell>
              <TableCell>{g.endDate ? formatDate(g.endDate) : "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{g.students}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => handle(await restoreGroup(g.id)))}>
                  <RotateCcw className="size-4" />
                  {t("restore")}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
