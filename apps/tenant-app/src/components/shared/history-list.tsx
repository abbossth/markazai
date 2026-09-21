"use client";

import { useTranslations } from "next-intl";
import { formatDateTime } from "@/lib/format";

export type HistoryItem = {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: string;
  details: Record<string, unknown> | null;
};

export function HistoryList({ items }: { items: HistoryItem[] }) {
  const t = useTranslations("history");
  const te = useTranslations("enums.studentStatus");
  const tco = useTranslations("enums.callOutcome");
  const tss = useTranslations("enums.smsStatus");
  const has = (key: string) => t.has(`actions.${key}` as "actions.created");

  const describe = (item: HistoryItem) => {
    const d = item.details ?? {};
    const label = has(item.action) ? t(`actions.${item.action}` as "actions.created") : item.action;
    switch (item.action) {
      case "status_changed": {
        const from = te.has(String(d.from) as "ACTIVE") ? te(String(d.from) as "ACTIVE") : String(d.from);
        const to = te.has(String(d.to) as "ACTIVE") ? te(String(d.to) as "ACTIVE") : String(d.to);
        return `${label}: ${from} → ${to}${d.reason ? ` (${String(d.reason)})` : ""}`;
      }
      case "lead_moved":
        return `${label}: ${String(d.from ?? "")} → ${String(d.to ?? "")}`;
      case "converted":
        return `${label}: ${String(d.studentName ?? "")}`;
      case "created_from_lead":
        return `${label}: ${String(d.leadName ?? "")}`;
      case "call_logged":
        return `${label}: ${tco.has(String(d.outcome) as "ANSWERED") ? tco(String(d.outcome) as "ANSWERED") : String(d.outcome ?? "")}`;
      case "sms_sent":
        return `${label}: ${tss.has(String(d.status) as "SENT") ? tss(String(d.status) as "SENT") : String(d.status ?? "")}`;
      case "joined_group":
      case "left_group":
        return `${label}: ${String(d.groupName ?? "")}`;
      case "student_joined":
      case "student_left":
        return `${label}: ${String(d.studentName ?? "")}`;
      default:
        return d.summary ? `${label}: ${String(d.summary)}` : label;
    }
  };

  if (items.length === 0) return <p className="text-muted-foreground text-sm">{t("empty")}</p>;

  return (
    <ol className="border-border relative ml-2 max-w-2xl border-l">
      {items.map((item) => (
        <li key={item.id} className="mb-4 ml-4">
          <span className="bg-primary absolute -left-1.5 mt-1.5 size-3 rounded-full" />
          <p className="text-sm">{describe(item)}</p>
          <p className="text-muted-foreground text-xs">
            {item.actorName ?? "—"} · {formatDateTime(item.createdAt)}
          </p>
        </li>
      ))}
    </ol>
  );
}
