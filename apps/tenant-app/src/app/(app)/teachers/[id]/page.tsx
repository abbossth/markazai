import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { EmptyState } from "@/components/shared/empty-state";
import { GroupStatusBadge } from "@/components/shared/status-badge";
import { HistoryList } from "@/components/shared/history-list";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMoney, formatPhone, initials } from "@/lib/format";
import { can } from "@/lib/permissions";
import { param } from "@/lib/search-params";
import { requireModule } from "@/lib/session";
import { isPeriod, toCenterParts, weekdaysOf } from "@markazai/types";
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

  const [profile, lookups, t, tt, te, tw] = await Promise.all([
    loadTeacherProfile(user, id),
    loadTeacherLookups(user),
    getTranslations("teacher"),
    getTranslations("teacher.tabs"),
    getTranslations("enums"),
    getTranslations("enums.weekdaysShort"),
  ]);
  if (!profile) notFound();

  const { teacher, history, roles } = profile;
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

      <header className="bg-card flex flex-wrap items-start gap-4 rounded-lg border p-4">
        <Avatar className="size-16">
          {teacher.photoUrl && <AvatarImage src={teacher.photoUrl} alt="" />}
          <AvatarFallback className="text-lg">{initials(teacher.name)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{teacher.name}</h1>
            {!teacher.isActive && <Badge variant="outline">{t("inactive")}</Badge>}
          </div>
          <p className="text-muted-foreground text-sm">
            ID: {teacher.id.slice(0, 8)} · {formatPhone(teacher.phone)}
          </p>
        </div>
        {canWrite && <TeacherHeaderActions teacher={toEditable(teacher, canSalary)} isActive={teacher.isActive} lookups={lookups} canSalary={canSalary} />}
      </header>

      <Tabs key={tab} defaultValue={tab}>
        <TabsList>
          {TABS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {tt(k)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile" className="flex flex-col gap-6 pt-4">
          <dl className="bg-card grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg border p-4 text-sm">
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">{t("groups")}</h2>
            {teacher.groups.length === 0 ? (
              <EmptyState title={t("noGroups")} />
            ) : (
              <ul className="bg-card max-w-3xl divide-y rounded-lg border">
                {teacher.groups.map((g) => (
                  <li key={g.id}>
                    <details className="group">
                      <summary className="hover:bg-muted/50 flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm">
                        <span className="font-medium">{g.name}</span>
                        <span className="text-muted-foreground">{g.course.name}</span>
                        <GroupStatusBadge status={g.status} />
                        <span className="text-muted-foreground ml-auto text-xs">
                          {g.startTime} · {g.room?.name ?? "—"} · {t("studentsCount", { count: g.enrollments.length })}
                        </span>
                      </summary>
                      <div className="bg-muted/30 flex flex-col gap-2 px-4 py-3 text-sm">
                        <p className="text-muted-foreground text-xs">
                          {te(`days.${g.days}`)} · {g.startTime} ({g.durationMinutes} {t("minutesShort")}) · {g.room ? `${g.room.name} (${g.room.capacity})` : "—"} · {formatMoney(g.price)}
                        </p>
                        {g.enrollments.length === 0 ? (
                          <p className="text-muted-foreground">{t("noStudents")}</p>
                        ) : (
                          <ul className="flex flex-wrap gap-x-4 gap-y-1">
                            {g.enrollments.map((e) => (
                              <li key={e.student.id}>
                                <Link href={`/students/${e.student.id}`} className="hover:underline">
                                  {e.student.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                        <Link href={`/groups/${g.id}`} className="text-primary w-fit text-xs hover:underline">
                          {t("openGroup")} →
                        </Link>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>
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
