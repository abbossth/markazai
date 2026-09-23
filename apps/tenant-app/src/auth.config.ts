import type { NextAuthConfig } from "next-auth";

// Edge/proxy-xavfsiz qism: bu yerda Prisma yoki bcrypt import qilinmaydi.
export const authConfig = {
  // Wildcard subdomenlar ({slug}.markazai.uz): host ro'yxati oldindan noma'lum, shuning uchun host'ga ishoniladi. Xavfsiz, chunki
  // proxy.ts noma'lum/noto'g'ri hostni 404 bilan rad etadi va lib/tenant.ts host'ni Control Plane bazasidagi tashkilotga bog'laydi.
  trustHost: true,
  pages: { signIn: "/login" },
  // JWT sessiyada alohida "refresh token" tushunchasi yo'q (bu — OAuth provayderlariga xos naqsh; Credentials
  // provayderida sessiya = imzolangan JWT o'zi). Shuning o'rniga "rolling session": `maxAge` — faollik bo'lmasa
  // sessiya nechchi vaqtdan keyin tugaydi (2 kun); `updateAge` — foydalanuvchi faol bo'lganda JWT qancha tez-tez
  // qayta imzolanadi (muddati yangilanadi). Amalda: har soatda kamida bitta so'rov yuborilsa, sessiya cheksiz
  // davom etadi; 2 kun batamom faolsiz qolsagina chiqib ketadi.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 2, updateAge: 60 * 60 },
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
