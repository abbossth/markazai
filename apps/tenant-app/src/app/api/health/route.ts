import { prisma } from "@markazai/db";
import { platformPrisma } from "@markazai/db/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sog'liq tekshiruvi (deploy/monitoring): Control Plane bazasi, tenant bazasi va — eng muhimi — ilova RLS'ga bo'ysunadigan
 * cheklangan rol bilan ulanganini tekshiradi (superuser/BYPASSRLS bo'lsa izolyatsiya jimgina o'chgan bo'lardi → ok=false).
 * Faqat mantiqiy qiymatlar qaytariladi; ma'lumot yoki sirlar yo'q.
 */
export async function GET() {
  const checks = { platformDb: false, tenantDb: false, rls: false };
  try {
    await platformPrisma.$queryRaw`SELECT 1`;
    checks.platformDb = true;
  } catch {}
  try {
    const rows = await prisma.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`SELECT r.rolsuper, r.rolbypassrls FROM pg_roles r WHERE r.rolname = current_user`;
    checks.tenantDb = true;
    checks.rls = !!rows[0] && !rows[0].rolsuper && !rows[0].rolbypassrls;
  } catch {}
  const ok = checks.platformDb && checks.tenantDb && checks.rls;
  return Response.json({ ok, checks }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
