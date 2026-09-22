import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { platformPrisma } from "@markazai/db/platform";
import { authConfig } from "./auth.config";

const DUMMY_HASH = bcrypt.hashSync("markazai-platform-dummy", 10);
const credentialsSchema = z.object({ email: z.email().transform((v) => v.toLowerCase()), password: z.string().min(1) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const admin = await platformPrisma.platformAdmin.findUnique({ where: { email: parsed.data.email } });
        // Topilmasa ham haqiqiy hash solishtiriladi (javob vaqti orqali email aniqlanmasligi uchun).
        const ok = await bcrypt.compare(parsed.data.password, admin?.passwordHash ?? DUMMY_HASH);
        if (!admin || !admin.isActive || !ok) return null;
        await platformPrisma.platformAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
        return { id: admin.id, email: admin.email, name: admin.name, role: admin.role };
      },
    }),
  ],
});
