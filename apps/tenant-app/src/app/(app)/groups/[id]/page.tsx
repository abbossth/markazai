import type { Metadata } from "next";
import { loadHolidayDates, prisma } from "@markazai/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { toCenterParts, toISODate, weekdaysOf } from "@markazai/types";
import { loadReminderItems, loadReminderLookups } from "../../reminders/queries";
import { CommentsPanel } from "@/components/shared/comments-panel";
import { HistoryList } from "@/components/shared/history-list";
import { RemindersPanel } from "@/components/shared/reminders-panel";
import { GroupStatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMoney } from "@/lib/format";
import { can, canAccess } from "@/lib/permissions";
import { param } from "@/lib/search-params";
import { requireModule } from "@/lib/session";
import { loadGroupLookups } from "../queries";
import { GroupHeaderActions } from "./header-actions";
import { DiscountsTab, ExamsTab, OnlineLessonsTab } from "./extras-tabs";
import { LessonGrid } from "./lesson-grid";
import { loadGroupProfile } from "./queries";
import { GroupStudentsPanel } from "./students-panel";

const TABS = ["attendance", "grades", "online", "discounts", "exams", "history", "comments"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata({ params }: PageProps<"/groups/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("nav");
  return { title: `${t("groups")} · ${id.slice(0, 8)}` };
}

const endTime = (start: string, minutes: number) => {
  const total = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)) + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export default async function GroupProfilePage({ params, searchParams }: PageProps<"/groups/[id]">) {
  const user = await requireModule("groups");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [profile, lookups, reminderLookups, reminders, t, tt, te, tw] = await Promise.all([
    loadGroupProfile(user, id),
    loadGroupLookups(user),
    loadReminderLookups(user),
    loadReminderItems(user, { groupId: id }),
    getTranslations("group"),
    getTranslations("group.tabs"),
    getTranslations("enums"),
    getTranslations("enums.weekdaysShort"),
  ]);
  if (!profile) notFound();

  const { group, attendance, grades, comments, history, userNames } = profile;
  const sp = await searchParams;
  const requested = param(sp, "tab");
  const tab: Tab = (TABS as readonly string[]).includes(requested ?? "") ? (requested as Tab) : "attendance";

  const canWrite = can(user.roles, "groups:write");
  const canFinance = canAccess(user.roles, "finance");
  const today = toISODate(new Date());
  const active = group.enrollments.filter((e) => !e.leftAt);
  const daysLabel =
    group.days === "OTHER"
      ? weekdaysOf("OTHER", group.customDays).map((d) => tw(String(d) as "1")).join(", ")
      : te(`days.${group.days}`);

  const details: [string, React.ReactNode][] = [
    [t("course"), group.course.name],
    [t("teacher"), group.teacher.name],
    [t("price"), formatMoney(group.price)],
    [t("time"), `${daysLabel} · ${group.startTime}–${endTime(group.startTime, group.durationMinutes)}`],
    [t("room"), group.room?.name ?? "—"],
    [t("capacity"), group.room ? `${active.length}/${group.room.capacity}` : String(active.length)],
    [t("dates"), `${formatDate(group.startDate)} – ${formatDate(group.endDate)}`],
    ["ID", group.id.slice(0, 8)],
  ];

  const members = group.enrollments.map((e) => ({
    studentId: e.studentId,
    name: e.student.name,
    joinedAt: toISODate(e.joinedAt),
    leftAt: e.leftAt ? toISODate(e.leftAt) : null,
  }));
  const schedule = {
    id: group.id,
    days: group.days,
    customDays: group.customDays,
    startDate: toISODate(group.startDate),
    endDate: group.endDate ? toISODate(group.endDate) : null,
    holidays: await loadHolidayDates(prisma, user.orgId),
  };
  const canMark = can(user.roles, "attendance:write");

  return (
    <div className="flex flex-col gap-5">
      <div className="text-muted-foreground text-sm print:hidden">
        <Link href="/groups" className="hover:underline">
          {t("title")}
        </Link>{" "}
        / {group.name}
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">
              {group.name} <span className="text-muted-foreground font-normal">• {group.course.name} • {group.teacher.name}</span>
            </h1>
            <GroupStatusBadge status={group.status} />
          </div>
          {group.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {group.tags.map((x) => (
                <Badge key={x.tagId} variant="secondary">
                  {x.tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <GroupHeaderActions
          group={{
            id: group.id,
            name: group.name,
            courseId: group.courseId,
            teacherId: group.teacherId,
            roomId: group.roomId,
            days: group.days,
            customDays: group.customDays,
            startTime: group.startTime,
            durationMinutes: group.durationMinutes,
            startDate: toISODate(group.startDate),
            endDate: group.endDate ? toISODate(group.endDate) : null,
            price: group.price,
            tagIds: group.tags.map((x) => x.tagId),
          }}
          status={group.status}
          lookups={lookups}
          canWrite={canWrite}
          canDelete={can(user.roles, "groups:delete")}
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <aside className="flex flex-col gap-5">
          <dl className="bg-card grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border p-4 text-sm">
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <GroupStudentsPanel
            groupId={group.id}
            canWrite={canWrite}
            students={group.enrollments.map((e) => ({
              id: e.student.id,
              name: e.student.name,
              phone: e.student.phone,
              status: e.student.status,
              balance: canFinance ? e.student.balance : null,
              freezeReason: e.student.freezeReason,
              createdAt: e.student.createdAt.toISOString(),
              archived: !!e.leftAt,
            }))}
          />
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">{t("reminders")}</h2>
            <RemindersPanel
              link={{ groupId: group.id }}
              items={reminders}
              lookups={reminderLookups}
              currentUserId={user.id}
              canWrite={canWrite}
              canDeleteAny={user.roles.includes("CEO")}
              today={toCenterParts(new Date()).date}
              compact
            />
          </section>
        </aside>

        <section className="min-w-0">
          <Tabs defaultValue={tab}>
            <TabsList className="h-auto flex-wrap">
              {TABS.map((k) => (
                <TabsTrigger key={k} value={k}>
                  {tt(k)}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="attendance" className="pt-4">
              <LessonGrid
                mode="attendance"
                group={schedule}
                members={members}
                today={today}
                canEdit={canMark}
                records={attendance.map((a) => ({ studentId: a.studentId, date: toISODate(a.date), value: a.status }))}
              />
            </TabsContent>
            <TabsContent value="grades" className="pt-4">
              <LessonGrid
                mode="grades"
                group={schedule}
                members={members}
                today={today}
                canEdit={canMark}
                records={grades.map((g) => ({ studentId: g.studentId, date: toISODate(g.date), value: g.score }))}
              />
            </TabsContent>
            <TabsContent value="online" className="pt-4">
              <OnlineLessonsTab groupId={group.id} canWrite={canWrite} items={group.onlineLessons.map((o) => ({ id: o.id, title: o.title, url: o.url }))} />
            </TabsContent>
            <TabsContent value="discounts" className="pt-4">
              <DiscountsTab
                groupId={group.id}
                groupPrice={group.price}
                canWrite={canWrite}
                members={active.map((e) => ({ id: e.studentId, name: e.student.name }))}
                items={group.discounts.map((d) => ({
                  id: d.id,
                  studentName: d.student.name,
                  amount: d.amount,
                  fromDate: d.fromDate.toISOString(),
                  toDate: d.toDate?.toISOString() ?? null,
                  reason: d.reason,
                }))}
              />
            </TabsContent>
            <TabsContent value="exams" className="pt-4">
              <ExamsTab
                groupId={group.id}
                canWrite={canWrite}
                items={group.exams.map((e) => ({
                  id: e.id,
                  name: e.name,
                  date: e.date.toISOString(),
                  durationMinutes: e.durationMinutes,
                  maxScore: e.maxScore,
                  passScore: e.passScore,
                  fileUrl: e.fileUrl,
                }))}
              />
            </TabsContent>
            <TabsContent value="history" className="pt-4">
              <HistoryList
                items={history.map((h) => ({
                  id: h.id,
                  action: h.action,
                  actorName: h.actorName,
                  createdAt: h.createdAt.toISOString(),
                  details: (h.details as Record<string, unknown> | null) ?? null,
                }))}
              />
            </TabsContent>
            <TabsContent value="comments" className="pt-4">
              <CommentsPanel
                target={{ groupId: group.id }}
                currentUserId={user.id}
                canDeleteAny={user.roles.includes("CEO")}
                comments={comments.map((c) => ({ id: c.id, authorId: c.authorId, authorName: userNames.get(c.authorId) ?? "—", body: c.body, createdAt: c.createdAt.toISOString() }))}
              />
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </div>
  );
}
