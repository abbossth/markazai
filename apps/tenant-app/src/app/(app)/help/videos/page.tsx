import type { Metadata } from "next";
import { platformPrisma } from "@markazai/db/platform";
import { youtubeId } from "@markazai/types";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Video darsliklar" };

/** Platforma egasi Control Plane'da kiritgan video darsliklar (YouTube), kategoriya bo'yicha guruhlangan. */
export default async function HelpVideosPage() {
  await requireUser();
  const videos = await platformPrisma.helpVideo.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] });
  const byCategory = new Map<string, typeof videos>();
  for (const v of videos) byCategory.set(v.category, [...(byCategory.get(v.category) ?? []), v]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Video darsliklar</h1>
      {byCategory.size === 0 && <p className="text-muted-foreground text-sm">Hozircha video darsliklar qo&apos;shilmagan.</p>}
      {[...byCategory].map(([category, items]) => (
        <section key={category} className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">{category}</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((v) => {
              const id = youtubeId(v.url);
              return (
                <article key={v.id} className="bg-card flex flex-col gap-2 overflow-hidden rounded-lg border p-3">
                  {id ? (
                    <iframe
                      className="aspect-video w-full rounded-md"
                      src={`https://www.youtube-nocookie.com/embed/${id}`}
                      title={v.title}
                      loading="lazy"
                      allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
                      allowFullScreen
                    />
                  ) : (
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-brand-500 text-sm underline">
                      Videoni ochish
                    </a>
                  )}
                  <h3 className="text-sm font-medium">{v.title}</h3>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
