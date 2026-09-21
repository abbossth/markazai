import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Integratsiya sirlarini (API kalitlari, tokenlar) bazada shifrlangan saqlash: AES-256-GCM.
 * Kalit — `SECRETS_KEY` (bo'lmasa AUTH_SECRET) dan SHA-256 orqali olinadi. Format: `enc:v1:<iv>:<tag>:<data>` (base64url).
 * GCM autentifikatsiya tegi bor, shuning uchun buzilgan/almashtirilgan qiymat `decryptSecret`da xatolik beradi.
 */
const PREFIX = "enc:v1:";

function key(): Buffer {
  const secret = process.env.SECRETS_KEY || process.env.AUTH_SECRET;
  if (!secret) throw new Error("SECRETS_KEY yoki AUTH_SECRET o'rnatilmagan");
  return createHash("sha256").update(secret).digest();
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${data.toString("base64url")}`;
}

/** Shifrlangan qiymatni ochadi; shifrlanmagan (eski/qo'lda kiritilgan) qiymat o'zgarishsiz qaytariladi. */
export function decryptSecret(value: string): string {
  if (!isEncrypted(value)) return value;
  const [iv, tag, data] = value.slice(PREFIX.length).split(":");
  if (!iv || !tag || !data) throw new Error("Shifrlangan qiymat formati noto'g'ri");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
