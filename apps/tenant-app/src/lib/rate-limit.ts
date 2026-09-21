/**
 * Oddiy sliding-window cheklov (jarayon xotirasida). Bitta server nusxasi uchun yetarli; ko'p nusxali
 * ishlab chiqarishda Redis (Upstash) bilan almashtiriladi — funksiya imzosi o'zgarmaydi.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Xotira o'sib ketmasligi uchun vaqti o'tgan kalitlarni ba'zan tozalaymiz.
  if (hits.size > 5_000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  return true;
}
