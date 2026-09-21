import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, isEncrypted } from "./secrets";

const saved = { s: process.env.SECRETS_KEY, a: process.env.AUTH_SECRET };
beforeEach(() => {
  process.env.SECRETS_KEY = "test-key-1";
});
afterEach(() => {
  process.env.SECRETS_KEY = saved.s;
  process.env.AUTH_SECRET = saved.a;
});

describe("secrets", () => {
  it("shifrlab-ochish qiymatni saqlaydi", () => {
    const enc = encryptSecret("payme-secret-KEY-123");
    expect(isEncrypted(enc)).toBe(true);
    expect(enc).not.toContain("payme-secret");
    expect(decryptSecret(enc)).toBe("payme-secret-KEY-123");
  });
  it("har safar boshqa nonce (bir xil matn — turli shifr)", () => {
    expect(encryptSecret("x")).not.toBe(encryptSecret("x"));
  });
  it("boshqa kalit bilan ochib bo'lmaydi", () => {
    const enc = encryptSecret("secret");
    process.env.SECRETS_KEY = "other-key";
    expect(() => decryptSecret(enc)).toThrow();
  });
  it("buzilgan shifr rad etiladi (autentifikatsiya tegi)", () => {
    const enc = encryptSecret("secret");
    const parts = enc.split(":");
    parts[4] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });
  it("shifrlanmagan qiymat o'zgarishsiz qaytadi", () => {
    expect(decryptSecret("plain-value")).toBe("plain-value");
  });
  it("SECRETS_KEY bo'lmasa AUTH_SECRET ishlatiladi", () => {
    delete process.env.SECRETS_KEY;
    process.env.AUTH_SECRET = "auth-secret";
    expect(decryptSecret(encryptSecret("v"))).toBe("v");
  });
});
