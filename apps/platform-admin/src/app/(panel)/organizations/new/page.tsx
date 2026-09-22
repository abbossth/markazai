import { platformPrisma } from "@markazai/db/platform";
import { BILLING_CYCLES } from "@markazai/types";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { fmtMoney } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { createOrganization } from "../actions";

export default async function NewOrganizationPage() {
  await requireAdmin(["SUPPORT"]);
  const plans = await platformPrisma.plan.findMany({ where: { isActive: true }, orderBy: { monthlyPrice: "asc" } });
  const root = process.env.ROOT_DOMAIN ?? "localhost";
  return (
    <>
      <PageHeader title="Yangi tashkilot" sub="Yaratilgach tenant bazasida boshlang'ich sozlamalar va CEO akkaunti avtomatik tuziladi." />
      <div className="max-w-xl">
        <Card>
          <ActionForm action={createOrganization} submit="Yaratish" className="gap-4">
            <Field label="Markaz nomi">
              <Input name="name" required minLength={2} />
            </Field>
            <Field label="Slug (subdomen)" hint={`Manzil: slug.${root} — kichik lotin harflari, raqam va defis (3–32 belgi)`}>
              <Input name="slug" required pattern="[a-zA-Z0-9-]{3,32}" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rahbar ismi (CEO)">
                <Input name="contactName" required />
              </Field>
              <Field label="Rahbar telefoni (login)" hint="Masalan 90 123 45 67">
                <Input name="contactPhone" type="tel" required />
              </Field>
            </div>
            <Field label="Email (ixtiyoriy)">
              <Input name="contactEmail" type="email" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Reja" hint="Tanlanmasa — sinov (obunasiz)">
                <Select name="planId" defaultValue="">
                  <option value="">Sinov davri</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {fmtMoney(p.monthlyPrice)}/oy
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Davr">
                <Select name="months" defaultValue="1">
                  {BILLING_CYCLES.map((m) => (
                    <option key={m} value={m}>
                      {m} oy
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
