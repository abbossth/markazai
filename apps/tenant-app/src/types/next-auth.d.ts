import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    phone: string;
    roles: string[];
    organizationId: string;
  }
  interface Session {
    user: {
      id: string;
      phone: string;
      roles: string[];
      organizationId: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    phone?: string;
    roles?: string[];
    organizationId?: string;
  }
}
