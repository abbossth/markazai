import Link from "next/link";
import { platformPrisma } from "@markazai/db/platform";
import { Badge, Card, PageHeader, Stat, Table } from "@/components/ui";
import { fmtDate, fmtMoney, todayISO } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ forbidden?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = todayISO();
  const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00.000Z`);
  const soon = new Date(new Date(`${today}T00:00:00.000Z`).getTime() + 14 * 86_400_000);

  const [orgs, revenue, expiring, latestUsage] = await Promise.all([
    platformPrisma.organization.groupBy({ by: ["status"], _count: true }),
    platformPrisma.paymentRecord.aggregate({ where: { paidAt: { gte: monthStart } }, _sum: { amount: true } }),
    platformPrisma.subscription.findMany({ where: { status: "ACTIVE", endDate: { lte: soon } }, orderBy: { endDate: "asc" }, include: { organization: true, plan: true }, take: 20 }),
    platformPrisma.usageMetric.findMany({ orderBy: { recordedAt: "desc" }, distinct: ["organizationId"], include: { organization: true }, take: 20 }),
  ]);
  const count = (s: string) => orgs.find((o) => o.status === s)?._count ?? 0;

  return (
    <>
      {sp.forbidden && <p role="alert" className="border-destructive/40 bg-destructive/5 rounded-lg border p-3 text-sm">Bu bo&apos;lim uchun ruxsatingiz yo&apos;q.</p>}
      <PageHeader title="Bosh sahifa" sub="Agregat ko'rsatkichlar — talaba/guruh/to'lov tafsilotlari bu yerda ko'rinmaydi." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Faol tashkilotlar" value={String(count("ACTIVE"))} sub={`Sinov: ${count("TRIAL")} · To'xtatilgan: ${count("SUSPENDED")}`} />
        <Stat label="Shu oydagi tushum" value={fmtMoney(revenue._sum.amount ?? 0)} />
        <Stat label="Muddati yaqinlashayotgan" value={String(expiring.length)} sub="14 kun ichida yoki o'tib ketgan" />
        <Stat label="Jami tashkilotlar" value={String(orgs.reduce((s, o) => s + o._count, 0))} />
      </div>

      <Card title="Obuna muddati yaqinlashayotganlar">
        <Table head={["Tashkilot", "Reja", "Tugash sanasi", "Holat"]} empty={expiring.length ? undefined : "Yaqin 14 kunda tugaydigan obuna yo'q"}>
          {expiring.map((s) => {
            const end = s.endDate.toISOString().slice(0, 10);
            return (
              <tr key={s.id}>
                <td>
                  <Link href={`/organizations/${s.organizationId}`} className="font-medium hover:underline">
                    {s.organization.name}
                  </Link>
                </td>
                <td>{s.plan.name}</td>
                <td>{fmtDate(s.endDate)}</td>
                <td>{end < today ? <Badge tone="bad">Tugagan</Badge> : <Badge tone="warn">{Math.round((new Date(end).getTime() - new Date(today).getTime()) / 86_400_000)} kun qoldi</Badge>}</td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <Card title="Oxirgi foydalanish ko'rsatkichlari">
        <Table head={["Tashkilot", "Talabalar", "Xodimlar", "Guruhlar", "Yangilangan"]} empty={latestUsage.length ? undefined : "Hali o'lchov yo'q — tashkilot sahifasida \"Yangilash\" ni bosing"}>
          {latestUsage.map((u) => (
            <tr key={u.id}>
              <td>{u.organization.name}</td>
              <td className="tabular-nums">{u.studentsCount}</td>
              <td className="tabular-nums">{u.staffCount}</td>
              <td className="tabular-nums">{u.groupsCount}</td>
              <td>{fmtDate(u.recordedAt)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
