"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
};

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, destructive, pending, onConfirm }: Props) {
  const tc = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button variant={destructive ? "destructive" : "default"} disabled={pending} onClick={onConfirm}>
            {confirmLabel ?? tc("yes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
