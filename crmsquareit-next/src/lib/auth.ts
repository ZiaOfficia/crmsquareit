import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";
import { can, parsePermissions, type Action, type ModuleKey, type PermUser } from "./permissions";

export type CurrentUser = PermUser & {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  roleName: string | null;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const id = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!id) return null;
  const staff = await db.staff.findUnique({ where: { id }, include: { role: true } });
  if (!staff || !staff.active) return null;
  return {
    id: staff.id,
    firstName: staff.firstName,
    lastName: staff.lastName,
    email: staff.email,
    isAdmin: staff.isAdmin,
    roleName: staff.isAdmin ? "Administrator" : staff.role?.name ?? null,
    permissions: parsePermissions(staff.role?.permissions),
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Use in pages and server actions. Redirects to /admin/forbidden when not allowed. */
export async function requirePerm(module: ModuleKey, action: Action = "view") {
  const user = await requireUser();
  if (!can(user, module, action)) redirect("/admin/forbidden");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/admin/forbidden");
  return user;
}
