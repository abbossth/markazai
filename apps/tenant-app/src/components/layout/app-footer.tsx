import Link from "next/link";
import { CHARGE_MODE_LABEL, SUPPORT_TELEGRAM_URL, type ChargeMode } from "@markazai/types";
import { MarkazaiWordmark } from "@/components/brand/logo";

/** Ilova pastki paneli: texnik yordam (Telegram), video darsliklar va joriy to'lov rejimi. */
export function AppFooter({ chargeMode }: { chargeMode: ChargeMode }) {
  return (
    <footer className="bg-card text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-1 border-t px-6 py-2 text-xs print:hidden">
      <a href={SUPPORT_TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
        Texnik yordam
      </a>
      <Link href="/help/videos" prefetch={false} className="hover:text-foreground">
        Video darsliklar
      </Link>
      <span>
        To&apos;lov rejimi: <span className="text-foreground">{CHARGE_MODE_LABEL[chargeMode]}</span>
      </span>
      <MarkazaiWordmark className="text-brand-500 ml-auto text-base" />
    </footer>
  );
}
