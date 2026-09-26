"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bell, Eye, EyeOff, FolderPlus, Lock, LockOpen, MoreHorizontal, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { LEAD_SOURCES } from "@markazai/types";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatPhone, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createColumn, deleteColumn, deleteLead, deleteList, moveLead, renameColumn, setListLocked } from "./actions";
import { LeadSheet, type EditableLead } from "./lead-form";
import { ListDialog, type ListDialogState } from "./list-dialog";
import { NameDialog } from "./name-dialog";
import { useLocalSet } from "@/hooks/use-local-set";
import { PROTECTED_COLUMN_COUNT, containerId, parseContainer } from "./container";
import type { BoardColumn, BoardLookups, LeadCardData } from "./queries";

// Ustun tepasidagi rang chizig'i (dekorativ).
const COLUMN_ACCENT = ["border-t-brand-500", "border-t-amber-500", "border-t-emerald-500", "border-t-violet-500"];

type Props = {
  columns: BoardColumn[];
  cards: Record<string, LeadCardData>;
  containers: Record<string, string[]>;
  lookups: BoardLookups;
  canWrite: boolean;
  canDelete: boolean;
  canConfigure: boolean;
};

type NameDialogState = { kind: "newColumn" } | { kind: "renameColumn"; id: string; name: string };

type ConfirmState = { kind: "deleteColumn"; id: string; name: string } | { kind: "deleteList"; id: string; name: string } | { kind: "deleteLead"; id: string; name: string };

export function Board({ columns, cards, containers: initialContainers, lookups, canWrite, canDelete, canConfigure }: Props) {
  const t = useTranslations("lead");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const router = useRouter();
  const [containers, setContainers] = useState(initialContainers);
  // Server yangi ma'lumot yuborganda (revalidate/refresh) lokal holat serverniki bilan almashtiriladi.
  const [seen, setSeen] = useState(initialContainers);
  if (initialContainers !== seen) {
    setSeen(initialContainers);
    setContainers(initialContainers);
  }

  const [activeId, setActiveId] = useState<string | null>(null);
  const snapshot = useRef(containers);
  const [, startTransition] = useTransition();

  const [sheet, setSheet] = useState<{ lead?: EditableLead; columnId?: string; listId?: string } | null>(null);
  const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null);
  const [listDialog, setListDialog] = useState<ListDialogState | null>(null);
  // Ochiq (ko'rinadigan) ro'yxatlar brauzerda saqlanadi; sukut bo'yicha hammasi yopiq.
  const [openLists, toggleList] = useLocalSet("markazai.leadListsOpen");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const sensors = useSensors(
    // 5px dan keyin sudrash boshlanadi — oddiy bosish (havola/menyu) buzilmaydi.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findContainer = (id: string, state = containers) => (id in state ? id : Object.keys(state).find((k) => state[k]!.includes(id)));

  const onDragStart = (e: DragStartEvent) => {
    snapshot.current = containers;
    setActiveId(String(e.active.id));
  };

  // Karta boshqa konteynerga o'tganda ro'yxatlar darhol yangilanadi (jonli ko'rinish).
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = findContainer(String(active.id));
    const to = findContainer(String(over.id));
    if (!from || !to || from === to) return;

    setContainers((prev) => {
      const target = prev[to]!;
      const overIndex = String(over.id) in prev ? target.length : target.indexOf(String(over.id));
      const insertAt = overIndex < 0 ? target.length : overIndex;
      return {
        ...prev,
        [from]: prev[from]!.filter((id) => id !== active.id),
        [to]: [...target.slice(0, insertAt), String(active.id), ...target.slice(insertAt)],
      };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const id = String(active.id);
    const container = findContainer(id);
    if (!over || !container) {
      setContainers(snapshot.current);
      return;
    }

    let final = containers;
    const overContainer = findContainer(String(over.id));
    if (overContainer === container && String(over.id) !== container) {
      const list = containers[container]!;
      const oldIndex = list.indexOf(id);
      const newIndex = list.indexOf(String(over.id));
      if (oldIndex !== newIndex) {
        final = { ...containers, [container]: arrayMove(list, oldIndex, newIndex) };
        setContainers(final);
      }
    }

    const order = final[container]!;
    const before = snapshot.current[container] ?? [];
    // O'zgarish bo'lmagan bo'lsa (o'sha joyga tashlandi) — serverga murojaat qilinmaydi.
    if (before.length === order.length && before.every((x, i) => x === order[i])) return;

    const beforeLeadId = order[order.indexOf(id) + 1] ?? null;
    const { columnId, listId } = parseContainer(container);
    startTransition(async () => {
      const res = await moveLead(id, columnId, listId, beforeLeadId);
      if (!res.ok) {
        setContainers(snapshot.current);
        toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
      }
    });
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        onOk?.();
        router.refresh();
      } else toast.error(errorMessage(res.error));
    });

  const errorMessage = (error?: string) =>
    error === "forbidden" ? tc("forbidden") : error === "columnNotEmpty" ? t("columnNotEmpty") : error === "lastColumn" ? t("lastColumn") : error === "locked" ? t("listLocked") : tc("error");

  const confirmAction = () => {
    if (!confirm) return;
    const c = confirm;
    setConfirm(null);
    run(
      () => (c.kind === "deleteColumn" ? deleteColumn(c.id) : c.kind === "deleteList" ? deleteList(c.id) : deleteLead(c.id)),
      () => toast.success(tc("deleted")),
    );
  };

  const toEditable = (card: LeadCardData): EditableLead => {
    const { columnId, listId } = parseContainer(findContainer(card.id) ?? "");
    return {
      id: card.id,
      name: card.name,
      phone: card.phone,
      source: card.source,
      columnId,
      listId,
      note: card.note,
      assignedToId: card.assignedToId,
      courseId: card.courseId,
      daysPattern: card.daysPattern,
      tagIds: card.tags.map((x) => x.id),
    };
  };

  const activeCard = activeId ? cards[activeId] : null;
  const total = Object.values(containers).reduce((n, ids) => n + ids.length, 0);

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">{t("total", { count: total })}</span>
        {canConfigure && (
          <Button variant="outline" size="sm" onClick={() => setNameDialog({ kind: "newColumn" })}>
            <Plus className="size-4" />
            {t("newColumn")}
          </Button>
        )}
      </div>

      <DndContext id="lead-board" sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setActiveId(null); setContainers(snapshot.current); }}>
        <div className="flex items-start gap-4 overflow-x-auto pb-4">
          {columns.map((column, index) => {
            const listIds = column.lists.map((l) => containerId(column.id, l.id));
            const rootIds = containers[containerId(column.id, null)] ?? [];
            const total = [containerId(column.id, null), ...listIds].reduce((n, c) => n + (containers[c]?.length ?? 0), 0);
            const shown = rootIds.length + column.lists.reduce((n, l) => n + (openLists.has(l.id) ? (containers[containerId(column.id, l.id)]?.length ?? 0) : 0), 0);
            return (
              <section key={column.id} className={cn("bg-card/60 flex w-80 shrink-0 flex-col rounded-2xl border border-t-[3px] shadow-xs", COLUMN_ACCENT[index % COLUMN_ACCENT.length])} aria-label={column.name}>
                <header className="flex items-center gap-1 px-3 pt-3 pb-2">
                  <h2 className="min-w-0 flex-1 truncate text-xs font-semibold tracking-wider uppercase">
                    {column.name} <span className="text-muted-foreground font-normal tabular-nums">({shown} / {total})</span>
                  </h2>
                  {canConfigure && (
                    <Button variant="ghost" size="icon-sm" aria-label={t("newList")} title={t("newList")} onClick={() => setListDialog({ columnId: column.id })}>
                      <FolderPlus className="size-4" />
                    </Button>
                  )}
                  {canConfigure && (
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={tc("actions")} />}>
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setNameDialog({ kind: "renameColumn", id: column.id, name: column.name })}>{t("renameColumn")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setListDialog({ columnId: column.id })}>
                          <FolderPlus /> {t("newList")}
                        </DropdownMenuItem>
                        {index >= PROTECTED_COLUMN_COUNT && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setConfirm({ kind: "deleteColumn", id: column.id, name: column.name })}>{tc("delete")}</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </header>

                {index === 0 && canWrite && (
                  <div className="px-2 pb-2">
                    <Button className="w-full" onClick={() => setSheet({ columnId: column.id })}>
                      <UserPlus className="size-4" />
                      {t("newLead")}
                    </Button>
                  </div>
                )}

                <div className="flex max-h-[calc(100vh-15rem)] flex-col gap-3 overflow-y-auto px-2 pb-2">
                  {column.lists.map((list) => {
                    const cid = containerId(column.id, list.id);
                    const ids = containers[cid] ?? [];
                    const open = openLists.has(list.id);
                    return (
                      <div key={list.id} className="bg-muted/40 flex flex-col gap-2 rounded-xl border p-2">
                        <div className="flex items-start gap-1 px-1">
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1 text-sm font-medium">
                              {list.isLocked && <Lock className="text-muted-foreground size-3 shrink-0" aria-label={t("listLocked")} />}
                              <span className="truncate">{list.name}</span>
                            </p>
                      {column.isSet && (list.courseId || list.teacherId || list.daysPattern || list.startTime) && (
                        <p className="text-muted-foreground truncate text-xs">
                          {[
                            lookups.courses.find((c) => c.id === list.courseId)?.name,
                            lookups.teachers.find((x) => x.id === list.teacherId)?.name,
                            list.daysPattern ? te(`days.${list.daysPattern}`) : null,
                            list.startTime,
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                      )}
                          </div>
                          <Button variant="ghost" size="icon-xs" aria-pressed={open} aria-label={open ? t("hideList") : t("showList")} title={open ? t("hideList") : t("showList")} onClick={() => toggleList(list.id)}>
                            {/* Belgi bosilganda bo'ladigan amalni ko'rsatadi: ochiq ro'yxatda "yashirish", yopiqda "ko'rsatish". */}
                            {open ? <EyeOff /> : <Eye />}
                          </Button>
                        {canConfigure && (
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={tc("actions")} />}>
                              <MoreHorizontal />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem disabled={list.isLocked} onClick={() => setListDialog({ columnId: column.id, list })}>{tc("edit")}</DropdownMenuItem>
                              {column.isSet && (
                              <DropdownMenuItem
                                onClick={() => {
                                  const q = new URLSearchParams({ new: "1", name: list.name });
                                  if (list.courseId) q.set("courseId", list.courseId);
                                  if (list.teacherId) q.set("teacherId", list.teacherId);
                                  if (list.daysPattern) q.set("days", list.daysPattern);
                                  if (list.startTime) q.set("startTime", list.startTime);
                                  router.push(`/groups?${q}`);
                                }}
                              >
                                {t("createGroup")}
                              </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => run(() => setListLocked(list.id, !list.isLocked))}>
                                {list.isLocked ? <LockOpen /> : <Lock />} {list.isLocked ? t("unlockList") : t("lockList")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" disabled={list.isLocked} onClick={() => setConfirm({ kind: "deleteList", id: list.id, name: list.name })}>{tc("delete")}</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        </div>
                        <Container id={cid} ids={ids} cards={cards} collapsed={!open} canWrite={canWrite} canDelete={canDelete} onEdit={(c) => setSheet({ lead: toEditable(c) })} onDelete={(c) => setConfirm({ kind: "deleteLead", id: c.id, name: c.name })} />
                        <p className="bg-background/70 text-muted-foreground rounded-md py-1 text-center text-xs font-medium tabular-nums">
                          {open ? ids.length : 0} / {ids.length}
                        </p>
                      </div>
                    );
                  })}
                  <Container id={containerId(column.id, null)} ids={containers[containerId(column.id, null)] ?? []} cards={cards} canWrite={canWrite} canDelete={canDelete} onEdit={(c) => setSheet({ lead: toEditable(c) })} onDelete={(c) => setConfirm({ kind: "deleteLead", id: c.id, name: c.name })} />
                </div>
              </section>
            );
          })}
        </div>

        <DragOverlay>{activeCard ? <CardView card={activeCard} overlay /> : null}</DragOverlay>
      </DndContext>

      {sheet && <LeadSheet open onOpenChange={(o) => !o && setSheet(null)} lookups={lookups} lead={sheet.lead} defaultColumnId={sheet.columnId} defaultListId={sheet.listId} />}

      {listDialog && <ListDialog state={listDialog} onClose={() => setListDialog(null)} lookups={lookups} withGroup={!!columns.find((c) => c.id === listDialog.columnId)?.isSet} />}

      {nameDialog && (
        <NameDialog
          key={JSON.stringify(nameDialog)}
          open
          onOpenChange={(o) => !o && setNameDialog(null)}
          title={nameDialog.kind === "newColumn" ? t("newColumn") : t("renameColumn")}
          initial={nameDialog.kind === "renameColumn" ? nameDialog.name : ""}
          submitLabel={tc("save")}
          onSubmit={(name) =>
            nameDialog.kind === "newColumn" ? createColumn(name) : renameColumn(nameDialog.id, name)
          }
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? t("deleteTitle", { name: confirm.name }) : ""}
        description={confirm?.kind === "deleteList" ? t("deleteListHint") : tc("confirmDelete")}
        confirmLabel={tc("delete")}
        destructive
        onConfirm={confirmAction}
      />
    </>
  );
}

function Container({ id, ids, cards, collapsed = false, canWrite, canDelete, onEdit, onDelete }: { id: string; ids: string[]; cards: Record<string, LeadCardData>; collapsed?: boolean; canWrite: boolean; canDelete: boolean; onEdit: (c: LeadCardData) => void; onDelete: (c: LeadCardData) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <SortableContext id={id} items={ids} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className={cn("flex flex-col gap-2 rounded-lg p-0.5 transition-all", collapsed ? "min-h-1" : "min-h-10", isOver && (collapsed || ids.length === 0) && "bg-primary/10 min-h-10", !collapsed && ids.length === 0 && "border border-dashed")}>
        {!collapsed && ids.map((leadId) => {
          const card = cards[leadId];
          return card ? <SortableCard key={leadId} card={card} canWrite={canWrite} canDelete={canDelete} onEdit={onEdit} onDelete={onDelete} /> : null;
        })}
      </div>
    </SortableContext>
  );
}

function SortableCard({ card, canWrite, canDelete, onEdit, onDelete }: { card: LeadCardData; canWrite: boolean; canDelete: boolean; onEdit: (c: LeadCardData) => void; onDelete: (c: LeadCardData) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, disabled: !canWrite });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && "opacity-40")} {...attributes} {...listeners}>
      <CardView card={card} canWrite={canWrite} canDelete={canDelete} onEdit={() => onEdit(card)} onDelete={() => onDelete(card)} />
    </div>
  );
}

function CardView({ card, overlay, canWrite, canDelete, onEdit, onDelete }: { card: LeadCardData; overlay?: boolean; canWrite?: boolean; canDelete?: boolean; onEdit?: () => void; onDelete?: () => void }) {
  const t = useTranslations("lead");
  const tc = useTranslations("common");
  const te = useTranslations("enums.leadSource");
  const source = LEAD_SOURCES.find((s) => s.value === card.source);
  const d = new Date(card.createdAt);
  const date = `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <article className={cn("bg-card hover:border-primary/30 flex gap-2.5 rounded-xl border p-2.5 text-sm shadow-xs transition-shadow hover:shadow-sm", overlay && "shadow-lg ring-2 ring-primary/40")}>
      <span className="bg-brand-500/10 text-brand-500 mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold" aria-hidden>
        {initials(card.name)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start gap-1">
          {/* py-1 — teginish nishoni kamida 24px balandlikda bo'lishi uchun (WCAG 2.5.8). */}
          <Link href={`/leads/${card.id}`} className="min-w-0 flex-1 truncate py-0.5 font-medium hover:underline" onPointerDown={(e) => e.stopPropagation()}>
            {card.name}
          </Link>
          {!overlay && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={tc("actions")} onPointerDown={(e) => e.stopPropagation()} />}>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem render={<Link href={`/leads/${card.id}`} />}>{t("open")}</DropdownMenuItem>
                {canWrite && <DropdownMenuItem onClick={onEdit}>{tc("edit")}</DropdownMenuItem>}
                <DropdownMenuItem render={<Link href={`/leads/${card.id}?tab=sms`} />}>{t("menu.sms")}</DropdownMenuItem>
                <DropdownMenuItem render={<Link href={`/leads/${card.id}?tab=comments`} />}>{t("menu.comment")}</DropdownMenuItem>
                <DropdownMenuItem render={<Link href={`/leads/${card.id}?tab=calls`} />}>{t("menu.call")}</DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={onDelete}>{tc("delete")}</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <span className="text-muted-foreground text-xs tabular-nums">{formatPhone(card.phone)}</span>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground tabular-nums">{date}</span>
          {source && (
            <Badge variant="outline" title={te(source.value)} className="px-1.5">
              {source.abbr}
            </Badge>
          )}
          {card.tags.length > 0 && <Badge variant="secondary" className="px-1.5">{card.tags[0]!.name}{card.tags.length > 1 ? ` +${card.tags.length - 1}` : ""}</Badge>}
          <span className="ml-auto flex items-center gap-1.5">
            {card.pendingReminders > 0 && (
              <span className={cn("inline-flex items-center gap-0.5", card.hasOverdue ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400")} title={card.hasOverdue ? t("overdue") : t("pending")}>
                <Bell className="size-3.5" /> {card.pendingReminders}
              </span>
            )}
            {card.assigneeName && (
              <span className="bg-muted flex size-5 items-center justify-center rounded-full text-[10px] font-medium" title={card.assigneeName}>
                {initials(card.assigneeName)}
              </span>
            )}
          </span>
        </div>
      </div>
    </article>
  );
}
