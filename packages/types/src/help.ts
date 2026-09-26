/** Yordam: texnik yordam kontakti, video havolalari va o'quv markazning to'lov (pul yechish) rejimi. */

export const SUPPORT_TELEGRAM_URL = "https://t.me/markazai_support";

export const CHARGE_MODES = ["DAILY", "CALENDAR", "GROUP_START", "MODULE", "INDIVIDUAL", "FULL_COURSE"] as const;
export type ChargeMode = (typeof CHARGE_MODES)[number];

export const CHARGE_MODE_LABEL: Record<ChargeMode, string> = {
  DAILY: "Kunlik (dars bo'yicha)",
  CALENDAR: "Kalendar (oyning 1-sanasi)",
  GROUP_START: "Guruh boshlanish sanasi",
  MODULE: "Modul (dars soni bo'yicha)",
  INDIVIDUAL: "Individual (faollashtirilgan sana)",
  FULL_COURSE: "To'liq kurs (bir martalik)",
};

export const CHARGE_MODE_HINT: Record<ChargeMode, string> = {
  DAILY: "Har darsda bitta dars narxi avtomatik yechiladi (hozirgi amaldagi tizim).",
  CALENDAR: "Har oyning 1-sanasida kurs narxi oldindan yechiladi.",
  GROUP_START: "Guruh ochilgan kun har oy to'lov kuni bo'ladi.",
  MODULE: "Belgilangan dars soni (4, 8, 12, 20, 24, 28) bo'yicha yechiladi.",
  INDIVIDUAL: "O'quvchi faollashtirilgan sanadan boshlab har oy yechiladi.",
  FULL_COURSE: "Butun kurs uchun birinchi faollashtirishda bir martalik yechiladi.",
};

export function isChargeMode(v: unknown): v is ChargeMode {
  return typeof v === "string" && (CHARGE_MODES as readonly string[]).includes(v);
}

/** YouTube havolasidan (watch, youtu.be, shorts, embed) video ID'sini ajratadi; yaroqsiz bo'lsa null. */
export function youtubeId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/);
      id = m?.[1] ?? null;
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}
