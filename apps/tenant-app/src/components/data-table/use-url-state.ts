"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** URL query parametrlarini o'qish/yozish. Filtr o'zgarganda sahifa 1-ga qaytadi. */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (changes: Record<string, string | undefined>, opts: { keepPage?: boolean } = {}) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v === undefined || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (!opts.keepPage) next.delete("page");
      const qs = next.toString();
      startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
    },
    [pathname, router, searchParams],
  );

  const reset = useCallback(
    (keys: string[]) => {
      const next = new URLSearchParams(searchParams.toString());
      keys.forEach((k) => next.delete(k));
      next.delete("page");
      const qs = next.toString();
      startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
    },
    [pathname, router, searchParams],
  );

  return { searchParams, update, reset, pending };
}
