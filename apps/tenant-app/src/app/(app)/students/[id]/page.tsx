import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AlertTriangle } from "lucide-react";
import { z } from "zod";
import { summarizeByGroupMonth, toISODate } from "@markazai/types";
import { CommentsPanel } from "@/components/shared/comments-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { HistoryList } from "@/components/shared/history-list";
import { Money } from "@/components/shared/money";
import { PrintButton } from "@/components/shared/print-button";
import { StudentStatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatPhone, initials } from "@/lib/format";
import { can } from "@/lib/permissions";
import { param } from "@/lib/search-params";
import { requireModule } from "@/lib/session";
import { cn } from "@/lib/utils";
import { loadStudentLookups } from "../queries";
import { AttendanceTab } from "./attendance-tab";
import { StudentHeaderActions } from "./header-actions";
import { loadStudentProfile } from "./queries";

const TABS = ["groups", "comments", "attendance", "calls", "sms", "history", "leads"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata({ params }: PageProps<"/students/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("nav");
  return { title: `${t("students")} · ${id.slice(0, 8)}` };
}

const MONTH_TONE = {
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  partial: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  debt: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  none: "bg-muted text-muted-foreground",
} as const;

export default async function StudentProfilePage({ params, searchParams }: PageProps<"/students/[id]">) {
  const user = await requireModule("students");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [profile, lookups, t, tt, te, tp, tm] = await Promise.all([
    loadStudentProfile(user, id),
    loadStudentLookups(user),
    getTranslations("student"),
    getTranslations("student.tabs"),
    getTranslations("enums"),
    getTranslations("student.payments"),
    getTranslations("enums.months"),
  ]);
  if (!profile) notFound();

  const { student, payments, comments, attendance, history, grades, userNames } = profile;
  const sp = await searchParams;
  const requestedTab = param(sp, "tab");
  const tab: Tab = (TABS as readonly string[]).includes(requestedTab ?? "") ? (requestedTab as Tab) : "groups";

  const canWrite = can(user.roles, "students:write");
  const today = toISODate(new Date());
  const activeEnrollments = student.enrollments.filter((e) => !e.leftAt);
  const rating = grades._avg.score;

  // Oxirgi 3 oy (joriy oy bilan) — oylik balans kartochkalari uchun.
  const months = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - i, 1));
    return d.toISOString().slice(0, 7);
  });
  const summary = summarizeByGroupMonth(payments.map((p) => ({ amount: p.amount, type: p.type, date: p.date, groupId: p.groupId })));
  const monthLabel = (m: string) => `${tm(String(Number(m.slice(5, 7))) as "1")} ${m.slice(0, 4)}`;

  const attendanceGroups = student.enrollments.map((e) => ({
    id: e.group.id,
    name: e.group.name,
    days: e.group.days,
    customDays: e.group.customDays,
    startDate: toISODate(e.joinedAt > e.group.startDate ? e.joinedAt : e.group.startDate),
    endDate: e.leftAt ? toISODate(e.leftAt) : e.group.endDate ? toISODate(e.group.endDate) : null,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="text-muted-foreground text-sm print:hidden">
        <Link href="/students" className="hover:underline">
          {t("title")}
        </Link>{" "}
        / {student.name}
      </div>

      {activeEnrollments.length === 0 && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300 print:hidden">
          <AlertTriangle className="size-4 shrink-0" />
          {t("noActiveGroupWarning")}
        </div>
      )}

      <header className="bg-card flex flex-wrap items-start gap-4 rounded-lg border p-4">
        <Avatar className="size-16">
          {student.photoUrl && <AvatarImage src={student.photoUrl} alt="" />}
          <AvatarFallback className="text-lg">{initials(student.name)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{student.name}</h1>
            <StudentStatusBadge status={student.status} />
            {student.balance < 0 && <Badge variant="destructive">{t("debtor")}</Badge>}
          </div>
          <p className="text-muted-foreground text-sm">
            ID: {student.externalId ?? student.id.slice(0, 8)} · {formatPhone(student.phone)}
            {student.extraPhones.map((p) => ` · ${formatPhone(p)}`)}
          </p>
          {student.status === "FROZEN" && student.freezeReason && (
            <p className="text-sm">
              {t("freezeReason")}: {student.freezeReason}
            </p>
          )}
          {student.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {student.tags.map((x) => (
                <Badge key={x.tagId} variant="secondary">
                  {x.tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <div className="text-muted-foreground text-xs">{t("balance")}</div>
            <Money value={student.balance} className="text-2xl" />
          </div>
          <div>
            <div className="text-muted-foreground text-xs">{t("rating")}</div>
            <div className="text-2xl font-medium tabular-nums">{rating === null ? "—" : rating.toFixed(1)}</div>
          </div>
        </div>
        <div className="w-full print:hidden">
          <StudentHeaderActions
            student={{
              id: student.id,
              name: student.name,
              phone: student.phone,
              extraPhones: student.extraPhones,
              birthDate: student.birthDate ? toISODate(student.birthDate) : null,
              gender: student.gender,
              note: student.note,
              contactPerson: student.contactPerson,
              email: student.email,
              telegram: student.telegram,
              socialLink: student.socialLink,
              address: student.address,
              externalId: student.externalId,
              tagIds: student.tags.map((x) => x.tagId),
            }}
            status={student.status}
            lookups={lookups}
            canWrite={canWrite}
            canDelete={can(user.roles, "students:delete")}
          />
        </div>
      </header>

      <Tabs defaultValue={tab}>
        <TabsList className="print:hidden">
          {TABS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {tt(k)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="groups" className="flex flex-col gap-6 pt-4">
          {student.enrollments.length === 0 ? (
            <EmptyState title={t("noGroups")} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {student.enrollments.map((e) => (
                <div key={e.id} className={cn("bg-card rounded-lg border p-4", e.leftAt && "opacity-70")}>
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/groups/${e.group.id}`} className="font-semibold hover:underline">
                      {e.group.name}
                    </Link>
                    {e.leftAt ? <Badge variant="outline">{t("leftOn", { date: formatDate(e.leftAt) })}</Badge> : <Badge variant="secondary">{te("groupStatus.ACTIVE")}</Badge>}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {e.group.course.name} · {e.group.teacher.name}
                  </p>
                  <p className="text-muted-foreground mb-3 text-xs">
                    {e.group.startTime} · {formatDate(e.joinedAt)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {months.map((m) => {
                      const row = summary.find((r) => r.groupId === e.group.id && r.month === m);
                      const status = row?.status ?? "none";
                      return (
                        <span key={m} className={cn("rounded-md px-2 py-1 text-xs", MONTH_TONE[status])} title={row ? `${tp(`month.${status}`)}` : undefined}>
                          {monthLabel(m)} · {tp(`month.${status}`)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">{tp("title")}</h2>
              <PrintButton />
            </div>
            {payments.length === 0 ? (
              <EmptyState title={tp("empty")} />
            ) : (
              <div className="bg-card rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tp("date")}</TableHead>
                      <TableHead>{tp("group")}</TableHead>
                      <TableHead>{tp("type")}</TableHead>
                      <TableHead className="text-right">{tp("amount")}</TableHead>
                      <TableHead>{tp("description")}</TableHead>
                      <TableHead>{tp("receivedBy")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.date)}</TableCell>
                        <TableCell>{p.group?.name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={p.type === "SYSTEM" ? "outline" : "secondary"}>{te(`paymentType.${p.type}`)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={p.amount} />
                        </TableCell>
                        <TableCell>{p.description ?? "—"}</TableCell>
                        <TableCell>{p.receivedById ? (userNames.get(p.receivedById) ?? "—") : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="comments" className="pt-4">
          <CommentsPanel
            target={{ studentId: student.id }}
            currentUserId={user.id}
            canDeleteAny={user.roles.includes("CEO")}
            comments={comments.map((c) => ({ id: c.id, authorId: c.authorId, authorName: userNames.get(c.authorId) ?? "—", body: c.body, createdAt: c.createdAt.toISOString() }))}
          />
        </TabsContent>

        <TabsContent value="attendance" className="pt-4">
          <AttendanceTab
            groups={attendanceGroups}
            today={today}
            records={attendance.map((a) => ({ groupId: a.groupId, date: toISODate(a.date), status: a.status }))}
          />
        </TabsContent>

        <TabsContent value="calls" className="pt-4">
          <EmptyState title={t("callsEmpty")} hint={t("integrationHint")} />
        </TabsContent>
        <TabsContent value="sms" className="pt-4">
          <EmptyState title={t("smsEmpty")} hint={t("integrationHint")} />
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

        <TabsContent value="leads" className="pt-4">
          <EmptyState title={t("leadsEmpty")} hint={t("leadsHint")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
