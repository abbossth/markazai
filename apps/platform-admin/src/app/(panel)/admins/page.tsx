import { platformPrisma } from "@markazai/db/platform";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { saveAdmin } from "./actions";

type A = { id: string; name: string; email: string; role: string; isActive: boolean; lastLoginAt: Date | null };

function AdminForm({ a }: { a?: A }) {
  return (
    <ActionForm action={saveAdmin.bind(null, a?.id ?? null)} submit={a ? "Saqlash" : "Xodim qo'shish"} variant={a ? "outline" : "default"} className="gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Ism">
          <Input name="name" defaultValue={a?.name} required />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={a?.email} required />
        </Field>
        <Field label="Rol" hint="OWNER — hammasi; BILLING — obuna/reja; SUPPORT — tashkilot yaratish/kuzatish">
          <Select name="role" defaultValue={a?.role ?? "SUPPORT"}>
            <option value="OWNER">OWNER</option>
            <option value="BILLING">BILLING</option>
            <option value="SUPPORT">SUPPORT</option>
          </Select>
        </Field>
        <Field label={a ? "Yangi parol (bo'sh — o'zgarmaydi)" : "Parol (≥10 belgi)"}>
          <Input name="password" type="password" autoComplete="new-password" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={a?.isActive ?? true} />
        Faol
      </label>
    </ActionForm>
  );
}

export default async function AdminsPage() {
  const me = await requireAdmin(["SUPPORT"]);
  const admins = await platformPrisma.platformAdmin.findMany({ orderBy: { createdAt: "asc" } });
  const isOwner = me.role === "OWNER";
  return (
    <>
      <PageHeader title="Platforma xodimlari" sub="Tenant ichidagi 'Xodimlar'dan butunlay alohida: boshqa jadval, boshqa sessiya." />
      {admins.map((a) => (
        <Card key={a.id} title={`${a.name} · ${a.email}`}>
          <p className="text-muted-foreground -mt-2 text-xs">Oxirgi kirish: {fmtDate(a.lastLoginAt)}</p>
          {isOwner ? <AdminForm a={a} /> : <p className="text-sm">{a.role} · {a.isActive ? "faol" : "bloklangan"}</p>}
        </Card>
      ))}
      {isOwner && (
        <Card title="Yangi xodim">
          <AdminForm />
        </Card>
      )}
    </>
  );
}
