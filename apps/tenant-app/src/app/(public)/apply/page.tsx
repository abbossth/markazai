import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GraduationCap } from "lucide-react";
import { prisma } from "@markazai/db";
import { normalizeLeadFormFields } from "@markazai/types";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Card, CardContent } from "@/components/ui/card";
import { loadCenter } from "@/lib/center";
import { notFound } from "next/navigation";
import { currentTenant } from "@/lib/tenant";
import { LeadFormView } from "./lead-form-view";

export async function generateMetadata(): Promise<Metadata> {
  const center = await loadCenter();
  return { title: center?.name ?? "Markazai" };
}

/** Ommaviy ariza formasi: markaz saytiga havola/iframe sifatida joylanadi. Kirish talab qilinmaydi. */
export default async function ApplyPage() {
  const tenant = await currentTenant();
  // Tashkilot topilmasa yoki obunasi yopiq bo'lsa — ommaviy forma ham ishlamaydi.
  if (!tenant?.access.allowed) notFound();
  const orgId = tenant.orgId;
  const [t, center, form, courses] = await Promise.all([
    getTranslations("apply"),
    loadCenter(),
    prisma.leadForm.findUnique({ where: { organizationId: orgId } }),
    prisma.course.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <main className="bg-muted/40 relative flex min-h-screen items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col gap-6 p-6">
          <div className="flex items-center gap-3">
            {center?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- ichki /api/files manzili
              <img src={center.logoUrl} alt="" className="size-10 rounded-lg object-contain" />
            ) : (
              <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg">
                <GraduationCap className="size-6" />
              </div>
            )}
            <span className="font-semibold">{center?.name ?? "Markazai"}</span>
          </div>
          {form?.enabled ? (
            <LeadFormView
              courses={courses}
              config={{ title: form.title, description: form.description, submitLabel: form.submitLabel, successMessage: form.successMessage, fields: normalizeLeadFormFields(form.fields) }}
            />
          ) : (
            <p className="text-muted-foreground py-6 text-center text-sm">{t("unavailable")}</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
