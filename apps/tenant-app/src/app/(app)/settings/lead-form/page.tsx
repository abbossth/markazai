import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@markazai/db";
import { defaultLeadFormFields, normalizeLeadFormFields, type LeadFormInput } from "@markazai/types";
import { requireModule } from "@/lib/session";
import { LeadFormBuilder } from "./lead-form-builder";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("leadForm") };
}

export default async function LeadFormPage() {
  const user = await requireModule("settings");
  const t = await getTranslations("settings.leadForm");
  const [form, columns, courses] = await Promise.all([
    prisma.leadForm.findUnique({ where: { organizationId: user.orgId } }),
    prisma.leadColumn.findMany({ where: { organizationId: user.orgId }, orderBy: { position: "asc" }, select: { id: true, name: true } }),
    prisma.course.findMany({ where: { organizationId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const initial: LeadFormInput = {
    enabled: form?.enabled ?? false,
    title: form?.title ?? t("defaults.title"),
    description: form?.description ?? t("defaults.description"),
    submitLabel: form?.submitLabel ?? t("defaults.submit"),
    successMessage: form?.successMessage ?? t("defaults.success"),
    columnId: form?.columnId ?? "",
    fields: form ? normalizeLeadFormFields(form.fields) : defaultLeadFormFields(),
  };
  return <LeadFormBuilder initial={initial} columns={columns} courses={courses} />;
}
