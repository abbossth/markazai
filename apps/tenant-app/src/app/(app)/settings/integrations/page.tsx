import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { decryptSecret, prisma } from "@markazai/db";
import { INTEGRATIONS, INTEGRATION_KINDS, maskSecret } from "@markazai/types";
import { requireModule } from "@/lib/session";
import { IntegrationsView, type IntegrationItem } from "./integrations-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("integrations") };
}

export default async function IntegrationsPage() {
  const user = await requireModule("settings");
  const rows = await prisma.integration.findMany({ where: { organizationId: user.orgId } });

  // Sirlar mijozga HECH QACHON to'liq yuborilmaydi — faqat maskalangan ko'rinish (oxirgi 4 belgi).
  const items: IntegrationItem[] = INTEGRATION_KINDS.map((kind) => {
    const row = rows.find((r) => r.kind === kind);
    const config = (row?.config ?? {}) as Record<string, string>;
    const values: Record<string, string> = {};
    const masked: Record<string, string> = {};
    for (const f of INTEGRATIONS[kind].fields) {
      const raw = config[f.key] ?? "";
      if (!f.secret) values[f.key] = raw;
      else {
        try {
          masked[f.key] = raw ? maskSecret(decryptSecret(raw)) : "";
        } catch {
          masked[f.key] = ""; // shifrlash kaliti almashtirilgan — qayta kiritish kerak
        }
      }
    }
    return { kind, group: INTEGRATIONS[kind].group, fields: INTEGRATIONS[kind].fields.map((f) => ({ key: f.key, secret: f.secret })), enabled: row?.enabled ?? false, values, masked };
  });
  return <IntegrationsView items={items} />;
}
