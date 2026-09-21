import { toCenterParts } from "@markazai/types";
import { param, type RawSearchParams } from "./search-params";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Sana oralig'i ("YYYY-MM-DD"); berilmasa — joriy oy boshidan bugungacha (markaz vaqti). */
export function resolveRange(sp: RawSearchParams) {
  const today = toCenterParts(new Date()).date;
  let from = param(sp, "from");
  let to = param(sp, "to");
  if (!from || !ISO.test(from)) from = `${today.slice(0, 7)}-01`;
  if (!to || !ISO.test(to)) to = today;
  if (from > to) [from, to] = [to, from];
  return { from, to, today };
}
export type Range = ReturnType<typeof resolveRange>;
