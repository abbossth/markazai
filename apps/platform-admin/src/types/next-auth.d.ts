import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: { id: string; email: string; name: string; role: "OWNER" | "BILLING" | "SUPPORT" };
  }
  interface User {
    role?: "OWNER" | "BILLING" | "SUPPORT";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "OWNER" | "BILLING" | "SUPPORT";
  }
}
