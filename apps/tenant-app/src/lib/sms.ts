export type SmsResult = { status: "SENT" | "FAILED" | "MOCK"; provider: string; error?: string };

export interface SmsProvider {
  readonly name: string;
  send(phone: string, text: string): Promise<SmsResult>;
}

/** Haqiqiy provayder (Eskiz.uz) ulanmaguncha: xabar faqat jurnalga yoziladi, jo'natilmaydi. */
class MockSmsProvider implements SmsProvider {
  readonly name = "mock";
  async send(): Promise<SmsResult> {
    return { status: "MOCK", provider: this.name };
  }
}

/** Yagona kirish nuqtasi. Eskiz ulanganda shu yerda ESKIZ_* env bo'yicha provayder qaytariladi. */
export function getSmsProvider(): SmsProvider {
  return new MockSmsProvider();
}
