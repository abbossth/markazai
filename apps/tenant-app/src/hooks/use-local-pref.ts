"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

/**
 * Brauzerda (localStorage) saqlanadigan mantiqiy tanlov (masalan "coinlarni ko'rsatish").
 * useSyncExternalStore: serverda va birinchi renderda `fallback` — hydration mos keladi, keyin saqlangan qiymatga o'tadi.
 */
export function useLocalPref(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    window.addEventListener("storage", cb);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", cb);
    };
  }, []);
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : v === "1";
      } catch {
        return fallback;
      }
    },
    () => fallback,
  );
  const set = useCallback(
    (v: boolean) => {
      try {
        localStorage.setItem(key, v ? "1" : "0");
      } catch {}
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [value, set];
}
