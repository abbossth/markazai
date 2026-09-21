import type { NextAuthConfig } from "next-auth";

// Edge/proxy-xavfsiz qism: bu yerda Prisma yoki bcrypt import qilinmaydi.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      if (nextUrl.pathname === "/login") {
        return isLoggedIn ? Response.redirect(new URL("/dashboard", nextUrl)) : true;
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
