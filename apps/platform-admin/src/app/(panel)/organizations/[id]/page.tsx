import { notFound } from "next/navigation";
import { z } from "zod";
import { platformPrisma } from "@markazai/db/platform";
import { BILLING_CYCLES, PLAN_MODULES, cyclePrice } from "@markazai/types";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Field, Input, PageHeader, Select, Table } from "@/components/ui";
import { fmtDate, fmtMoney, todayISO } from "@/lib/format";
import { can, requireAdmin } from "@/lib/session";
import { STATUS_LABEL, STATUS_TONE } from "../page";
import { recordPayment, refreshUsage, setFlag, setStatus } from "../actions";

const MODULE_LABEL: Record<string, string> = { gamification: "Gamifikatsiya", integrations: "Integratsiyalar" };

export default async function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const org = await platformPrisma.organization.findUnique({
    where: { id },
    include: { flags: true, subscriptions: { orderBy: { createdAt: "desc" }, include: { plan: true, payments: { orderBy: { createdAt: "desc" } } } }, usage: { orderBy: { recordedAt: "desc" }, take: 1 } },
  });
  if (!org) notFound();
  const plans = await platformPrisma.plan.findMany({ where: { isActive: true }, orderBy: { monthlyPrice: "asc" } });

  const today = todayISO();
  const active = org.subscriptions.find((s) => s.status === "ACTIVE");
  const payments = org.subscriptions.flatMap((s) => s.payments.map((p) => ({ ...p, planName: s.plan.name }))).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const usage = org.usage[0];
  const canBilling = can(admin, ["BILLING"]);
  const canSupport = can(admin, ["SUPPORT"]);
  const root = process.env.ROOT_DOMAIN ?? "localhost";
  const daysLeft = active ? Math.round((active.endDate.getTime() - new Date(`${today}T00:00:00.000Z`).getTime()) / 86_400_000) : null;

  return (
    <>
      <PageHeader title={org.name} sub={`${org.slug}.${root} · ID ${org.id.slice(0, 8)}`} actions={<Badge tone={STATUS_TONE[org.status]}>{STATUS_LABEL[org.status]}</Badge>} />

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card title="Aloqa">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Rahbar</dt>
            <dd>{org.contactName}</dd>
            <dt className="text-muted-foreground">Telefon</dt>
            <dd>+{org.contactPhone}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd>{org.contactEmail ?? "—"}</dd>
            <dt className="text-muted-foreground">Yaratilgan</dt>
            <dd>{fmtDate(org.createdAt)}</dd>
          </dl>
        </Card>

        <Card title="Holat">
          <p className="text-muted-foreground text-sm">To&apos;xtatilganda tenant login sahifasida &quot;Obunangiz tugagan&quot; ko&apos;rsatiladi; ma&apos;lumot o&apos;chirilmaydi (soft-suspend).</p>
          {canBilling ? (
            <div className="flex flex-wrap gap-3">
              {org.status !== "ACTIVE" && <ActionForm action={setStatus.bind(null, org.id, "ACTIVE")} submit="Faollashtirish" variant="outline" />}
              {org.status !== "SUSPENDED" && <ActionForm action={setStatus.bind(null, org.id, "SUSPENDED")} submit="To'xtatish" variant="destructive" confirm="Tashkilot to'xtatilsinmi? Foydalanuvchilar kira olmaydi." />}
              {org.status !== "DELETED" && <ActionForm action={setStatus.bind(null, org.id, "DELETED")} submit="O'chirilgan deb belgilash" variant="outline" confirm="Tashkilot o'chirilgan deb belgilansinmi? (ma'lumot saqlanadi)" />}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Holatni faqat Billing/Owner o&apos;zgartira oladi.</p>
          )}
        </Card>

        <Card title="Obuna">
          {active ? (
            <p className="text-sm">
              <span className="font-medium">{active.plan.name}</span> · {active.billingCycle} oy · {fmtMoney(active.price)} · tugash: <span className="font-medium">{fmtDate(active.endDate)}</span>{" "}
              {daysLeft !== null && (daysLeft < 0 ? <Badge tone="bad">Tugagan</Badge> : daysLeft <= 14 ? <Badge tone="warn">{daysLeft} kun qoldi</Badge> : <Badge tone="good">{daysLeft} kun</Badge>)}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">Faol obuna yo&apos;q (sinov). To&apos;lov qayd etilsa obuna boshlanadi.</p>
          )}
          {canBilling && (
            <ActionForm action={recordPayment.bind(null, org.id)} submit="To'landi — obunani uzaytirish" className="gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Reja">
                  <Select name="planId" defaultValue={active?.planId ?? plans[0]?.id}>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {fmtMoney(p.monthlyPrice)}/oy
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Davr" hint={plans[0] ? `Masalan 12 oy: ${fmtMoney(cyclePrice(plans[0].monthlyPrice, 12))} (chegirma bilan)` : undefined}>
                  <Select name="months" defaultValue="1">
                    {BILLING_CYCLES.map((m) => (
                      <option key={m} value={m}>
                        {m} oy
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Summa (so'm)" hint="Bo'sh — reja narxi × davr − chegirma">
                  <Input name="amount" type="number" min={0} step={1000} />
                </Field>
                <Field label="To'lov usuli">
                  <Select name="method" defaultValue="Payme">
                    {["Payme", "Click", "Uzum", "Naqd", "O'tkazma"].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Izoh">
                <Input name="note" maxLength={200} />
              </Field>
            </ActionForm>
          )}
        </Card>

        <Card title="Modullar (feature flag)">
          <p className="text-muted-foreground text-sm">&quot;Reja bo&apos;yicha&quot; — modul reja tarkibiga qarab; qolganlari rejani bekor qiladi.</p>
          {PLAN_MODULES.map((m) => {
            const flag = org.flags.find((f) => f.module === m);
            const current = flag ? (flag.enabled ? "on" : "off") : "plan";
            return canBilling ? (
              <ActionForm key={m} action={setFlag.bind(null, org.id, m)} submit="Saqlash" variant="sm" className="flex-row items-end gap-3">
                <Field label={MODULE_LABEL[m] ?? m}>
                  <Select name="value" defaultValue={current}>
                    <option value="plan">Reja bo&apos;yicha</option>
                    <option value="on">Yoqilgan</option>
                    <option value="off">O&apos;chirilgan</option>
                  </Select>
                </Field>
              </ActionForm>
            ) : (
              <p key={m} className="text-sm">
                {MODULE_LABEL[m] ?? m}: {current}
              </p>
            );
          })}
        </Card>
      </div>

      <Card title="Foydalanish (agregat)" actions={canSupport ? <ActionForm action={refreshUsage.bind(null, org.id)} submit="Yangilash" variant="sm" className="flex-row" /> : null}>
        {usage ? (
          <p className="text-sm">
            Talabalar: <b className="tabular-nums">{usage.studentsCount}</b> · Xodimlar: <b className="tabular-nums">{usage.staffCount}</b> · Guruhlar: <b className="tabular-nums">{usage.groupsCount}</b> <span className="text-muted-foreground">({fmtDate(usage.recordedAt)})</span>
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">Hali o&apos;lchov yo&apos;q.</p>
        )}
      </Card>

      <Card title="To'lovlar tarixi">
        <Table head={["Sana", "Reja", "Summa", "Usul", "Tasdiqlagan", "Izoh"]} empty={payments.length ? undefined : "To'lovlar yo'q"}>
          {payments.map((p) => (
            <tr key={p.id}>
              <td>{fmtDate(p.paidAt)}</td>
              <td>{p.planName}</td>
              <td className="tabular-nums">{fmtMoney(p.amount)}</td>
              <td>{p.method}</td>
              <td className="text-muted-foreground">{p.confirmedBy}</td>
              <td>{p.note ?? "—"}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
