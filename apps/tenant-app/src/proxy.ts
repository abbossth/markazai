import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import NextAuth from "next-auth";
import { parseHost } from "@markazai/types";
import { authConfig } from "./auth.config";

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "localhost";
const DEFAULT_SLUG = process.env.NODE_ENV === "production" ? undefined : (process.env.DEFAULT_TENANT_SLUG ?? "demo");

// NextAuth `auth` — bir necha overload'li; proksi imzosiga aniq moslab olamiz.
const authProxy = NextAuth(authConfig).auth as unknown as (request: NextRequest, event: NextFetchEvent) => Promise<Response>;

/**
 * Next.js 16: middleware → proxy. Birinchi to'siq (har bir layout/route yana tekshiradi):
 *  1. Host bo'yicha yo'naltirish (0.2): marketing → /marketing; admin → bu ilovada yo'q; noma'lum host → 404;
 *  2. tenant so'rovlari — autentifikatsiya (auth.config.ts).
 * Tashkilotni bazadan qidirish (slug → orgId) bu yerda EMAS — u Node runtime'dagi server kodida (lib/tenant.ts).
 */
export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const target = parseHost(request.headers.get("x-forwarded-host") ?? request.headers.get("host"), ROOT_DOMAIN, { defaultSlug: DEFAULT_SLUG });
  const { pathname } = request.nextUrl;

  if (target.kind === "marketing") {
    if (pathname === "/" || pathname === "/marketing") return NextResponse.rewrite(new URL("/marketing", request.url));
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (target.kind === "admin") return new NextResponse("Control Plane alohida ilova (platform-admin)", { status: 404 });
  if (target.kind === "unknown") return new NextResponse("Markaz topilmadi", { status: 404 });
  if (pathname === "/marketing") return new NextResponse("Not found", { status: 404 });

  return authProxy(request, event);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
