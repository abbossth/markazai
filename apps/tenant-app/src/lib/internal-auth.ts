import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Control Plane → tenant-app ichki so'rovlari imzosi (HMAC-SHA256): `x-timestamp` (ms) va
 * `x-signature = hex(HMAC(secret, timestamp + "." + body))`. Vaqt 5 daqiqadan eski bo'lsa rad etiladi (replay).
 * Sir — `PROVISIONING_SECRET`, ikkala ilovada bir xil. Tenant bazasiga platform-admin to'g'ridan ulanmaydi, faqat shu API orqali.
 */
const MAX_SKEW_MS = 5 * 60_000;

export function signInternal(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifyInternal(request: Request, body: string, now = Date.now()): boolean {
  const secret = process.env.PROVISIONING_SECRET;
  if (!secret || secret.length < 16) return false;
  const timestamp = request.headers.get("x-timestamp") ?? "";
  const signature = request.headers.get("x-signature") ?? "";
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_SKEW_MS) return false;
  const expected = Buffer.from(signInternal(secret, timestamp, body), "hex");
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
