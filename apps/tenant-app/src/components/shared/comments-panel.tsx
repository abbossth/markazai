"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addComment, deleteComment } from "@/app/(app)/comments/actions";
import { formatDateTime } from "@/lib/format";

export type CommentItem = { id: string; authorId: string; authorName: string; body: string; createdAt: string };

type Props = {
  target: { studentId: string } | { groupId: string };
  comments: CommentItem[];
  currentUserId: string;
  canDeleteAny: boolean;
};

export function CommentsPanel({ target, comments, currentUserId, canDeleteAny }: Props) {
  const t = useTranslations("comments");
  const tc = useTranslations("common");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!body.trim()) return;
    startTransition(async () => {
      const res = await addComment(target, body);
      if (res.ok) {
        setBody("");
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });
  };

  const remove = (id: string) =>
    startTransition(async () => {
      const res = await deleteComment(id);
      if (res.ok) router.refresh();
      else toast.error(res.error === "forbidden" ? tc("forbidden") : tc("error"));
    });

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("placeholder")} maxLength={2000} />
        <Button className="w-fit" disabled={pending || !body.trim()} onClick={submit}>
          {t("add")}
        </Button>
      </div>

      {comments.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="bg-card rounded-lg border p-3">
              <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
                <span>
                  {c.authorName} · {formatDateTime(c.createdAt)}
                </span>
                {(canDeleteAny || c.authorId === currentUserId) && (
                  <Button variant="ghost" size="icon-xs" aria-label={tc("delete")} disabled={pending} onClick={() => remove(c.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
