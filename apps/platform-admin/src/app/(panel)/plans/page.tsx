import { platformPrisma } from "@markazai/db/platform";
import { PLAN_MODULES } from "@markazai/types";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader } from "@/components/ui";
import { fmtMoney } from "@/lib/format";
import { can, requireAdmin } from "@/lib/session";
import { savePlan } from "./actions";

const MODULE_LABEL: Record<string, string> = { gamification: "Gamifikatsiya", integrations: "Integratsiyalar" };

type PlanRow = { id: string; name: string; monthlyPrice: number; maxStaff: number | null; maxBranches: number | null; maxStudents: number | null; modules: string[]; isActive: boolean };

function PlanForm({ plan, editable }: { plan?: PlanRow; editable: boolean }) {
  return (
    <ActionForm action={savePlan.bind(null, plan?.id ?? null)} submit={plan ? "Saqlash" : "Reja qo'shish"} className="gap-3" variant={plan ? "outline" : "default"}>
      <fieldset disabled={!editable} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="Nomi">
            <Input name="name" defaultValue={plan?.name} required />
          </Field>
          <Field label="Oylik narx (so'm)" hint={plan ? fmtMoney(plan.monthlyPrice) : undefined}>
            <Input name="monthlyPrice" type="number" min={0} step={1000} defaultValue={plan?.monthlyPrice} required />
          </Field>
          <Field label="Max xodim" hint="Bo'sh — cheksiz">
            <Input name="maxStaff" type="number" min={1} defaultValue={plan?.maxStaff ?? ""} />
          </Field>
          <Field label="Max filial">
            <Input name="maxBranches" type="number" min={1} defaultValue={plan?.maxBranches ?? ""} />
          </Field>
          <Field label="Max talaba">
            <Input name="maxStudents" type="number" min={1} defaultValue={plan?.maxStudents ?? ""} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-sm">
          {PLAN_MODULES.map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input type="checkbox" name={`module_${m}`} defaultChecked={plan?.modules.includes(m)} />
              {MODULE_LABEL[m] ?? m}
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isActive" defaultChecked={plan?.isActive ?? true} />
            Faol (yangi obunaga tanlanadi)
          </label>
        </div>
      </fieldset>
    </ActionForm>
  );
}

export default async function PlansPage() {
  const admin = await requireAdmin();
  const plans = await platformPrisma.plan.findMany({ orderBy: { monthlyPrice: "asc" } });
  const editable = can(admin, ["BILLING"]);
  return (
    <>
      <PageHeader title="Rejalar" sub="Limitlar va yoqilgan modullar tenant-app'da amalda qo'llanadi (≤30 soniyada)." />
      {plans.map((p) => (
        <Card key={p.id} title={p.name}>
          <PlanForm plan={p} editable={editable} />
        </Card>
      ))}
      {editable && (
        <Card title="Yangi reja">
          <PlanForm editable />
        </Card>
      )}
    </>
  );
}
