import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Next.js 16: middleware → proxy. Bu birinchi to'siq; har bir layout/route yana auth() tekshiradi.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
