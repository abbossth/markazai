"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadSheet } from "./lead-form";
import type { BoardLookups } from "./queries";

export function NewLeadButton({ lookups }: { lookups: BoardLookups }) {
  const t = useTranslations("lead");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t("newLead")}
      </Button>
      <LeadSheet open={open} onOpenChange={setOpen} lookups={lookups} />
    </>
  );
}
