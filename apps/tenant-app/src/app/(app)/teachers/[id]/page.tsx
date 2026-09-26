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
import { BookOpen, Phone, Users } from "lucide-react";
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

        <TabsContent value="profile" className="grid items-start gap-6 pt-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <dl className="bg-card grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-xl border p-4 text-sm">
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">
              {t("groups")} <span className="text-muted-foreground text-sm font-normal">({teacher.groups.length})</span>
            </h2>
            {teacher.groups.length === 0 ? (
              <EmptyState title={t("noGroups")} />
            ) : (
              <ul className="flex flex-col gap-2">
                {teacher.groups.map((g) => (
                  <li key={g.id} className="bg-card rounded-xl border">
                    <details className="group">
                      <summary className="hover:bg-muted/40 flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-3">
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            {g.name}
                            <GroupStatusBadge status={g.status} />
                          </span>
                          <span className="text-muted-foreground truncate text-xs">
                            {g.course.name} · {te(`days.${g.days}`)} · {g.startTime} · {g.room?.name ?? "—"}
                          </span>
                        </div>
                        <Badge variant="secondary" className="tabular-nums">
                          {t("studentsCount", { count: g.enrollments.length })}
                        </Badge>
                        <Link href={`/groups/${g.id}`} className="text-primary text-xs hover:underline">
                          {t("openGroup")} →
                        </Link>
                      </summary>
                      <div className="bg-muted/30 flex flex-col gap-2 rounded-b-xl border-t px-4 py-3 text-sm">
                        <p className="text-muted-foreground text-xs">
                          {g.durationMinutes} {t("minutesShort")} · {g.room ? `${g.room.name} (${g.room.capacity})` : "—"} · {formatMoney(g.price)}
                        </p>
                        {g.enrollments.length === 0 ? (
                          <p className="text-muted-foreground">{t("noStudents")}</p>
                        ) : (
                          <ul className="flex flex-wrap gap-2">
                            {g.enrollments.map((e) => (
                              <li key={e.student.id}>
                                <Link href={`/students/${e.student.id}`} className="bg-background hover:bg-muted rounded-full border px-2.5 py-1 text-xs">
                                  {e.student.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
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
