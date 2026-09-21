/**
 * Til ro'yxati konfiguratsiya darajasida. Yangi til qo'shish: shu ro'yxatga yozish +
 * messages/<kod>.json faylini yaratish. (Keyinchalik CenterSettings.locales bilan cheklanadi.)
 */
export const LOCALES = [
  { code: "uz", label: "O'zbekcha", short: "UZ" },
  { code: "ru", label: "Русский", short: "RU" },
  { code: "en", label: "English", short: "EN" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: Locale = "uz";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string | undefined | null): value is Locale {
  return LOCALES.some((l) => l.code === value);
}
