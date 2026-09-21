"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initial?: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<{ ok: boolean; error?: string }>;
};

/** Ustun/ro'yxat nomini so'raydigan oddiy dialog. */
export function NameDialog({ open, onOpenChange, title, initial = "", submitLabel, onSubmit }: Props) {
  const tc = useTranslations("common");
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const res = await onSubmit(name.trim());
      if (res.ok) {
        toast.success(tc("saved"));
        onOpenChange(false);
        router.refresh();
      } else toast.error(res.error === "forbidden" ? tc("forbidden") : res.error === "locked" ? tc("locked") : tc("error"));
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) submit();
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
