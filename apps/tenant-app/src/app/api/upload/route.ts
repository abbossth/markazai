import { auth } from "@/auth";
import { can } from "@/lib/permissions";
import { MAX_IMAGE_BYTES, saveImage } from "@/lib/storage";

export const runtime = "nodejs";

/** Rasm yuklash (logotip, login banneri): faqat Sozlamalarni boshqara oladiganlar; PNG/JPG/WEBP/GIF, ≤ 2 MB. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!can(session.user.roles, "settings:manage")) return Response.json({ error: "forbidden" }, { status: 403 });

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_IMAGE_BYTES + 64 * 1024) return Response.json({ error: "tooLarge" }, { status: 413 });

  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return Response.json({ error: "invalidType" }, { status: 400 });

  const res = await saveImage(session.user.organizationId, new Uint8Array(await file.arrayBuffer()));
  if ("error" in res) return Response.json(res, { status: res.error === "tooLarge" ? 413 : 400 });
  return Response.json(res);
}
