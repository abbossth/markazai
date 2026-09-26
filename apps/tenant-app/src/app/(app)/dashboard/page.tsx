import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { withTenant } from "@markazai/db";
import { ChartSkeleton, StatGridSkeleton } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/lib/permissions";
import { requireModule, type SessionUser } from "@/lib/session";
import { DashboardGrid } from "./dashboard-grid";
import { allowedWidgetIds, loadDashboard, loadLayout } from "./queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("dashboard") };
}

export default async function DashboardPage() {
  const user = await requireModule("dashboard");
  const t = await getTranslations("dashboard");

  return (
    <div className="flex flex-col gap-4">
      {/* Sarlavha hech qanday ma'lumotga bog'liq emas — pastdagi (bir necha so'rovni birlashtiruvchi, sekinroq)
          `DashboardData`dan ALOHIDA Suspense chegarasida, shunda u darhol chiqadi (LCP: Lighthouse'da
          "Render Delay" — butun sahifa bitta async funksiya bo'lganda sarlavha ham vidjetlar bilan birga
          kutib turardi). */}
      <h1 className="text-2xl font-semibold">{t("welcome", { name: user.name })}</h1>
      <Suspense fallback={<DashboardDataSkeleton />}>
        <DashboardData user={user} />
      </Suspense>
    </div>
  );
}

async function DashboardData({ user }: { user: SessionUser }) {
  // Tashkilot kontekstini SHU YERDA aniq beramiz: Suspense ichida (alohida, kechroq oqimda) bajariladigan so'rovlar
  // ba'zan kontekstni yo'qotib, RLS sababli JIM bo'sh natija (0 tushum, bo'sh jadval) qaytarardi.
  const [layout, data] = await withTenant(user.orgId, () => Promise.all([loadLayout(user), loadDashboard(user)]));
  return <DashboardGrid layout={layout} allowed={[...allowedWidgetIds(user)]} data={data} canManageCapacity={can(user.roles, "settings:manage")} />;
}

function DashboardDataSkeleton() {
  return (
    <>
      <StatGridSkeleton count={9} />
      <div className="bg-card flex flex-col gap-3 rounded-lg border p-4">
        <Skeleton className="h-4 w-40" />
        <ChartSkeleton />
      </div>
    </>
  );
}
