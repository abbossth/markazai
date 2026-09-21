"use client";

import { useTranslations } from "next-intl";
import { weekdaysOf, type DaysPattern } from "@markazai/types";

/** "Toq kunlar", yoki OTHER uchun "Du, Chor, Ju". */
export function useDaysLabel() {
  const t = useTranslations("enums");
  return (pattern: DaysPattern, customDays: number[] = []) =>
    pattern === "OTHER"
      ? weekdaysOf(pattern, customDays)
          .map((d) => t(`weekdaysShort.${d}` as "weekdaysShort.1"))
          .join(", ")
      : t(`days.${pattern}` as "days.ODD");
}
