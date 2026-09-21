import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("changelog") };
}

type Release = { version: string; title: string; items: string[] };

/** "Nima yangilik": har bir bosqich bo'yicha o'zgarishlar (matn tarjima fayllarida). */
export default async function ChangelogPage() {
  await requireModule("settings");
  const t = await getTranslations("settings.changelog");
  const releases = t.raw("releases") as Release[];
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="text-muted-foreground text-sm">{t("hint")}</p>
      {releases.map((r) => (
        <section key={r.version} className="bg-card flex flex-col gap-2 rounded-lg border p-5">
          <h2 className="flex items-baseline gap-2 font-semibold">
            <span className="text-muted-foreground font-mono text-sm">{r.version}</span>
            {r.title}
          </h2>
          <ul className="text-muted-foreground list-disc pl-5 text-sm">
            {r.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
