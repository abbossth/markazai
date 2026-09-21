// Server kodisiz (DB importi yo'q) — client komponentlar ham ishlata oladi.
export const NO_LIST = "none";

/** Konteyner identifikatori: "<columnId>|<listId yoki none>" */
export const containerId = (columnId: string, listId: string | null) => `${columnId}|${listId ?? NO_LIST}`;

export const parseContainer = (id: string) => {
  const [columnId, list] = id.split("|");
  return { columnId: columnId!, listId: list === NO_LIST ? null : (list ?? null) };
};
