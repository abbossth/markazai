import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CONVERSION_GROUPINGS, type ConversionGrouping } from "@markazai/types";
import { FilterBar } from "@/components/data-table/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { resolveRange } from "@/lib/date-range";
import type { RawSearchParams } from "@/lib/search-params";
import type { SessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { loadConversion } from "./queries";
import { ExportButtons } from "./report-tables";
import { SummaryTiles } from "./summary-tiles";

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

/** Konversiya: jami ko'rsatkichlar + manba/kurs/xodim bo'yicha jadval (qatorlar kam bo'lgani uchun sahifalanmaydi). */
export async function ConversionSection({ user, sp, grouping }: { user: SessionUser; sp: RawSearchParams; grouping: ConversionGrouping }) {
  const t = await getTranslations("reports");
  const te = await getTranslations("enums");
  const range = resolveRange(sp);
  const data = await loadConversion(user, sp, range, grouping);
  const s = data.summary;

  const label = (r: (typeof data.rows)[number]) => {
    if (r.key === null) return grouping === "source" ? t("conversion.noSource") : grouping === "course" ? t("conversion.noCourse") : t("conversion.unassigned");
    if (grouping === "source") return te(`leadSource.${r.key as "OTHER"}`);
    return r.name ?? "—";
  };
  // Filtr paneli sana uchun; guruhlash — alohida ichki tab (sana parametrlari saqlanadi).
  const qs = (by: string) => {
    const p = new URLSearchParams({ report: "conversion", by, from: range.from, to: range.to });
    return `/reports?${p.toString()}`;
  };

  return (
    <>
      <SummaryTiles
        items={[
          { label: t("conversion.leads"), value: String(s.leads) },
          { label: t("conversion.convertedCount"), value: String(s.converted) },
          { label: t("conversion.rate"), value: pct(s.rate) },
          { label: t("conversion.paid"), value: String(s.paid) },
          { label: t("conversion.avgDays"), value: s.avgDaysToConvert === null ? "—" : String(s.avgDaysToConvert) },
        ]}
      />
      <p className="text-muted-foreground text-sm">{t("conversion.hint")}</p>
      <FilterBar
        searchPlaceholder=""
        hideSearch
        fields={[
          { name: "from", label: t("from"), type: "date" },
          { name: "to", label: t("to"), type: "date" },
        ]}
        actions={<ExportButtons report="conversion" />}
      />
      <nav className="inline-flex w-fit gap-1 print:hidden" aria-label={t("tabs.conversion")}>
        {CONVERSION_GROUPINGS.map((g) => (
          <Link key={g} href={qs(g)} aria-current={g === grouping ? "page" : undefined} className={cn("text-muted-foreground hover:text-foreground rounded-md border px-3 py-1 text-sm", g === grouping && "bg-secondary text-foreground")}>
            {t(`conversion.by.${g}`)}
          </Link>
        ))}
      </nav>

      {data.rows.length === 0 ? (
        <EmptyState title={t("conversion.empty")} />
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t(`conversion.by.${grouping}`)}</TableHead>
                <TableHead className="text-right">{t("conversion.leads")}</TableHead>
                <TableHead className="text-right">{t("conversion.convertedCount")}</TableHead>
                <TableHead className="text-right">{t("conversion.rate")}</TableHead>
                <TableHead className="text-right">{t("conversion.paid")}</TableHead>
                <TableHead className="text-right">{t("conversion.paidRate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.key ?? "none"}>
                  <TableCell className="font-medium">{label(r)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.leads}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.converted}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{pct(r.rate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.paid}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(r.paidRate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
