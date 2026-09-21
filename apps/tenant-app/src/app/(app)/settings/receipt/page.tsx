import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@markazai/db";
import { requireModule } from "@/lib/session";
import { ReceiptForm } from "./receipt-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("receipt") };
}

export default async function ReceiptSettingsPage() {
  const user = await requireModule("settings");
  const [s, branch] = await Promise.all([prisma.centerSettings.findUnique({ where: { organizationId: user.orgId } }), prisma.branch.findFirst({ where: { organizationId: user.orgId }, orderBy: { createdAt: "asc" } })]);
  return (
    <ReceiptForm
      initial={{ receiptHeader: s?.receiptHeader ?? "", receiptFooter: s?.receiptFooter ?? "", receiptShowLogo: s?.receiptShowLogo ?? true, receiptShowBranch: s?.receiptShowBranch ?? true, receiptShowCashier: s?.receiptShowCashier ?? true }}
      center={{ name: s?.name ?? "Markazai", phone: s?.phone ?? null, logoUrl: s?.logoUrl ?? null }}
      branch={branch ? { name: branch.name, address: branch.address } : null}
    />
  );
}
