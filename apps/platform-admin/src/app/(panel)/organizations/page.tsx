import Link from "next/link";
import { platformPrisma } from "@markazai/db/platform";
import { Badge, PageHeader, Table, buttonClass } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const STATUS_LABEL = { TRIAL: "Sinov", ACTIVE: "Faol", SUSPENDED: "To'xtatilgan", DELETED: "O'chirilgan" } as const;
export const STATUS_TONE = { TRIAL: "warn", ACTIVE: "good", SUSPENDED: "bad", DELETED: "neutral" } as const;

export default async function OrganizationsPage() {
  await requireAdmin();
  const orgs = await platformPrisma.organization.findMany({ orderBy: { createdAt: "desc" }, include: { subscriptions: { where: { status: "ACTIVE" }, orderBy: { endDate: "desc" }, take: 1, include: { plan: true } } } });
  const root = process.env.ROOT_DOMAIN ?? "localhost";
  return (
    <>
      <PageHeader title="Tashkilotlar" actions={<Link href="/organizations/new" className={buttonClass()}>Yangisini qo&apos;shish</Link>} />
      <Table head={["Nomi", "Manzil", "Holat", "Reja", "Obuna tugashi", "Yaratilgan"]} empty={orgs.length ? undefined : "Tashkilotlar yo'q"}>
        {orgs.map((o) => {
          const sub = o.subscriptions[0];
          return (
            <tr key={o.id}>
              <td>
                <Link href={`/organizations/${o.id}`} className="font-medium hover:underline">
                  {o.name}
                </Link>
              </td>
              <td className="text-muted-foreground font-mono text-xs">{o.slug}.{root}</td>
              <td>
                <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
              </td>
              <td>{sub?.plan.name ?? "—"}</td>
              <td>{fmtDate(sub?.endDate)}</td>
              <td>{fmtDate(o.createdAt)}</td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
