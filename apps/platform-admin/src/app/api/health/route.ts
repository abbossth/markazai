import { platformPrisma } from "@markazai/db/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sog'liq tekshiruvi: faqat Control Plane bazasi (bu ilova tenant bazasiga ulanmaydi). */
export async function GET() {
  let ok = false;
  try {
    await platformPrisma.$queryRaw`SELECT 1`;
    ok = true;
  } catch {}
  return Response.json({ ok, checks: { platformDb: ok } }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
