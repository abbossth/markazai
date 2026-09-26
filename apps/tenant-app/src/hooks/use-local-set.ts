"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

/**
 * Brauzerda (localStorage) saqlanadigan ID'lar to'plami (masalan "ochiq ro'yxatlar"). Sukut — bo'sh to'plam.
 * useSyncExternalStore: serverda va birinchi renderda bo'sh to'plam (hydration mos), keyin saqlangan qiymat.
 */
export function useLocalSet(key: string): [ReadonlySet<string>, (id: string) => void] {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    window.addEventListener("storage", cb);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", cb);
    };
  }, []);
  // Snapshot — xom satr (primitiv), shuning uchun barqaror; to'plam undan `useMemo` bilan quriladi.
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]",
  );
  const set = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
    } catch {
      return new Set<string>();
    }
  }, [raw]);

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      try {
        localStorage.setItem(key, JSON.stringify([...next]));
      } catch {}
      listeners.forEach((l) => l());
    },
    [key, set],
  );
  return [set, toggle];
}
