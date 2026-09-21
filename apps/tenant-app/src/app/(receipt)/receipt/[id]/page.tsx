import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { prisma } from "@markazai/db";
import { formatDate, formatMoney, formatPhone } from "@/lib/format";
import { requireModule } from "@/lib/session";
import { cn } from "@/lib/utils";
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

      <article className={cn("flex flex-col gap-4 rounded-lg border p-6 print:border-0 print:p-0", thermal && "gap-2 p-3")}>
        <header className="flex items-center gap-3 border-b pb-3">
          {settings?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- logotip tashqi URL (Sozlamalarda yuklanadi)
            <img src={settings.logoUrl} alt="" className={cn("object-contain", thermal ? "size-10" : "size-14")} />
          )}
          <div className="flex flex-col">
            <h1 className={cn("font-semibold", thermal ? "text-sm" : "text-xl")}>{settings?.name ?? "Markazai"}</h1>
            {branch && (
              <span className="text-muted-foreground">
                {branch.name}
                {branch.address ? `, ${branch.address}` : ""}
              </span>
            )}
            {settings?.phone && <span className="text-muted-foreground">{formatPhone(settings.phone)}</span>}
          </div>
        </header>

        <div className="flex items-baseline justify-between">
          <h2 className={cn("font-semibold uppercase", thermal ? "text-xs" : "text-base")}>{t("title")}</h2>
          <span className="text-muted-foreground">№ {payment.id.slice(0, 8).toUpperCase()}</span>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex items-baseline justify-between border-y py-3">
          <span className="text-muted-foreground">{t("amount")}</span>
          <span className={cn("font-bold tabular-nums", thermal ? "text-base" : "text-2xl")}>{formatMoney(payment.amount)}</span>
        </div>

        <footer className="text-muted-foreground flex flex-col gap-0.5">
          <span>
            {t("balanceAfter")}: <span className="text-foreground font-medium tabular-nums">{formatMoney(payment.student.balance)}</span>
          </span>
          <span>
            {t("cashier")}: {cashier?.name ?? "—"}
          </span>
          <span className="mt-2 text-center">{t("thanks")}</span>
        </footer>
      </article>
    </main>
  );
}
