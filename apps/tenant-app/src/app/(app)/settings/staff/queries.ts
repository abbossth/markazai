import { prisma, type Prisma } from "@markazai/db";
import { ROLES } from "@markazai/types";
import { intParam, param, sortParam, type RawSearchParams } from "@/lib/search-params";
import type { SessionUser } from "@/lib/session";

export const PAGE_SIZE = 20;

export type StaffRow = {
  id: string;
  name: string;
  phone: string;
  roles: string[];
  position: string | null;
  email: string | null;
  isActive: boolean;
  branchIds: string[];
};

export async function listStaff(user: SessionUser, sp: RawSearchParams) {
  const q = param(sp, "q");
  const role = param(sp, "role");
  const status = param(sp, "status");
  const page = intParam(sp, "page", 1);
  const sort = sortParam(sp, ["name", "createdAt"] as const, { key: "name", dir: "asc" });
  const digits = q?.replace(/\D/g, "") ?? "";

  const where: Prisma.UserWhereInput = {
    organizationId: user.orgId,
    ...(role && (ROLES as readonly string[]).includes(role) && { roles: { has: role as (typeof ROLES)[number] } }),
    ...(status === "active" && { isActive: true }),
    ...(status === "inactive" && { isActive: false }),
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { position: { contains: q, mode: "insensitive" } }, ...(digits.length >= 2 ? [{ phone: { contains: digits } }] : [])] }),
  };
  const [total, list] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ [sort.key]: sort.dir }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, name: true, phone: true, roles: true, position: true, email: true, isActive: true, branches: { select: { branchId: true } } },
    }),
  ]);
  const rows: StaffRow[] = list.map((u) => ({ id: u.id, name: u.name, phone: u.phone, roles: u.roles, position: u.position, email: u.email, isActive: u.isActive, branchIds: u.branches.map((b) => b.branchId) }));
  return { rows, total, page, sort };
}

export async function loadBranches(user: SessionUser) {
  return prisma.branch.findMany({ where: { organizationId: user.orgId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
}
