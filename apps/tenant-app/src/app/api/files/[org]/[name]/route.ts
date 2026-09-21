import { readStored } from "@/lib/storage";

export const runtime = "nodejs";

/** Yuklangan rasmlar (brend: logotip/banner — login sahifasida ham kerak, shuning uchun ochiq; nom — taxmin qilib bo'lmaydigan UUID). */
export async function GET(_req: Request, { params }: { params: Promise<{ org: string; name: string }> }) {
  const { org, name } = await params;
  const file = await readStored(org, name);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "Content-Type": file.contentType, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" },
  });
}
