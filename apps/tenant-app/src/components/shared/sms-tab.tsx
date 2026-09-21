"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { sendSms, type CommsTarget } from "@/app/(app)/comms/actions";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";

export type SmsItem = { id: string; text: string; status: "SENT" | "FAILED" | "MOCK"; senderName: string; createdAt: string; fromLead?: boolean };

const MAX = 500;

export function SmsTab({ target, items, canWrite }: { target: CommsTarget; items: SmsItem[]; canWrite: boolean }) {
  const t = useTranslations("sms");
  const te = useTranslations("enums.smsStatus");
  const tc = useTranslations("common");
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  const send = () =>
    startTransition(async () => {
      const res = await sendSms(target, text);
      if (res.ok) {
        setText("");
        toast.success(t("queued"));
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : res.error === "smsFailed" ? t("failed") : tc("error"));
    });

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {canWrite && (
        <div className="flex flex-col gap-2">
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX} placeholder={t("placeholder")} />
          <div className="flex items-center gap-3">
            <Button size="sm" disabled={pending || !text.trim()} onClick={send}>
              <Send className="size-4" />
              {t("send")}
            </Button>
            <span className="text-muted-foreground text-xs">
              {text.length}/{MAX}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">{t("mockNotice")}</p>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="bg-card divide-y rounded-lg border">
          {items.map((s) => (
            <li key={s.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
              <p className="whitespace-pre-wrap">{s.text}</p>
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                <Badge variant={s.status === "FAILED" ? "destructive" : "outline"}>{te(s.status)}</Badge>
                {s.fromLead && <Badge variant="outline">{t("fromLead")}</Badge>}
                <span>
                  {s.senderName} · {formatDateTime(s.createdAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
