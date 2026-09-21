import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight, CircleCheck } from "lucide-react";
import { z } from "zod";
import { LEAD_SOURCES } from "@markazai/types";
import { CallsTab } from "@/components/shared/calls-tab";
import { CommentsPanel } from "@/components/shared/comments-panel";
import { HistoryList } from "@/components/shared/history-list";
import { RemindersPanel } from "@/components/shared/reminders-panel";
import { SmsTab } from "@/components/shared/sms-tab";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatDateTime, formatPhone } from "@/lib/format";
import { can } from "@/lib/permissions";
import { param } from "@/lib/search-params";
import { requireModule } from "@/lib/session";
import { toCenterParts } from "@markazai/types";
import { loadReminderItems, loadReminderLookups } from "../../reminders/queries";
import { loadStudentLookups } from "../../students/queries";
import { LeadHeaderActions } from "./header-actions";
import { loadLeadLookups, loadLeadProfile } from "./queries";

const TABS = ["comments", "reminders", "calls", "sms", "history"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata({ params }: PageProps<"/leads/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("nav");
  return { title: `${t("leads")} · ${id.slice(0, 8)}` };
}

export default async function LeadProfilePage({ params, searchParams }: PageProps<"/leads/[id]">) {
  const user = await requireModule("leads");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [profile, lookups, studentLookups, reminderLookups, reminders, t, tt, te] = await Promise.all([
    loadLeadProfile(user, id),
    loadLeadLookups(user),
    loadStudentLookups(user),
    loadReminderLookups(user),
    loadReminderItems(user, { leadId: id }),
    getTranslations("lead"),
    getTranslations("lead.tabs"),
    getTranslations("enums"),
  ]);
  if (!profile) notFound();

  const { lead, comments, calls, sms, history, userNames } = profile;
  const sp = await searchParams;
  const requested = param(sp, "tab");
  const tab: Tab = (TABS as readonly string[]).includes(requested ?? "") ? (requested as Tab) : "comments";

  const canWrite = can(user.roles, "leads:write") && !lead.convertedStudentId;
  const source = LEAD_SOURCES.find((s) => s.value === lead.source);
  const name = (uid: string | null | undefined) => (uid ? (userNames.get(uid) ?? "—") : "—");

  const details: [string, React.ReactNode][] = [
    [t("phone"), formatPhone(lead.phone)],
    [t("column"), lead.list ? `${lead.column.name} / ${lead.list.name}` : lead.column.name],
    [t("source"), source ? te(`leadSource.${source.value}`) : "—"],
    [t("assignee"), name(lead.assignedToId)],
    [t("course"), lead.course?.name ?? "—"],
    [t("days"), lead.daysPattern ? te(`days.${lead.daysPattern}`) : "—"],
    [t("createdAt"), formatDate(lead.createdAt)],
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="text-muted-foreground text-sm print:hidden">
        <Link href="/leads" className="hover:underline">
          {t("title")}
        </Link>{" "}
        / {lead.name}
      </div>

      {lead.convertedStudent && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-800 dark:text-emerald-300">
          <CircleCheck className="size-4 shrink-0" />
          <span>{t("convertedBanner", { date: formatDateTime(lead.convertedAt ?? lead.updatedAt) })}</span>
          <Link href={`/students/${lead.convertedStudent.id}`} className="ml-auto inline-flex items-center gap-1 font-medium hover:underline">
            {lead.convertedStudent.name} <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold">{lead.name}</h1>
          {lead.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {lead.tags.map((x) => (
                <Badge key={x.tagId} variant="secondary">
                  {x.tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <LeadHeaderActions
          lead={{
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            source: lead.source,
            columnId: lead.columnId,
            listId: lead.listId,
            note: lead.note,
            assignedToId: lead.assignedToId,
            courseId: lead.courseId,
            daysPattern: lead.daysPattern,
            tagIds: lead.tags.map((x) => x.tagId),
          }}
          converted={!!lead.convertedStudentId}
          lookups={lookups}
          groups={studentLookups.groups}
          canWrite={canWrite}
          canConvert={canWrite && can(user.roles, "students:write")}
          canDelete={can(user.roles, "leads:delete") && !lead.convertedStudentId}
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4">
          <dl className="bg-card grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border p-4 text-sm">
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          {lead.note && (
            <div className="bg-card rounded-lg border p-4 text-sm">
              <div className="text-muted-foreground mb-1 text-xs">{t("note")}</div>
              <p className="whitespace-pre-wrap">{lead.note}</p>
            </div>
          )}
        </aside>

        <section className="min-w-0">
          <Tabs defaultValue={tab}>
            <TabsList>
              {TABS.map((k) => (
                <TabsTrigger key={k} value={k}>
                  {tt(k)}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="comments" className="pt-4">
              <CommentsPanel
                target={{ leadId: lead.id }}
                currentUserId={user.id}
                canDeleteAny={user.roles.includes("CEO")}
                comments={comments.map((c) => ({ id: c.id, authorId: c.authorId, authorName: name(c.authorId), body: c.body, createdAt: c.createdAt.toISOString() }))}
              />
            </TabsContent>
            <TabsContent value="reminders" className="pt-4">
              <RemindersPanel
                link={{ leadId: lead.id }}
                items={reminders}
                lookups={reminderLookups}
                currentUserId={user.id}
                canWrite={canWrite}
                canDeleteAny={user.roles.includes("CEO")}
                today={toCenterParts(new Date()).date}
              />
            </TabsContent>
            <TabsContent value="calls" className="pt-4">
              <CallsTab
                target={{ leadId: lead.id }}
                canWrite={canWrite}
                items={calls.map((c) => ({ id: c.id, direction: c.direction, outcome: c.outcome, durationSeconds: c.durationSeconds, note: c.note, createdAt: c.createdAt.toISOString(), authorName: name(c.createdById) }))}
              />
            </TabsContent>
            <TabsContent value="sms" className="pt-4">
              <SmsTab
                target={{ leadId: lead.id }}
                canWrite={canWrite}
                items={sms.map((s) => ({ id: s.id, text: s.text, status: s.status, senderName: name(s.sentById), createdAt: s.createdAt.toISOString() }))}
              />
            </TabsContent>
            <TabsContent value="history" className="pt-4">
              <HistoryList
                items={history.map((h) => ({ id: h.id, action: h.action, actorName: h.actorName, createdAt: h.createdAt.toISOString(), details: (h.details as Record<string, unknown> | null) ?? null }))}
              />
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </div>
  );
}
