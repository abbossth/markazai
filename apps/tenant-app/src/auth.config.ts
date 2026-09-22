import type { NextAuthConfig } from "next-auth";

// Edge/proxy-xavfsiz qism: bu yerda Prisma yoki bcrypt import qilinmaydi.
export const authConfig = {
  // Wildcard subdomenlar ({slug}.markazai.uz): host ro'yxati oldindan noma'lum, shuning uchun host'ga ishoniladi. Xavfsiz, chunki
  // proxy.ts noma'lum/noto'g'ri hostni 404 bilan rad etadi va lib/tenant.ts host'ni Control Plane bazasidagi tashkilotga bog'laydi.
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      // Ommaviy lid formasi (markazning saytiga joylanadi) — kirishsiz ochiq.
      if (nextUrl.pathname === "/apply") return true;
      if (nextUrl.pathname === "/login") {
        // ?expired=1 — sessiya bor, lekin xodim o'chirilgan/bloklangan: login sahifasi ochiq qoladi.
        return isLoggedIn && !nextUrl.searchParams.has("expired") ? Response.redirect(new URL("/dashboard", nextUrl)) : true;
      }
      return isLoggedIn; // false → /login'ga yo'naltiriladi
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.roles = user.roles;
        token.organizationId = user.organizationId;
        token.phone = user.phone;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.roles = token.roles as string[];
      session.user.organizationId = token.organizationId as string;
      session.user.phone = token.phone as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
