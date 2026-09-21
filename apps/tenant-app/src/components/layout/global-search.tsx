"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type SearchResult = { type: string; id: string; title: string; subtitle?: string; href: string };

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export function GlobalSearch() {
  const t = useTranslations("search");
  const tc = useTranslations("common");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const q = useDebounced(query.trim(), 250);

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", q],
    enabled: q.length >= 2,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal });
      if (!res.ok) throw new Error("search failed");
      return (await res.json()) as { results: SearchResult[] };
    },
  });

  // Tashqariga bosilsa yoki Esc bosilsa yopiladi.
  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  const results = data?.results ?? [];
  const showPanel = open && q.length >= 2;

  return (
    <div ref={rootRef} className="relative w-full max-w-md">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        type="search"
        value={query}
        placeholder={t("placeholder")}
        aria-label={tc("search")}
        className="pl-8"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />

      {showPanel && (
        <div className="bg-popover text-popover-foreground absolute top-full z-50 mt-1 w-full overflow-hidden rounded-lg border shadow-md">
          {isFetching && results.length === 0 ? (
            <p className="text-muted-foreground px-3 py-2 text-sm">{tc("loading")}</p>
          ) : results.length === 0 ? (
            <p className="text-muted-foreground px-3 py-2 text-sm">{tc("noResults")}</p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={`${r.type}:${r.id}`}>
                  <Link
                    href={r.href}
                    onClick={() => setOpen(false)}
                    className="hover:bg-accent flex flex-col px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{r.title}</span>
                    {r.subtitle && <span className="text-muted-foreground text-xs">{r.subtitle}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
