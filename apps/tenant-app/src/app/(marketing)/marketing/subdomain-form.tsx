"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

/** "Markazingizga kirish": slug kiritilsa `{slug}.{root}`ga o'tkazadi. Sof HTML navigatsiya — server holatini talab qilmaydi. */
export function SubdomainForm({ root }: { root: string }) {
  const [slug, setSlug] = useState("");
  const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");

  return (
    <form
      className="flex w-full max-w-sm items-center rounded-full border border-slate-200 bg-white p-1 pl-4 shadow-sm dark:border-white/10 dark:bg-white/5"
      onSubmit={(e) => {
        e.preventDefault();
        if (clean) window.location.href = `https://${clean}.${root}`;
      }}
    >
      <span className="text-sm text-slate-400 select-none">https://</span>
      <input
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder="markaz-nomi"
        aria-label="Markaz manzili"
        className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
      />
      <span className="hidden text-sm text-slate-400 select-none sm:inline">.{root}</span>
      <button
        type="submit"
        aria-label="Kirish"
        className="ml-2 flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition-transform hover:scale-105 dark:bg-white dark:text-slate-900"
      >
        <ArrowRight className="size-4" />
      </button>
    </form>
  );
}
