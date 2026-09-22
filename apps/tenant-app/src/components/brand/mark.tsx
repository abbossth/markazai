/**
 * Markazai belgisi (mark) — brend qo'llanmasi V1.0 asosida. Bitta SVG manba (100×100 viewBox, `public/brand/*.svg`
 * fayllaridagi bilan bir xil yo'l/nuqta ma'lumoti) — rang faqat `tone` orqali almashtiriladi, chizma qo'lda
 * qayta chizilmaydi (qo'llanma, 12-bet: "rang va fon faqat kod darajasida almashtiriladi").
 */
const TONES = {
  blue: { bg: "#1F4BFF", stroke: "#FFFFFF", dot: "#FFB020" },
  gold: { bg: "#FFB020", stroke: "#0B1026", dot: "#0B1026" },
  ink: { bg: "#0B1026", stroke: "#FFFFFF", dot: "#FFB020" },
  /** Fonsiz — chizig'i "currentColor" (matn rangiga moslashadi), nuqta har doim oltin. */
  outline: { bg: "none", stroke: "currentColor", dot: "#FFB020" },
} as const;

export type MarkTone = keyof typeof TONES;

export function MarkazaiMark({ size = 32, tone = "blue", className }: { size?: number; tone?: MarkTone; className?: string }) {
  const t = TONES[tone];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      {t.bg !== "none" && <rect width="100" height="100" rx="26" fill={t.bg} />}
      <path d="M26 74 V46 A12 12 0 0 1 50 46 A12 12 0 0 1 74 46 V74" fill="none" stroke={t.stroke} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="50" cy="68" r="7" fill={t.dot} />
    </svg>
  );
}
