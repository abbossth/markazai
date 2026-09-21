export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Massiv bo'lsa birinchi qiymat; bo'sh satr → undefined. */
export function param(sp: RawSearchParams, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() !== "" ? s.trim() : undefined;
}

export function intParam(sp: RawSearchParams, key: string, fallback: number, min = 1, max = 1000) {
  const n = Number.parseInt(param(sp, key) ?? "", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
}

/** "name:asc" → { key: "name", dir: "asc" } (faqat ruxsat etilgan kalitlar) */
export function sortParam<K extends string>(sp: RawSearchParams, allowed: readonly K[], fallback: { key: K; dir: "asc" | "desc" }) {
  const raw = param(sp, "sort");
  if (!raw) return fallback;
  const [key, dir] = raw.split(":");
  if (!allowed.includes(key as K)) return fallback;
  return { key: key as K, dir: dir === "desc" ? ("desc" as const) : ("asc" as const) };
}

/** YYYY-MM-DD → UTC Date (noto'g'ri bo'lsa undefined) */
export function dateParam(sp: RawSearchParams, key: string): Date | undefined {
  const v = param(sp, key);
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
