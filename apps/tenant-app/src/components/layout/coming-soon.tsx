import { getTranslations } from "next-intl/server";
import { Construction } from "lucide-react";

export async function ComingSoon({ navKey }: { navKey: "leads" | "teachers" | "groups" | "students" | "finance" | "reports" | "settings" }) {
  const tn = await getTranslations("nav");
  const tc = await getTranslations("common");

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{tn(navKey)}</h1>
      <div className="text-muted-foreground mt-8 flex flex-col items-center gap-3 py-16">
        <Construction className="size-10" />
        <p>{tc("comingSoon")}</p>
      </div>
    </div>
  );
}
