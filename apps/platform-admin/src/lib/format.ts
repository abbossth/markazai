export const fmtMoney = (n: number) => `${new Intl.NumberFormat("ru-RU").format(n).replace(/ /g, " ")} so'm`;
export const fmtDate = (d: Date | string | null | undefined) => {
  if (!d) return "—";
  const iso = typeof d === "string" ? d : d.toISOString();
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
};
export const todayISO = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10); // markaz vaqti UTC+5
export const fromISO = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
