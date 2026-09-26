import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { AppFooter } from "@/components/layout/app-footer";
import { SubscriptionBanner } from "@/components/layout/subscription-banner";
import { prisma, withTenant } from "@markazai/db";
import { toCenterParts } from "@markazai/types";
import { can, canAccess } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { currentTenant } from "@/lib/tenant";
import { loadMyReminders } from "./reminders/queries";

// Har bir tashkilotning ichki paneli — hech qachon qidiruv tizimlarida indekslanmasligi kerak.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Proxy — birinchi to'siq, bu — haqiqiy tekshiruv (bazadagi joriy rollar va faollik bilan).
  const user = await requireUser();
  const [account, reminders, tenant] = await Promise.all([
    withTenant(user.orgId, () => prisma.user.findUnique({ where: { id: user.id }, select: { phone: true, photoUrl: true } })),
    withTenant(user.orgId, () => loadMyReminders(user)),
    currentTenant(),
  ]);

  return (
    <div className="flex h-screen overflow-hidden print:block print:h-auto print:overflow-visible">
      <Sidebar roles={user.roles} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Obuna eslatmasi — faqat Sozlamalarni ko'ra oladigan (rahbariyat/administrator) rollarga ko'rsatiladi. */}
        <SubscriptionBanner tenant={canAccess(user.roles, "settings") ? tenant : null} />
        <Header user={{ name: user.name, phone: account?.phone ?? "", image: account?.photoUrl ?? null, roles: user.roles }} reminders={reminders} quick={{ canStudent: can(user.roles, "students:write"), canPayment: can(user.roles, "payments:write"), today: toCenterParts(new Date()).date }} />
        <main className="bg-muted/30 flex-1 overflow-auto p-6 print:overflow-visible print:p-0">{children}</main>
        <AppFooter chargeMode={tenant?.chargeMode ?? "DAILY"} />
      </div>
    </div>
  );
}
