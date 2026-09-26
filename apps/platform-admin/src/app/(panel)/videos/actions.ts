"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { platformPrisma } from "@markazai/db/platform";
import { youtubeId } from "@markazai/types";
import type { FormState } from "@/components/action-form";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/session";

const videoSchema = z.object({
  category: z.string().trim().min(2, "Kategoriya kamida 2 belgi").max(60),
  title: z.string().trim().min(2, "Nomi kamida 2 belgi").max(120),
  url: z.string().trim().refine((v) => youtubeId(v) !== null, "YouTube havolasi noto'g'ri"),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
});

/** Video darslik yaratish/yangilash (id berilsa yangilanadi). Faqat YouTube havolalari qabul qilinadi. */
export async function saveVideo(id: string | null, _prev: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin(["SUPPORT"]);
  const parsed = videoSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };
  const v = id ? await platformPrisma.helpVideo.update({ where: { id }, data: parsed.data }) : await platformPrisma.helpVideo.create({ data: parsed.data });
  await audit(admin, id ? "video.updated" : "video.created", "video", v.id, { title: v.title });
  revalidatePath("/videos");
  return { ok: true, message: "Saqlandi" };
}

export async function deleteVideo(id: string, _prev: FormState): Promise<FormState> {
  const admin = await requireAdmin(["SUPPORT"]);
  await platformPrisma.helpVideo.delete({ where: { id } }).catch(() => null);
  await audit(admin, "video.deleted", "video", id, {});
  revalidatePath("/videos");
  return { ok: true, message: "O'chirildi" };
}
