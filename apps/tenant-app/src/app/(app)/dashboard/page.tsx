import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/session";
import { DashboardGrid } from "./dashboard-grid";
import { allowedWidgetIds, loadDashboard, loadLayout } from "./queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("dashboard") };
}

export default async function DashboardPage() {
  const user = await requireModule("dashboard");
  const t = await getTranslations("dashboard");
  const [layout, data] = await Promise.all([loadLayout(user), loadDashboard(user)]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("welcome", { name: user.name })}</h1>
      <DashboardGrid layout={layout} allowed={[...allowedWidgetIds(user)]} data={data} />
    </div>
  );
}
