import { DEFAULT_ORGANIZATION_ID } from "@markazai/types";
import { setTenantResolver } from "@markazai/db";

/**
 * Joriy so'rov tegishli markaz (tenant) ID'si. Sessiyasiz sahifalar (login, ommaviy forma) shuni ishlatadi;
 * ma'lumotlar bazasi qatlami ham RLS uchun aynan shu funksiyadan foydalanadi (pastdagi resolver).
 * (9.2: subdomen → tashkilot; hozircha yagona tenant.)
 */
export async function currentOrganizationId(): Promise<string> {
  return DEFAULT_ORGANIZATION_ID;
}

// Baza qatlami har ulanishda joriy tashkilotni shu resolver orqali so'raydi (RLS `app.current_org`).
setTenantResolver(currentOrganizationId);
