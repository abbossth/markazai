/**
 * Server ishga tushganda tenant resolver'ni ro'yxatdan o'tkazadi — birinchi so'rovdan oldin.
 * (lib/tenant.ts ham import bo'lganda o'zini ro'yxatdan o'tkazadi; bu — kafolat.)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./lib/tenant");
}
