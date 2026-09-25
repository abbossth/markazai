"use client";

import { useMemo, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, FileSpreadsheet, KeyRound, Mail, MoreHorizontal, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PRIVILEGED_ROLES, ROLES, canManageRoles, staffSchema, type StaffInput, type StaffOutput } from "@markazai/types";
import { DataTable, type AnyColumnDef } from "@/components/data-table/data-table";
import { PhoneInput } from "@/components/layout/phone-input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field } from "@/components/shared/form-field";
import { PasswordInput } from "@/components/shared/password-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { formatPhone } from "@/lib/format";
import { deleteStaff, importStaff, resetStaffPassword, saveStaff, type ImportResult } from "./actions";
import type { StaffRow } from "./queries";

type Branch = { id: string; name: string };

function useErrText() {
  const tv = useTranslations("validation");
  return (m?: string) => (m ? (tv.has(m as "required") ? tv(m as "required") : tv("invalid")) : undefined);
}

function useActionError() {
  const t = useTranslations("settings.staff.errors");
  const tc = useTranslations("common");
  return (code: string) => (code === "forbidden" ? tc("forbidden") : t.has(code as "lastCeo") ? t(code as "lastCeo") : tc("error"));
}

const copy = (text: string, done: string) => navigator.clipboard?.writeText(text).then(() => toast.success(done));

type TableProps = { rows: StaffRow[]; total: number; page: number; pageSize: number; sort?: { key: string; dir: "asc" | "desc" }; branches: Branch[]; canGrantPrivileged: boolean; meId: string; actorRoles: string[] };

export function StaffTable({ rows, total, page, pageSize, sort, branches, canGrantPrivileged, meId, actorRoles }: TableProps) {
  const t = useTranslations("settings.staff");
  const te = useTranslations("enums.roles");
  const tc = useTranslations("common");
  const router = useRouter();
  const actionError = useActionError();
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [deleting, setDeleting] = useState<StaffRow | null>(null);
  const [resetting, setResetting] = useState<StaffRow | null>(null);
  const [newPassword, setNewPassword] = useState<{ name: string; password: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const doDelete = () =>
    startTransition(async () => {
      if (!deleting) return;
      const res = await deleteStaff(deleting.id);
      if (res.ok) {
        toast.success(tc("deleted"));
        setDeleting(null);
        router.refresh();
      } else toast.error(actionError(res.error));
    });

  const doReset = () =>
    startTransition(async () => {
      if (!resetting) return;
      const res = await resetStaffPassword(resetting.id);
      if (res.ok) {
        setNewPassword({ name: resetting.name, password: res.password });
        setResetting(null);
      } else toast.error(actionError(res.error));
    });

  const columns = useMemo<AnyColumnDef<StaffRow>[]>(
    () => [
      { id: "id", header: t("columns.id"), meta: { label: t("columns.id"), className: "w-24" }, cell: ({ row }) => <span className="text-muted-foreground font-mono text-xs">{row.original.id.slice(0, 8)}</span> },
      { id: "name", header: t("columns.name"), meta: { label: t("columns.name"), sortKey: "name" }, cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      {
        id: "roles",
        header: t("columns.roles"),
        meta: { label: t("columns.roles") },
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.roles.map((r) => (
              <Badge key={r} variant="secondary">
                {te(r as "CEO")}
              </Badge>
            ))}
          </div>
        ),
      },
      { id: "position", header: t("columns.position"), meta: { label: t("columns.position") }, cell: ({ row }) => row.original.position ?? "—" },
      { id: "phone", header: t("columns.phone"), meta: { label: t("columns.phone") }, cell: ({ row }) => <span className="whitespace-nowrap">{formatPhone(row.original.phone)}</span> },
      { id: "status", header: t("columns.status"), meta: { label: t("columns.status") }, cell: ({ row }) => (row.original.isActive ? <Badge>{t("active")}</Badge> : <Badge variant="outline">{t("inactive")}</Badge>) },
      {
        id: "actions",
        header: () => null,
        enableHiding: false,
        meta: { className: "w-12" },
        cell: ({ row }) => {
          const r = row.original;
          const manageable = canManageRoles(actorRoles, r.roles);
          return (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={tc("actions")} />}>
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {manageable && (
                  <DropdownMenuItem onClick={() => setEditing(r)}>
                    <Pencil /> {tc("edit")}
                  </DropdownMenuItem>
                )}
                {r.email && (
                  <DropdownMenuItem render={<a href={`mailto:${r.email}`} />}>
                    <Mail /> {t("sendEmail")}
                  </DropdownMenuItem>
                )}
                {manageable && (
                  <DropdownMenuItem onClick={() => setResetting(r)}>
                    <KeyRound /> {t("resetPassword")}
                  </DropdownMenuItem>
                )}
                {manageable && r.id !== meId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(r)}>
                      <Trash2 /> {tc("delete")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [t, te, tc, meId, actorRoles],
  );

  return (
    <>
      <DataTable columns={columns} data={rows} total={total} page={page} pageSize={pageSize} sort={sort} getRowId={(r) => r.id} storageKey="settings-staff" />
      {editing && <StaffDialog open onOpenChange={(o) => !o && setEditing(null)} staff={editing} branches={branches} canGrantPrivileged={canGrantPrivileged} isSelf={editing.id === meId} />}
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={t("deleteTitle", { name: deleting?.name ?? "" })} description={t("deleteHint")} destructive pending={pending} confirmLabel={tc("delete")} onConfirm={doDelete} />
      <ConfirmDialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)} title={t("resetTitle", { name: resetting?.name ?? "" })} description={t("resetHint")} pending={pending} onConfirm={doReset} />
      <Dialog open={!!newPassword} onOpenChange={(o) => !o && setNewPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newPasswordTitle", { name: newPassword?.name ?? "" })}</DialogTitle>
            <DialogDescription>{t("newPasswordHint")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="bg-muted flex-1 rounded-md px-3 py-2 font-mono text-base tracking-wider select-all">{newPassword?.password}</code>
            <Button variant="outline" size="icon" aria-label={t("copy")} onClick={() => newPassword && copy(newPassword.password, t("copied"))}>
              <Copy className="size-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewPassword(null)}>{tc("close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function NewStaffButton({ branches, canGrantPrivileged }: { branches: Branch[]; canGrantPrivileged: boolean }) {
  const t = useTranslations("settings.staff");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t("add")}
      </Button>
      {open && <StaffDialog open onOpenChange={setOpen} branches={branches} canGrantPrivileged={canGrantPrivileged} />}
    </>
  );
}

function StaffDialog({ open, onOpenChange, staff, branches, canGrantPrivileged, isSelf }: { open: boolean; onOpenChange: (o: boolean) => void; staff?: StaffRow; branches: Branch[]; canGrantPrivileged: boolean; isSelf?: boolean }) {
  const t = useTranslations("settings.staff");
  const te = useTranslations("enums.roles");
  const tc = useTranslations("common");
  const err = useErrText();
  const actionError = useActionError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { control, register, handleSubmit, setError, formState: { errors } } = useForm<StaffInput, unknown, StaffOutput>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: staff?.name ?? "",
      phone: staff ? staff.phone.replace(/^998/, "") : "",
      roles: (staff?.roles ?? []) as StaffInput["roles"],
      position: staff?.position ?? "",
      email: staff?.email ?? "",
      password: "",
      branchIds: staff?.branchIds ?? [],
      isActive: staff?.isActive ?? true,
    },
  });

  const submit = (values: StaffOutput) =>
    startTransition(async () => {
      const res = await saveStaff(staff?.id ?? null, values as unknown as StaffInput);
      if (res.ok) {
        toast.success(tc("saved"));
        onOpenChange(false);
        router.refresh();
      } else if (res.fieldErrors) {
        for (const [name, message] of Object.entries(res.fieldErrors)) setError(name as keyof StaffInput, { message });
      } else toast.error(actionError(res.error));
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{staff ? t("edit") : t("add")}</DialogTitle>
          </DialogHeader>
          <Field label={t("columns.name")} error={err(errors.name?.message)}>
            <Input {...register("name")} autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("columns.phone")} error={err(errors.phone?.message)}>
              <Controller control={control} name="phone" render={({ field }) => <PhoneInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} />} />
            </Field>
            <Field label={t("columns.position")}>
              <Input {...register("position")} />
            </Field>
          </div>
          <Field label={t("columns.roles")} error={err(errors.roles?.message)}>
            <Controller
              control={control}
              name="roles"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => {
                    const locked = !canGrantPrivileged && (PRIVILEGED_ROLES as readonly string[]).includes(r);
                    const on = field.value.includes(r);
                    return (
                      <label key={r} className={locked ? "text-muted-foreground flex items-center gap-2 text-sm opacity-60" : "flex items-center gap-2 text-sm"}>
                        <Checkbox disabled={locked} checked={on} onCheckedChange={(c) => field.onChange(c ? [...field.value, r] : field.value.filter((x) => x !== r))} />
                        {te(r)}
                      </label>
                    );
                  })}
                </div>
              )}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("columns.email")} error={err(errors.email?.message)}>
              <Input type="email" {...register("email")} />
            </Field>
            <Field label={staff ? t("newPasswordOptional") : t("columns.password")} error={err(errors.password?.message)}>
              <PasswordInput autoComplete="new-password" {...register("password")} />
            </Field>
          </div>
          {branches.length > 0 && (
            <Field label={t("branches")}>
              <Controller
                control={control}
                name="branchIds"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-4">
                    {branches.map((b) => (
                      <label key={b.id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={field.value.includes(b.id)} onCheckedChange={(c) => field.onChange(c ? [...field.value, b.id] : field.value.filter((x) => x !== b.id))} />
                        {b.name}
                      </label>
                    ))}
                  </div>
                )}
              />
            </Field>
          )}
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox disabled={isSelf} checked={field.value} onCheckedChange={(c) => field.onChange(!!c)} />
                {t("activeHint")}
              </label>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ImportStaffButton() {
  const t = useTranslations("settings.staff.import");
  const tc = useTranslations("common");
  const actionError = useActionError();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await importStaff(data);
      if (res.ok) {
        setResult({ created: res.created, errors: res.errors });
        router.refresh();
      } else toast.error(res.error === "tooLarge" || res.error === "noFile" || res.error === "invalidFile" ? t(`errors.${res.error}`) : actionError(res.error));
    });
  };
  const close = (o: boolean) => {
    setOpen(o);
    if (!o) setResult(null);
  };
  const credentials = result?.created.map((c) => `${c.name}\t+${c.phone}\t${c.password}`).join("\n") ?? "";

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="size-4" />
        {t("button")}
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("hint")}</DialogDescription>
          </DialogHeader>
          {!result ? (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <Button type="button" variant="outline" size="sm" className="w-fit" nativeButton={false} render={<a href="/settings/staff/template" download />}>
                <FileSpreadsheet className="size-4" />
                {t("template")}
              </Button>
              <Input name="file" type="file" accept=".xlsx" required />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => close(false)}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" disabled={pending}>
                  {t("submit")}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <p className="font-medium">{t("created", { count: result.created.length })}</p>
              {result.created.length > 0 && (
                <>
                  <p className="text-muted-foreground text-xs">{t("passwordsHint")}</p>
                  <div className="bg-muted max-h-48 overflow-auto rounded-md p-2 font-mono text-xs">
                    {result.created.map((c) => (
                      <div key={c.phone}>
                        {c.name} · +{c.phone} · {c.password}
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="w-fit" onClick={() => copy(credentials, t("copied"))}>
                    <Copy className="size-4" />
                    {t("copy")}
                  </Button>
                </>
              )}
              {result.errors.length > 0 && (
                <div>
                  <p className="text-destructive font-medium">{t("skipped", { count: result.errors.length })}</p>
                  <ul className="text-muted-foreground mt-1 max-h-32 list-disc overflow-auto pl-5 text-xs">
                    {result.errors.map((er, i) => (
                      <li key={`${er.row}-${i}`}>{t("rowError", { row: er.row, reason: t(`fields.${er.field}` as "fields.name") })}</li>
                    ))}
                  </ul>
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => close(false)}>{tc("close")}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
