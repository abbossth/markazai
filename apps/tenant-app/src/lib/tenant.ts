import { DEFAULT_ORGANIZATION_ID } from "@markazai/types";

/**
 * Joriy so'rov tegishli markaz (tenant) ID'si. Sessiyasiz sahifalar (login, ommaviy forma) shuni ishlatadi;
 * autentifikatsiyadan keyin — sessiyadagi `organizationId`. 9-bosqichda subdomen (host) bo'yicha aniqlanadi —
 * o'zgarish faqat shu funksiyada.
 */
export function currentOrganizationId(): string {
  return DEFAULT_ORGANIZATION_ID;
}
