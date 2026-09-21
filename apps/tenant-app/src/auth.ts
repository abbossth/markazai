import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@markazai/db";
import { DEFAULT_ORGANIZATION_ID, loginSchema } from "@markazai/types";
import { authConfig } from "./auth.config";

// Foydalanuvchi topilmaganda ham haqiqiy hash solishtiriladi (javob vaqti orqali telefon aniqlanmasligi uchun).
const DUMMY_HASH = bcrypt.hashSync("markazai-dummy-password", 10);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { phone: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { phone, password } = parsed.data;

        // 9-bosqichda organizationId subdomen orqali aniqlanadi.
        const user = await prisma.user.findUnique({
          where: { organizationId_phone: { organizationId: DEFAULT_ORGANIZATION_ID, phone } },
        });
        const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !user.isActive || !ok) return null;

        return {
          id: user.id,
          name: user.name,
          image: user.photoUrl,
          phone: user.phone,
          roles: user.roles,
          organizationId: user.organizationId,
        };
      },
    }),
  ],
});
