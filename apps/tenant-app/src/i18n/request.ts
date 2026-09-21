import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { loadCenterConfig } from "@/lib/center";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./config";

// Til URL'da emas, cookie'da saqlanadi (marshrutlar /dashboard, /leads ... ko'rinishida qoladi).
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  // Faqat markaz yoqqan tillar; cookie'dagi til o'chirilgan bo'lsa — birinchi yoqilgan til.
  const { locales } = await loadCenterConfig();
  const first = locales.find(isLocale) ?? DEFAULT_LOCALE;
  const locale = isLocale(cookieLocale) && locales.includes(cookieLocale) ? cookieLocale : locales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : first;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
