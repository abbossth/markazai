import { platformPrisma } from "@markazai/db/platform";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader } from "@/components/ui";
import { can, requireAdmin } from "@/lib/session";
import { deleteVideo, saveVideo } from "./actions";

type Video = { id: string; category: string; title: string; url: string; sortOrder: number };

function VideoForm({ video }: { video?: Video }) {
  return (
    <ActionForm action={saveVideo.bind(null, video?.id ?? null)} submit={video ? "Saqlash" : "Video qo'shish"} variant={video ? "outline" : "default"} className="gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Kategoriya">
          <Input name="category" defaultValue={video?.category} required />
        </Field>
        <Field label="Nomi">
          <Input name="title" defaultValue={video?.title} required />
        </Field>
        <Field label="YouTube havolasi">
          <Input name="url" type="url" defaultValue={video?.url} placeholder="https://youtu.be/..." required />
        </Field>
        <Field label="Tartib" hint="Kichigi birinchi">
          <Input name="sortOrder" type="number" min={0} defaultValue={video?.sortOrder ?? 0} />
        </Field>
      </div>
    </ActionForm>
  );
}

export default async function VideosPage() {
  const admin = await requireAdmin();
  const editable = can(admin, ["SUPPORT"]);
  const videos = await platformPrisma.helpVideo.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] });
  return (
    <>
      <PageHeader title="Video darsliklar" sub="Videoni YouTube'ga yuklab, havolasini shu yerga qo'ying — barcha o'quv markazlarda «Video darsliklar» sahifasida kategoriya bo'yicha ko'rinadi." />
      {editable && (
        <Card title="Yangi video">
          <VideoForm />
        </Card>
      )}
      {videos.map((v) => (
        <Card key={v.id} title={`${v.category} · ${v.title}`}>
          {editable ? (
            <div className="flex flex-col gap-3">
              <VideoForm video={v} />
              <ActionForm action={deleteVideo.bind(null, v.id)} submit="O'chirish" variant="destructive" confirm="Video o'chirilsinmi?" />
            </div>
          ) : (
            <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-sm underline">
              {v.url}
            </a>
          )}
        </Card>
      ))}
    </>
  );
}
