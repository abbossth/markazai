import { platformPrisma } from "@markazai/db/platform";
import { PageHeader, Table } from "@/components/ui";
import { requireAdmin } from "@/lib/session";

export default async function AuditPage() {
  await requireAdmin();
  const logs = await platformPrisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title="Audit-log" sub="Control Plane'dagi barcha harakatlar (oxirgi 200 ta). Yozuvlar o'zgartirilmaydi va o'chirilmaydi." />
      <Table head={["Vaqt", "Xodim", "Harakat", "Obyekt", "Tafsilot"]} empty={logs.length ? undefined : "Yozuvlar yo'q"}>
        {logs.map((l) => (
          <tr key={l.id}>
            <td className="whitespace-nowrap tabular-nums">{l.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
            <td>{l.adminEmail}</td>
            <td className="font-mono text-xs">{l.action}</td>
            <td className="text-muted-foreground font-mono text-xs">
              {l.entityType}
              {l.entityId ? ` ${l.entityId.slice(0, 8)}` : ""}
            </td>
            <td className="text-muted-foreground max-w-md truncate text-xs">{l.details ? JSON.stringify(l.details) : ""}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
