import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { prisma } from "@markazai/db";
import { requireUser } from "@/lib/session";
import { loadMyReminders } from "./reminders/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Proxy — birinchi to'siq, bu — haqiqiy tekshiruv (bazadagi joriy rollar va faollik bilan).
  const user = await requireUser();
  const [account, reminders] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { phone: true, photoUrl: true } }),
    loadMyReminders(user),
  ]);

  return (
    <div className="flex h-screen overflow-hidden print:block print:h-auto print:overflow-visible">
      <Sidebar roles={user.roles} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={{ name: user.name, phone: account?.phone ?? "", image: account?.photoUrl ?? null, roles: user.roles }} reminders={reminders} />
        <main className="bg-muted/30 flex-1 overflow-auto p-6 print:overflow-visible print:p-0">{children}</main>
      </div>
    </div>
  );
}
