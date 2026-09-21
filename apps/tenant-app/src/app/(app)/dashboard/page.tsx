import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("dashboard") };
}

export default async function DashboardPage() {
  const session = await auth();
  const t = await getTranslations("dashboard");

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{t("welcome", { name: session?.user.name ?? "" })}</h1>
    </div>
  );
}
