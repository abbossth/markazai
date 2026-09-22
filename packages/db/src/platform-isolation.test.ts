import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 0.6: platform-admin muhitida tenant DB ulanishi UMUMAN bo'lmasin. Bu test manba kodni va .env'ni tekshiradi.
const ROOT = path.resolve(__dirname, "../../..");
const ADMIN = path.join(ROOT, "apps/platform-admin");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (["node_modules", ".next"].includes(e.name)) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(ts|tsx|mjs|json)$/.test(e.name) ? [p] : [];
  });
}
const sources = () => walk(ADMIN).map((f) => ({ f: path.relative(ROOT, f), text: fs.readFileSync(f, "utf8") }));

describe("platform-admin tenant bazasidan ajratilgan", () => {
  it("tenant klientini (@markazai/db) import qilmaydi — faqat @markazai/db/platform", () => {
    const bad = sources().filter(({ f, text }) => f.endsWith(".ts") || f.endsWith(".tsx") ? /from\s+["']@markazai\/db["']/.test(text) : false);
    expect(bad.map((b) => b.f)).toEqual([]);
  });

  it("kod tenant DB o'zgaruvchilariga (DATABASE_URL, APP_DATABASE_URL) murojaat qilmaydi", () => {
    const bad = sources().filter(({ text }) => /(?<!PLATFORM_)DATABASE_URL/.test(text) || /getAdminPrisma|tenant-context|withTenant/.test(text));
    // .env.example va shu kabi izohlar "TENANT bazasi ... bo'lmasligi shart" deb eslatishi mumkin — faqat kod fayllari:
    expect(bad.filter((b) => /\.(ts|tsx|mjs)$/.test(b.f) && !b.f.endsWith("next.config.ts")).map((b) => b.f)).toEqual([]);
  });

  it("platform-admin/.env (agar bor bo'lsa) tenant bazasi ulanish satrini o'z ichiga olmaydi", () => {
    for (const name of [".env", ".env.local", ".env.example"]) {
      const p = path.join(ADMIN, name);
      if (!fs.existsSync(p)) continue;
      const active = fs.readFileSync(p, "utf8").split("\n").filter((l) => !l.trim().startsWith("#"));
      expect(active.filter((l) => /^(?!PLATFORM_)\w*DATABASE_URL\s*=/.test(l)), name).toEqual([]);
    }
  });

  it("sessiya sirlari alohida: platform-admin AUTH_SECRET emas PLATFORM_AUTH_SECRET ishlatadi; tenant-app teskarisini", () => {
    const admin = sources().map((s) => s.text).join("\n");
    expect(/(?<!PLATFORM_)AUTH_SECRET/.test(admin.replace(/PLATFORM_AUTH_SECRET/g, ""))).toBe(false);
    const tenantAuth = fs.readFileSync(path.join(ROOT, "apps/tenant-app/src/auth.ts"), "utf8") + fs.readFileSync(path.join(ROOT, "apps/tenant-app/src/auth.config.ts"), "utf8");
    expect(tenantAuth.includes("PLATFORM_AUTH_SECRET")).toBe(false);
  });
});
