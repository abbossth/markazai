// Server kodisiz (DB importi yo'q) — client komponentlar ham ishlata oladi.
export const NO_LIST = "none";

/** Konteyner identifikatori: "<columnId>|<listId yoki none>" */
export const containerId = (columnId: string, listId: string | null) => `${columnId}|${listId ?? NO_LIST}`;

export const parseContainer = (id: string) => {
  const [columnId, list] = id.split("|");
  return { columnId: columnId!, listId: list === NO_LIST ? null : (list ?? null) };
};

/**
 * Birinchi 3 ta (standart: Lidlar, Expectation, Set) ustun o'chirilmaydi. Ustunlarni surish yo'q, yangi ustun oxiriga
 * qo'shiladi, shuning uchun bu ustunlar doim tartib bo'yicha birinchi uchtasi bo'lib qoladi.
 */
export const PROTECTED_COLUMN_COUNT = 3;

/** "Set" (guruh yig'ish) bo'limi — doim uchinchi ustun. Belgilab yoqib-o'chirilmaydi. */
export const SET_COLUMN_INDEX = 2;
