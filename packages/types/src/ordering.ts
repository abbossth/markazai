/**
 * Konteyner (ustun/ro'yxat) tartibiga element kiritish.
 * @param ids      konteynerdagi hozirgi tartib (ko'chirilayotgan element BO'LMASLIGI kerak)
 * @param id       ko'chirilayotgan element
 * @param beforeId shu elementdan oldin qo'yiladi; null yoki topilmasa — oxiriga
 *
 * Filtr yoqilgan doskada ham to'g'ri ishlashi uchun tartib server tomonida
 * "to'liq" ro'yxatga nisbatan hisoblanadi.
 */
export function insertBefore(ids: string[], id: string, beforeId: string | null): string[] {
  const rest = ids.filter((x) => x !== id);
  const index = beforeId ? rest.indexOf(beforeId) : -1;
  if (index === -1) return [...rest, id];
  return [...rest.slice(0, index), id, ...rest.slice(index)];
}

/** Tartib o'zgargan (id → yangi pozitsiya) juftliklarini qaytaradi — keraksiz UPDATE'larni kamaytiradi. */
export function changedPositions(before: Map<string, number>, order: string[]): { id: string; position: number }[] {
  const out: { id: string; position: number }[] = [];
  order.forEach((id, position) => {
    if (before.get(id) !== position) out.push({ id, position });
  });
  return out;
}
