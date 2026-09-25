"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, RefreshCw, RotateCcw, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { WIDGETS, toCenterParts, widgetDef, type LayoutItem, type WidgetSize } from "@markazai/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { resetDashboardLayout, saveDashboardLayout } from "./actions";
import type { DashboardData } from "./queries";
import { MetricWidget, PaymentsWidget, ScheduleWidget } from "./widgets";

// Tailwind to'liq sinf nomlarini ko'rishi uchun har bir o'lcham alohida yozilgan.
const SPAN: Record<WidgetSize, string> = {
  S: "col-span-1",
  M: "sm:col-span-2 xl:col-span-2",
  L: "sm:col-span-2 xl:col-span-3",
  XL: "sm:col-span-2 xl:col-span-4",
};

type Props = { layout: LayoutItem[]; allowed: string[]; data: DashboardData };

/**
 * Vidjetlar to'ri. "Sozlash" rejimida: sudrab tartiblash (tutqich yoki klaviatura), o'lcham (S/M/L/XL),
 * olib tashlash va "Vidjet qo'shish". Tartib foydalanuvchi bo'yicha saqlanadi.
 */
export function DashboardGrid({ layout: initial, allowed, data }: Props) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [layout, setLayout] = useState(initial);
  const [seen, setSeen] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  // Server yangi tartib yuborganda (saqlash/tiklashdan keyin) lokal holat almashtiriladi.
  if (initial !== seen) {
    setSeen(initial);
    setSaved(initial);
    setLayout(initial);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const dirty = JSON.stringify(layout) !== JSON.stringify(saved);
  const hidden = WIDGETS.filter((w) => allowed.includes(w.id) && !layout.some((l) => l.id === w.id));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setLayout((cur) => arrayMove(cur, cur.findIndex((i) => i.id === active.id), cur.findIndex((i) => i.id === over.id)));
  };

  const save = () =>
    startTransition(async () => {
      const res = await saveDashboardLayout(layout);
      if (res.ok) {
        toast.success(tc("saved"));
        setEditing(false);
        router.refresh();
      } else toast.error(tc("error"));
    });

  const reset = () =>
    startTransition(async () => {
      const res = await resetDashboardLayout();
      if (res.ok) {
        toast.success(t("resetDone"));
        setEditing(false);
        router.refresh();
      } else toast.error(tc("error"));
    });

  const cancel = () => {
    setLayout(saved);
    setEditing(false);
  };

  const renderWidget = (item: LayoutItem) => {
    const def = widgetDef(item.id);
    if (def?.kind === "metric") {
      const metric = data.metrics[item.id];
      return metric ? <MetricWidget id={item.id} metric={metric} edit={editing} /> : null;
    }
    if (item.id === "paymentsChart") return data.payments ? <PaymentsWidget points={data.payments} /> : null;
    if (item.id === "schedule") return data.schedule ? <ScheduleWidget groups={data.schedule} /> : null;
    return null;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-muted-foreground text-sm">{t("updatedAt", { time: toCenterParts(new Date(data.generatedAt)).time })}</p>
        <div className="ml-auto flex items-center gap-2">
          {editing ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={hidden.length === 0}>
                <Plus className="size-4" />
                {t("addWidget")}
              </Button>
              <Button size="sm" variant="ghost" onClick={reset} disabled={pending}>
                <RotateCcw className="size-4" />
                {t("reset")}
              </Button>
              <Button size="sm" variant="outline" onClick={cancel} disabled={pending}>
                {tc("cancel")}
              </Button>
              <Button size="sm" onClick={save} disabled={pending || !dirty}>
                {tc("save")}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => router.refresh()}>
                <RefreshCw className="size-4" />
                {t("refresh")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Settings2 className="size-4" />
                {t("customize")}
              </Button>
            </>
          )}
        </div>
      </div>

      {layout.length === 0 && (
        <div className="text-muted-foreground rounded-lg border border-dashed py-16 text-center text-sm">
          {t("emptyLayout")}
          {!editing && (
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                {t("customize")}
              </Button>
            </div>
          )}
        </div>
      )}

      <DndContext id="dashboard-grid" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={layout.map((l) => l.id)} strategy={rectSortingStrategy} disabled={!editing}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {layout.map((item) => (
              <WidgetFrame key={item.id} item={item} editing={editing} onSize={(size) => setLayout((cur) => cur.map((l) => (l.id === item.id ? { ...l, size } : l)))} onRemove={() => setLayout((cur) => cur.filter((l) => l.id !== item.id))}>
                {renderWidget(item)}
              </WidgetFrame>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addWidget")}</DialogTitle>
            <DialogDescription>{t("addWidgetHint")}</DialogDescription>
          </DialogHeader>
          <ul className="flex max-h-80 flex-col gap-1 overflow-auto">
            {hidden.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  className="hover:bg-muted flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm"
                  onClick={() => {
                    setLayout((cur) => [...cur, { id: w.id, size: w.defaultSize }]);
                    if (hidden.length === 1) setAdding(false);
                  }}
                >
                  {t(`widgets.${w.id}` as "widgets.groups")}
                  <Plus className="text-muted-foreground size-4" />
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WidgetFrame({ item, editing, onSize, onRemove, children }: { item: LayoutItem; editing: boolean; onSize: (size: WidgetSize) => void; onRemove: () => void; children: React.ReactNode }) {
  const t = useTranslations("dashboard");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !editing });
  const def = widgetDef(item.id);
  if (!children) return null;

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("bg-card relative rounded-lg border p-3", SPAN[item.size], editing && "ring-primary/30 pt-11 ring-1", isDragging && "z-10 opacity-70 shadow-lg")}
    >
      {editing && (
        <div className="bg-popover absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md border p-0.5 shadow-sm">
          <button type="button" className="text-muted-foreground hover:text-foreground cursor-grab rounded p-1 active:cursor-grabbing" aria-label={t("drag")} {...attributes} {...listeners}>
            <GripVertical className="size-4" />
          </button>
          <div className="flex" role="group" aria-label={t("size")}>
            {def?.sizes.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={item.size === s}
                onClick={() => onSize(s)}
                className={cn("rounded px-1.5 py-0.5 text-xs font-medium", item.size === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
              >
                {s}
              </button>
            ))}
          </div>
          <button type="button" className="text-muted-foreground hover:text-destructive rounded p-1" aria-label={t("removeWidget")} onClick={onRemove}>
            <X className="size-4" />
          </button>
        </div>
      )}
      {children}
    </section>
  );
}
