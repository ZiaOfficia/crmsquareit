import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";
import { can, DEPARTMENT_PERMISSIONS, mergePermissions, parsePermissions, type Action, type ModuleKey, type PermUser } from "./permissions";
import { BDE_CODE, canManageOrg, isHR, isTeamRole, type Membership } from "./org";

export type CurrentUser = PermUser & {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  roleName: string | null;
  /** Department + team role (TL / Executive) assignments. Empty for most Super Admins. */
  memberships: Membership[];
  /** In the HR department: gets HR_PERMISSIONS plus announcements and department management. */
  isHR: boolean;
  /** In the BDE department: gets BDE_PERMISSIONS (leads, customers, quotations) and the BDE dashboard. */
  isBDE: boolean;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const id = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!id) return null;
  const staff = await db.staff.findUnique({
    where: { id },
    include: { role: true, orgMemberships: { include: { department: { include: { parent: true } } } } },
  });
  if (!staff || !staff.active) return null;
  const memberships: Membership[] = staff.orgMemberships
    .filter((m) => m.department.active && isTeamRole(m.teamRole))
    .map((m) => ({
      departmentId: m.departmentId,
      departmentCode: m.department.code,
      departmentName: m.department.name,
      parentId: m.department.parentId,
      parentName: m.department.parent?.name ?? null,
      teamRole: m.teamRole as Membership["teamRole"],
    }));
  const hr = !staff.isAdmin && isHR({ memberships });
  // Role permissions plus whatever each of their departments adds (HR, BDE…).
  const rolePerms = memberships.reduce((p, m) => mergePermissions(p, DEPARTMENT_PERMISSIONS[m.departmentCode] ?? {}), parsePermissions(staff.role?.permissions));
  return {
    id: staff.id,
    firstName: staff.firstName,
    lastName: staff.lastName,
    email: staff.email,
    isAdmin: staff.isAdmin,
    roleName: staff.isAdmin ? "Super Admin" : staff.role?.name ?? null,
    permissions: rolePerms,
    memberships,
    isHR: hr,
    isBDE: !staff.isAdmin && memberships.some((m) => m.departmentCode === BDE_CODE),
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

/** Super Admin only (the `isAdmin` flag). Use in pages and server actions. */
export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/admin/forbidden");
  return user;
}

/** Super Admin or HR. Use for announcements and department membership. */
export async function requireAdminOrHR() {
  const user = await requireUser();
  if (!canManageOrg(user)) redirect("/admin/forbidden");
  return user;
}
