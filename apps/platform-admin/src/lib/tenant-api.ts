import { createHmac } from "node:crypto";

/**
 * tenant-app'ning ichki API'si (provisioning, usage). Bu ilova tenant BAZASIGA ulanmaydi — faqat HMAC bilan imzolangan
 * so'rov yuboradi: `x-signature = HMAC(PROVISIONING_SECRET, timestamp + "." + body)`.
 */
export type TenantApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export async function tenantApi<T>(path: string, body: Record<string, unknown>): Promise<TenantApiResult<T>> {
  const secret = process.env.PROVISIONING_SECRET;
  const base = process.env.TENANT_APP_URL;
  if (!secret || !base) return { ok: false, status: 0, error: "PROVISIONING_SECRET / TENANT_APP_URL sozlanmagan" };
  const raw = JSON.stringify(body);
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  try {
    const res = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-timestamp": timestamp, "x-signature": signature }, body: raw, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    return res.ok ? { ok: true, data: json } : { ok: false, status: res.status, error: json.error ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error).message };
  }
}
