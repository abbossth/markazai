import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { prisma } from "@markazai/db";
import { CommentsPanel } from "@/components/shared/comments-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { RemindersPanel } from "@/components/shared/reminders-panel";
import { GroupStatusBadge } from "@/components/shared/status-badge";
import { HistoryList } from "@/components/shared/history-list";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Flag, MessageSquare, Phone, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMoney, formatPhone, initials } from "@/lib/format";
import { can } from "@/lib/permissions";
import { param } from "@/lib/search-params";
import { requireModule } from "@/lib/session";
import { isPeriod, toCenterParts, weekdaysOf } from "@markazai/types";
import { loadReminderItems, loadReminderLookups } from "../../reminders/queries";
import { loadTeacherLookups, loadTeacherProfile, toEditable } from "../queries";
import { TeacherHeaderActions } from "./header-actions";
import { TeacherSalaryTab } from "./salary-tab";

const ALL_TABS = ["profile", "history", "salary"] as const;
type Tab = (typeof ALL_TABS)[number];

export async function generateMetadata({ params }: PageProps<"/teachers/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("nav");
  return { title: `${t("teachers")} · ${id.slice(0, 8)}` };
}

export default async function TeacherProfilePage({ params, searchParams }: PageProps<"/teachers/[id]">) {
  const user = await requireModule("teachers");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [profile, lookups, reminders, reminderLookups, comments, t, tt, te, tw] = await Promise.all([
    loadTeacherProfile(user, id),
    loadTeacherLookups(user),
    loadReminderItems(user, { teacherId: id }),
    loadReminderLookups(user),
    prisma.comment.findMany({ where: { organizationId: user.orgId, teacherId: id }, orderBy: { createdAt: "desc" }, take: 100 }),
    getTranslations("teacher"),
    getTranslations("teacher.tabs"),
    getTranslations("enums"),
    getTranslations("enums.weekdaysShort"),
  ]);
  if (!profile) notFound();

  const { teacher, history, roles } = profile;
  const authors = comments.length ? await prisma.user.findMany({ where: { organizationId: user.orgId, id: { in: [...new Set(comments.map((c) => c.authorId))] } }, select: { id: true, name: true } }) : [];
  const authorName = new Map(authors.map((a) => [a.id, a.name]));
  const sp = await searchParams;
  const canWrite = can(user.roles, "teachers:write");
  const canSalary = can(user.roles, "salary:read");
  // "Ish haqi" tabi faqat salary:read ruxsati borlarga ko'rinadi.
  const TABS = ALL_TABS.filter((k) => k !== "salary" || canSalary);
  const requested = param(sp, "tab");
  const tab: Tab = (TABS as readonly string[]).includes(requested ?? "") ? (requested as Tab) : "profile";
  const monthParam = param(sp, "month");
  const period = isPeriod(monthParam) ? monthParam : toCenterParts(new Date()).date.slice(0, 7);
  const roleLabels = (roles.length ? roles : ["TEACHER"]).map((r) => te(`roles.${r as "CEO"}`));
  const activeGroups = teacher.groups.filter((g) => g.status === "ACTIVE");
  const studentCount = new Set(activeGroups.flatMap((g) => g.enrollments.map((e) => e.student.id))).size;
  const days = weekdaysOf("OTHER", teacher.workDays).map((d) => tw(String(d) as "1")).join(", ");

  const details: [string, React.ReactNode][] = [
    [t("phone"), formatPhone(teacher.phone)],
    [t("birthDate"), teacher.birthDate ? formatDate(teacher.birthDate) : "—"],
    [t("gender"), teacher.gender ? t(teacher.gender === "MALE" ? "male" : "female") : "—"],
    [t("roles"), roleLabels.join(", ")],
    [t("branches"), teacher.branches.length ? teacher.branches.map((b) => b.branch.name).join(", ") : "—"],
    ...(canSalary
      ? ([
          [t("salaryType"), teacher.salaryType === "PERCENT" ? t("percentValue", { percent: teacher.percent ?? 0 }) : `${t("salaryFixed")}: ${formatMoney(teacher.fixedSalary ?? 0)}`],
          ...(teacher.salaryType === "FIXED" ? [[t("workDays"), `${days || "—"}${teacher.workStart ? ` · ${teacher.workStart}–${teacher.workEnd ?? ""}` : ""}`]] : []),
        ] as [string, React.ReactNode][])
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="text-muted-foreground text-sm print:hidden">
        <Link href="/teachers" className="hover:underline">
          {t("title")}
        </Link>{" "}
        / {teacher.name}
      </div>

      <header className="bg-card flex flex-wrap items-center gap-4 rounded-xl border p-4 sm:p-5">
        <Avatar className="size-16">
          {teacher.photoUrl && <AvatarImage src={teacher.photoUrl} alt="" />}
          <AvatarFallback className="text-lg">{initials(teacher.name)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{teacher.name}</h1>
            <Badge variant={teacher.isActive ? "secondary" : "outline"}>{teacher.isActive ? t("active") : t("inactive")}</Badge>
            {roleLabels.map((r) => (
              <Badge key={r} variant="outline" className="font-normal">
                {r}
              </Badge>
            ))}
          </div>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <a href={`tel:+${teacher.phone}`} className="hover:text-foreground inline-flex items-center gap-1.5 tabular-nums">
              <Phone className="size-3.5" />
              {formatPhone(teacher.phone)}
            </a>
            <span className="text-xs">ID: {teacher.id.slice(0, 8)}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatTile icon={<BookOpen className="size-4" />} label={t("groups")} value={activeGroups.length} />
          <StatTile icon={<Users className="size-4" />} label={t("students")} value={studentCount} />
        </div>
        <a href="#teacher-reminders" className="border-input hover:bg-muted inline-flex size-8 items-center justify-center rounded-lg border text-emerald-600 print:hidden" aria-label={t("reminders")} title={t("reminders")}>
          <Flag className="size-4" />
        </a>
        {canWrite && <TeacherHeaderActions teacher={toEditable(teacher, canSalary)} isActive={teacher.isActive} lookups={lookups} canSalary={canSalary} />}
      </header>

      <Tabs key={tab} defaultValue={tab}>
        <TabsList className="h-10">
          {TABS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {tt(k)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile" className="grid items-start gap-5 pt-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <aside className="bg-card flex flex-col gap-1 rounded-xl border p-5 lg:sticky lg:top-4">
            <h2 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">{tt("profile")}</h2>
            <dl className="flex flex-col divide-y text-sm">
              {details.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                  <dt className="text-muted-foreground shrink-0">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </aside>

          <div className="flex min-w-0 flex-col gap-5">
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">
                {t("groups")} <span className="text-muted-foreground text-sm font-normal">({teacher.groups.length})</span>
              </h2>
              {teacher.groups.length === 0 ? (
                <EmptyState title={t("noGroups")} />
              ) : (
                <ul className="grid gap-3 xl:grid-cols-2">
                  {teacher.groups.map((g) => (
                    <li key={g.id} className="bg-card hover:border-primary/30 flex flex-col gap-3 rounded-xl border p-4 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex items-center gap-2 font-semibold">
                            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.course.color }} aria-hidden />
                            {g.name}
                            <GroupStatusBadge status={g.status} />
                          </span>
                          <span className="text-muted-foreground text-sm">{g.course.name}</span>
                        </div>
                        <Link href={`/groups/${g.id}`} className="text-primary shrink-0 text-xs whitespace-nowrap hover:underline">
                          {t("openGroup")} →
                        </Link>
                      </div>
                      <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        <span>{te(`days.${g.days}`)} · {g.startTime}–{endTimeOf(g.startTime, g.durationMinutes)}</span>
                        <span>{g.room?.name ?? "—"}</span>
                        <span className="font-medium">{formatMoney(g.price)}</span>
                      </p>
                      <details className="group border-t pt-3">
                        <summary className="hover:text-foreground text-muted-foreground flex cursor-pointer list-none items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5">
                            <Users className="size-3.5" />
                            {t("studentsCount", { count: g.enrollments.length })}
                          </span>
                          <span className="text-[10px] group-open:hidden">▾</span>
                          <span className="hidden text-[10px] group-open:inline">▴</span>
                        </summary>
                        {g.enrollments.length === 0 ? (
                          <p className="text-muted-foreground mt-2 text-sm">{t("noStudents")}</p>
                        ) : (
                          <ul className="mt-2 flex flex-wrap gap-1.5">
                            {g.enrollments.map((e) => (
                              <li key={e.student.id}>
                                <Link href={`/students/${e.student.id}`} className="bg-muted/60 hover:bg-muted rounded-full px-2.5 py-1 text-xs">
                                  {e.student.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="grid items-start gap-5 xl:grid-cols-2">
              <section id="teacher-reminders" className="bg-card flex scroll-mt-20 flex-col gap-3 rounded-xl border p-4">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Flag className="size-4 text-emerald-600" />
                  {t("reminders")}
                  {reminders.length > 0 && <span className="text-muted-foreground text-sm font-normal">({reminders.length})</span>}
                </h2>
                <RemindersPanel
                  link={{ teacherId: teacher.id }}
                  items={reminders}
                  lookups={reminderLookups}
                  currentUserId={user.id}
                  canWrite={canWrite}
                  canDeleteAny={user.roles.includes("CEO")}
                  today={toCenterParts(new Date()).date}
                  compact
                />
              </section>
              <section className="bg-card flex flex-col gap-3 rounded-xl border p-4">
                <h2 className="flex items-center gap-2 font-semibold">
                  <MessageSquare className="text-muted-foreground size-4" />
                  {t("comments")}
                  {comments.length > 0 && <span className="text-muted-foreground text-sm font-normal">({comments.length})</span>}
                </h2>
                <CommentsPanel
                  target={{ teacherId: teacher.id }}
                  currentUserId={user.id}
                  canDeleteAny={user.roles.includes("CEO")}
                  comments={comments.map((c) => ({ id: c.id, authorId: c.authorId, authorName: authorName.get(c.authorId) ?? "—", body: c.body, createdAt: c.createdAt.toISOString() }))}
                />
              </section>
            </div>
          </div>
        </TabsContent>

        {canSalary && (
          <TabsContent value="salary" className="pt-4">
            <TeacherSalaryTab orgId={user.orgId} teacherId={teacher.id} period={period} />
          </TabsContent>
        )}

        <TabsContent value="history" className="pt-4">
          <HistoryList items={history.map((h) => ({ id: h.id, action: h.action, actorName: h.actorName, createdAt: h.createdAt.toISOString(), details: (h.details as Record<string, unknown> | null) ?? null }))} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-muted/50 flex min-w-24 flex-col gap-0.5 rounded-lg border px-3 py-2">
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {icon}
        {label}
      </span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function endTimeOf(start: string, minutes: number) {
  const [h, m] = start.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
