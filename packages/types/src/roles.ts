export const ROLES = [
  "CEO",
  "ADMINISTRATOR",
  "LIMITED_ADMINISTRATOR",
  "ADMINISTRATOR2",
  "INTERN_ADMINISTRATOR",
  "CASHIER",
  "MARKETER",
  "BRANCH_DIRECTOR",
  "TEACHER",
] as const;
export type Role = (typeof ROLES)[number];
