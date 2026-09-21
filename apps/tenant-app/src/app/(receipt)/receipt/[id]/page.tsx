import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { prisma } from "@markazai/db";
import { formatDate, formatMoney, formatPhone } from "@/lib/format";
import { requireModule } from "@/lib/session";
import { cn } from "@/lib/utils";
import { ReceiptView } from "@/components/shared/receipt-view";
import { ReceiptActions } from "./receipt-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("finance");
  return { title: t("receiptTitle") };
}

/** To'lov cheki. `?format=thermal` — 80mm termal printer, aks holda A4. Faqat qo'lda kiritilgan to'lovlar uchun. */
export default async function ReceiptPage({ params, searchParams }: PageProps<"/receipt/[id]">) {
  const user = await requireModule("finance");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const sp = await searchParams;
  const thermal = (Array.isArray(sp.format) ? sp.format[0] : sp.format) === "thermal";

  const payment = await prisma.payment.findFirst({
    where: { id, organizationId: user.orgId, type: "MANUAL" },
    include: {
      student: { select: { name: true, phone: true, balance: true } },
      group: { select: { name: true, price: true, course: { select: { name: true } }, teacher: { select: { name: true } } } },
    },
  });
  if (!payment) notFound();

  const [settings, branch, cashier, t, te] = await Promise.all([
    prisma.centerSettings.findUnique({ where: { organizationId: user.orgId } }),
    prisma.branch.findFirst({ where: { organizationId: user.orgId }, orderBy: { createdAt: "asc" } }),
    payment.receivedById ? prisma.user.findFirst({ where: { id: payment.receivedById, organizationId: user.orgId }, select: { name: true } }) : Promise.resolve(null),
    getTranslations("finance.receipt"),
    getTranslations("enums.paymentMethod"),
  ]);

  const rows: [string, string][] = [
    [t("student"), payment.student.name],
    [t("phone"), formatPhone(payment.student.phone)],
    ...(payment.group ? ([[t("group"), `${payment.group.name} · ${payment.group.course.name}`], [t("teacher"), payment.group.teacher.name], [t("groupPrice"), formatMoney(payment.group.price)]] as [string, string][]) : []),
    [t("method"), te(payment.method)],
    [t("date"), formatDate(payment.date)],
    ...(payment.description ? ([[t("comment"), payment.description]] as [string, string][]) : []),
  ];

  return (
    <main className={cn("bg-background text-foreground mx-auto min-h-screen w-full p-6 print:min-h-0 print:p-0", thermal ? "max-w-[80mm] text-xs" : "max-w-[190mm] text-sm")}>
      <style>{`@page { size: ${thermal ? "80mm auto" : "A4"}; margin: ${thermal ? "4mm" : "12mm"}; }`}</style>
      <ReceiptActions paymentId={payment.id} />

      <ReceiptView
        thermal={thermal}
        center={{
          name: settings?.name ?? "Markazai",
          phone: settings?.phone,
          logoUrl: settings?.logoUrl,
          header: settings?.receiptHeader,
          footer: settings?.receiptFooter,
          showLogo: settings?.receiptShowLogo ?? true,
          showBranch: settings?.receiptShowBranch ?? true,
          showCashier: settings?.receiptShowCashier ?? true,
        }}
        branch={branch}
        number={payment.id.slice(0, 8).toUpperCase()}
        rows={rows}
        amount={payment.amount}
        balance={payment.student.balance}
        cashier={cashier?.name}
        labels={{ title: t("title"), amount: t("amount"), balanceAfter: t("balanceAfter"), cashier: t("cashier"), thanks: t("thanks") }}
      />
    </main>
  );
}
