import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Fayl saqlash (mahalliy disk). Ishlab chiqarishda S3/R2 bilan almashtiriladi — shu modulning ikki funksiyasi
 * (`saveImage`, `readStored`) yagona interfeys. Fayllar `/api/files/<org>/<nom>` orqali beriladi.
 */
const ROOT = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.resolve(process.cwd(), ".uploads");

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const TYPES = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif" } as const;
export type ImageExt = keyof typeof TYPES;

/** Mazmunni (magic bytes) tekshirib turini aniqlaydi — brauzer bergan Content-Type/kengaytmaga ishonilmaydi. SVG ataylab yo'q (skript tashishi mumkin). */
export function sniffImage(buf: Uint8Array): ImageExt | null {
  const at = (i: number) => buf[i] ?? -1;
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return "png";
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "jpg";
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x38) return "gif";
  if (at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 && at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) return "webp";
  return null;
}

export async function saveImage(orgId: string, data: Uint8Array): Promise<{ url: string } | { error: "tooLarge" | "invalidType" }> {
  if (data.byteLength > MAX_IMAGE_BYTES) return { error: "tooLarge" };
  const ext = sniffImage(data);
  if (!ext) return { error: "invalidType" };
  const name = `${randomUUID()}.${ext}`;
  await mkdir(path.join(ROOT, orgId), { recursive: true });
  await writeFile(path.join(ROOT, orgId, name), data);
  return { url: `/api/files/${orgId}/${name}` };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FILE = /^[0-9a-f-]{36}\.(png|jpg|webp|gif)$/;

/** Yo'l tekshiruvi qat'iy (UUID/fayl nomi regex) — `..` va boshqa yo'llar o'tmaydi. */
export async function readStored(org: string, name: string): Promise<{ data: Buffer; contentType: string } | null> {
  const m = FILE.exec(name);
  if (!UUID.test(org) || !m) return null;
  try {
    return { data: await readFile(path.join(ROOT, org, name)), contentType: TYPES[m[1] as ImageExt] };
  } catch {
    return null;
  }
}
