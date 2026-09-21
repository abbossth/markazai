import { formatMoney, formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ReceiptCenter = {
  name: string;
  phone?: string | null;
  logoUrl?: string | null;
  /** Markaz nomi tagidagi qo'shimcha satr (sozlanadi). */
  header?: string | null;
  /** Chek pastidagi matn (sozlanadi; bo'sh bo'lsa standart "rahmat" matni). */
  footer?: string | null;
  showLogo: boolean;
  showBranch: boolean;
  showCashier: boolean;
};

export type ReceiptLabels = { title: string; amount: string; balanceAfter: string; cashier: string; thanks: string };

/**
 * Chek ko'rinishi (A4 yoki 80mm termal). Hooks yo'q — ham server sahifasi (chop etish), ham
 * Sozlamalardagi jonli ko'rinish (preview) aynan shu komponentni ishlatadi, shuning uchun ular hech qachon farq qilmaydi.
 */
export function ReceiptView({ thermal, center, branch, number, rows, amount, balance, cashier, labels }: {
  thermal: boolean;
  center: ReceiptCenter;
  branch?: { name: string; address?: string | null } | null;
  number: string;
  rows: [string, string][];
  amount: number;
  balance: number;
  cashier?: string | null;
  labels: ReceiptLabels;
}) {
  return (
    <article className={cn("flex flex-col gap-4 rounded-lg border p-6 print:border-0 print:p-0", thermal && "gap-2 p-3")}>
      <header className="flex items-center gap-3 border-b pb-3">
        {center.showLogo && center.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- ichki /api/files manzili
          <img src={center.logoUrl} alt="" className={cn("object-contain", thermal ? "size-10" : "size-14")} />
        )}
        <div className="flex flex-col">
          <h1 className={cn("font-semibold", thermal ? "text-sm" : "text-xl")}>{center.name}</h1>
          {center.header && <span className="text-muted-foreground">{center.header}</span>}
          {center.showBranch && branch && (
            <span className="text-muted-foreground">
              {branch.name}
              {branch.address ? `, ${branch.address}` : ""}
            </span>
          )}
          {center.phone && <span className="text-muted-foreground">{formatPhone(center.phone)}</span>}
        </div>
      </header>

      <div className="flex items-baseline justify-between">
        <h2 className={cn("font-semibold uppercase", thermal ? "text-xs" : "text-base")}>{labels.title}</h2>
        <span className="text-muted-foreground">№ {number}</span>
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
        <span className="text-muted-foreground">{labels.amount}</span>
        <span className={cn("font-bold tabular-nums", thermal ? "text-base" : "text-2xl")}>{formatMoney(amount)}</span>
      </div>

      <footer className="text-muted-foreground flex flex-col gap-0.5">
        <span>
          {labels.balanceAfter}: <span className="text-foreground font-medium tabular-nums">{formatMoney(balance)}</span>
        </span>
        {center.showCashier && (
          <span>
            {labels.cashier}: {cashier ?? "—"}
          </span>
        )}
        <span className="mt-2 text-center">{center.footer || labels.thanks}</span>
      </footer>
    </article>
  );
}
