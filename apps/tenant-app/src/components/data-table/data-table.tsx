"use client";

import { useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Pagination } from "./pagination";
import { useUrlState } from "./use-url-state";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Server tomonidagi saralash kaliti (yo'q bo'lsa — saralanmaydi). */
    sortKey?: string;
    /** Ustunlar menyusida ko'rsatiladigan nom. */
    label?: string;
    /** Sukut bo'yicha yashirin. */
    hidden?: boolean;
    className?: string;
  }
}

// TanStack Table v8: accessor ustunlari turli TValue bilan aralashadi, shuning uchun any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyColumnDef<T> = ColumnDef<T, any>;

type Props<T> = {
  columns: AnyColumnDef<T>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  sort?: { key: string; dir: "asc" | "desc" };
  getRowId: (row: T) => string;
  /** Ustun ko'rinishi localStorage'da shu kalit bilan saqlanadi. */
  storageKey: string;
  selectable?: boolean;
  /** Tanlangan qatorlar uchun ommaviy amallar paneli. */
  bulkActions?: (selected: T[], clear: () => void) => React.ReactNode;
  /** Jadval tepasidagi o'ng tomon (masalan, "Ustunlar" yonidagi tugmalar). */
  toolbar?: React.ReactNode;
};

export function DataTable<T>({
  columns,
  data,
  total,
  page,
  pageSize,
  sort,
  getRowId,
  storageKey,
  selectable,
  bulkActions,
  toolbar,
}: Props<T>) {
  const t = useTranslations("table");
  const { update, pending } = useUrlState();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const initialVisibility = useMemo(() => {
    const v: VisibilityState = {};
    for (const c of columns) {
      const id = (c.id ?? (c as { accessorKey?: string }).accessorKey) as string | undefined;
      if (id && c.meta?.hidden) v[id] = false;
    }
    return v;
  }, [columns]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialVisibility);

  // Ustun sozlamalarini brauzerda eslab qolish (mavjud bo'lmasa — sukut bo'yicha).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`columns:${storageKey}`);
      if (saved) setColumnVisibility({ ...initialVisibility, ...JSON.parse(saved) });
    } catch {}
  }, [storageKey, initialVisibility]);

  const onVisibilityChange = (next: VisibilityState) => {
    setColumnVisibility(next);
    try {
      localStorage.setItem(`columns:${storageKey}`, JSON.stringify(next));
    } catch {}
  };

  const allColumns = useMemo<AnyColumnDef<T>[]>(() => {
    if (!selectable) return columns;
    const select: AnyColumnDef<T> = {
      id: "select",
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllRowsSelected()}
          indeterminate={table.getIsSomeRowsSelected()}
          onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
          aria-label={t("selectAll")}
        />
      ),
      cell: ({ row }) => (
        <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} aria-label={t("selectRow")} />
      ),
      meta: { className: "w-10" },
    };
    return [select, ...columns];
  }, [columns, selectable, t]);

  const table = useReactTable({
    data,
    columns: allColumns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: !!selectable,
    state: { rowSelection, columnVisibility },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: (u) => onVisibilityChange(typeof u === "function" ? u(columnVisibility) : u),
  });

  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const clearSelection = () => setRowSelection({});

  const toggleSort = (key: string) => {
    if (sort?.key !== key) return update({ sort: `${key}:asc` }, { keepPage: true });
    if (sort.dir === "asc") return update({ sort: `${key}:desc` }, { keepPage: true });
    update({ sort: undefined }, { keepPage: true });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {selected.length > 0 && bulkActions ? (
            <>
              <span className="text-muted-foreground text-sm">{t("selected", { count: selected.length })}</span>
              {bulkActions(selected, clearSelection)}
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {toolbar}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <Columns3 className="size-4" />
              {t("columns")}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((c) => (
                  <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)}>
                    {c.columnDef.meta?.label ?? (typeof c.columnDef.header === "string" ? c.columnDef.header : c.id)}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className={cn("bg-card rounded-lg border transition-opacity", pending && "opacity-60")}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const sortKey = h.column.columnDef.meta?.sortKey;
                  const active = sortKey && sort?.key === sortKey;
                  return (
                    <TableHead key={h.id} className={h.column.columnDef.meta?.className}>
                      {h.isPlaceholder ? null : sortKey ? (
                        <button type="button" onClick={() => toggleSort(sortKey)} className="hover:text-foreground -ml-1 inline-flex items-center gap-1 rounded px-1">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {active ? sort.dir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" /> : <ArrowUpDown className="text-muted-foreground/60 size-3.5" />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={allColumns.length} className="text-muted-foreground h-24 text-center">
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cell.column.columnDef.meta?.className}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination page={page} pageSize={pageSize} total={total} />
    </div>
  );
}
