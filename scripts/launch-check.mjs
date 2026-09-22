#!/usr/bin/env node
/**
 * Launch tekshiruvi: wildcard DNS, marketing, Control Plane va tenant subdomenlari to'g'ri javob berayotganini tekshiradi.
 *   node scripts/launch-check.mjs markazai.uz                 # production
 *   node scripts/launch-check.mjs localhost --port 3100 --admin-port 3200 --slug demo   # lokal
 * Chiqish kodi: hammasi yaxshi bo'lsa 0, aks holda 1.
 */
const args = process.argv.slice(2);
const root = args[0];
const opt = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
if (!root) {
  console.error("Ishlatish: node scripts/launch-check.mjs <root-domain> [--port N] [--admin-port N] [--slug demo] [--http]");
  process.exit(2);
}
const scheme = args.includes("--http") || root === "localhost" ? "http" : "https";
const port = opt("port", "");
const adminPort = opt("admin-port", port);
const slug = opt("slug", "demo");
const url = (sub, path = "/", p = port) => `${scheme}://${sub ? `${sub}.` : ""}${root}${p ? `:${p}` : ""}${path}`;

import http from "node:http";

let failed = 0;
async function check(name, fn) {
  try {
    const res = await fn();
    console.log(`${res === true ? "✓" : "✗"} ${name}${res === true ? "" : ` — ${res}`}`);
    if (res !== true) failed++;
  } catch (e) {
    console.log(`✗ ${name} — ${e.message}`);
    failed++;
  }
}
// Lokal rejimda *.localhost Node DNS'ida yechilmaydi (brauzer/curl'da yechiladi) va fetch Host sarlavhasini o'zgartirtirmaydi —
// shuning uchun node:http bilan 127.0.0.1'ga ulanib, Host'ni o'zimiz beramiz. Production'da oddiy fetch.
const get = (u, init = {}) => {
  const target = new URL(u);
  if (root !== "localhost") return fetch(target, { redirect: "manual", signal: AbortSignal.timeout(10_000), ...init });
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: target.port || 80, path: target.pathname + target.search, method: init.method ?? "GET", headers: { host: target.host }, timeout: 10_000 }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, json: async () => JSON.parse(body) }));
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.end(init.body);
  });
};

await check(`marketing (${url("")})`, async () => {
  const r = await get(url(""));
  // Dev'da apex → sukut tenant (307 → /login); production'da marketing sahifa (200).
  return r.status === 200 || r.status === 307 ? true : `HTTP ${r.status}`;
});
await check(`tenant login (${url(slug, "/login")})`, async () => ((await get(url(slug, "/login"))).status === 200 ? true : "200 kutilgan"));
await check(`tenant health (${url(slug, "/api/health")})`, async () => {
  const r = await get(url(slug, "/api/health"));
  const j = await r.json().catch(() => ({}));
  return r.status === 200 && j.ok ? true : `HTTP ${r.status} ${JSON.stringify(j.checks ?? {})} (rls=false bo'lsa ilova egasi ulanishi bilan ishlayapti — APP_DATABASE_URL!)`;
});
await check("wildcard: noma'lum subdomen 404 (DNS + SSL ishlaydi, ilova rad etadi)", async () => {
  const r = await get(url(`no-such-${Date.now().toString(36)}`, "/login"));
  return r.status === 404 ? true : `HTTP ${r.status}`;
});
await check("taqiqlangan subdomen (api.) tenant sifatida ochilmaydi", async () => {
  const r = await get(url("api", "/login")).catch(() => null);
  return !r || r.status === 404 ? true : `HTTP ${r.status}`;
});
await check(`Control Plane (${url("admin", "/login", adminPort)})`, async () => ((await get(url("admin", "/login", adminPort))).status === 200 ? true : "200 kutilgan"));
await check("Control Plane health", async () => {
  const r = await get(url("admin", "/api/health", adminPort));
  return r.status === 200 ? true : `HTTP ${r.status}`;
});
await check("Control Plane himoyalangan (kirishsiz → login'ga yo'naltiradi)", async () => {
  const r = await get(url("admin", "/organizations", adminPort));
  return r.status === 307 || r.status === 302 ? true : `HTTP ${r.status}`;
});
await check("tenant ichki API imzosiz rad etiladi (401)", async () => {
  const r = await get(url(slug, "/api/internal/provision"), { method: "POST", body: "{}" });
  return r.status === 401 ? true : `HTTP ${r.status}`;
});

console.log(failed ? `\n${failed} ta tekshiruv muvaffaqiyatsiz` : "\nHammasi yaxshi");
process.exit(failed ? 1 : 0);
