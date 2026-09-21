"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate, formatPhone } from "@/lib/format";
import { Money } from "./money";
import { StudentStatusBadge } from "./status-badge";

export type QuickCardStudent = {
  id: string;
  name: string;
  phone: string;
  status: string;
  /** null — moliyaviy ma'lumot yashirin (ruxsat yo'q). */
  balance: number | null;
  freezeReason?: string | null;
  createdAt: string;
};

/** Ism ustiga hover qilinganda chiqadigan tezkor ma'lumot kartasi. Ismning o'zi profilga havola. */
export function StudentQuickCard({ student }: { student: QuickCardStudent }) {
  const t = useTranslations("student");

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        nativeButton={false}
        delay={250}
        closeDelay={100}
        render={<Link href={`/students/${student.id}`} className="font-medium hover:underline" />}
      >
        {student.name}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold">{student.name}</span>
          <StudentStatusBadge status={student.status} />
        </div>
        {student.balance !== null && student.balance < 0 && <Badge variant="destructive">{t("debtor")}</Badge>}
        {student.status === "FROZEN" && student.freezeReason && (
          <p className="text-muted-foreground text-xs">
            {t("freezeReason")}: {student.freezeReason}
          </p>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">{t("phone")}</dt>
          <dd>{formatPhone(student.phone)}</dd>
          {student.balance !== null && (
            <>
              <dt className="text-muted-foreground">{t("balance")}</dt>
              <dd>
                <Money value={student.balance} />
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">{t("addedOn")}</dt>
          <dd>{formatDate(student.createdAt)}</dd>
        </dl>
        <Link href={`/students/${student.id}`} className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline">
          {t("goToProfile")} <ArrowRight className="size-3" />
        </Link>
      </PopoverContent>
    </Popover>
  );
}
