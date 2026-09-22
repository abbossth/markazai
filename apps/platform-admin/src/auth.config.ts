import type { NextAuthConfig } from "next-auth";

// Control Plane sessiyasi tenant-app'niki bilan ARALASHMAYDI: boshqa sir (PLATFORM_AUTH_SECRET), boshqa cookie nomlari,
// boshqa jadval (PlatformAdmin). Bitta token ikkalasida ham ishlamaydi (0.6).
const prefix = "markazai-platform";

export const authConfig = {
  secret: process.env.PLATFORM_AUTH_SECRET,
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  cookies: {
    sessionToken: { name: `${prefix}.session-token`, options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" } },
    callbackUrl: { name: `${prefix}.callback-url`, options: { sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" } },
    csrfToken: { name: `${prefix}.csrf-token`, options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" } },
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const loggedIn = !!auth?.user;
      if (nextUrl.pathname === "/login") return loggedIn ? Response.redirect(new URL("/", nextUrl)) : true;
      return loggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = (token.role ?? "SUPPORT") as "OWNER" | "BILLING" | "SUPPORT";
      return session;
    },
  },
} satisfies NextAuthConfig;
