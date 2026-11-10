"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePerm, requireAdmin, requireAdminOrHR } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ACTIONS, MODULES } from "@/lib/permissions";
import { canManageOrg, isTeamRole, teamRoleLabel } from "@/lib/org";
import { checkAssignableDepartment } from "@/lib/org-server";
import { decryptPassword, passwordFields } from "@/lib/passwords";
import { str, reqStr, intOrNull, bool, type ActionState } from "@/lib/forms";

export async function saveStaff(id: number | null, _: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("staff", id ? "edit" : "create");
  const email = reqStr(f, "email").toLowerCase();
  const password = str(f, "password");
  const data = {
    firstName: reqStr(f, "firstName"),
    lastName: reqStr(f, "lastName"),
    email,
    phone: str(f, "phone"),
    roleId: intOrNull(f, "roleId"),
    isAdmin: user.isAdmin ? bool(f, "isAdmin") : false,
    active: bool(f, "active"),
  };
  if (!data.firstName || !email) return { error: "First name and email are required." };
  const dupe = await db.staff.findFirst({ where: { email, ...(id ? { NOT: { id } } : {}) } });
  if (dupe) return { error: "Another staff member already uses this email." };
  if (!id && (!password || password.length < 6)) return { error: "Password must be at least 6 characters." };
  if (password && password.length < 6) return { error: "Password must be at least 6 characters." };
  if (id === user.id && (!data.active || (user.isAdmin && !data.isAdmin))) return { error: "You can't deactivate or demote your own account." };
  // Department + team role: Super Admin, or HR for anyone except themselves
  // (so they can't remove their own HR access). Enforced here, not just by
  // hiding the fields. Ignored entirely for anyone else.
  const setOrg = f.get("orgField") === "1" && (user.isAdmin || (canManageOrg(user) && id !== user.id));
  const orgDepartmentId = setOrg ? intOrNull(f, "orgDepartmentId") : null;
  const teamRole = str(f, "teamRole");
  if (setOrg && orgDepartmentId) {
    if (!isTeamRole(teamRole)) return { error: "Choose TL or Executive for the department." };
    const check = await checkAssignableDepartment(orgDepartmentId);
    if ("error" in check) return { error: check.error };
  }
  if (id) {
    const existing = await db.staff.findUnique({ where: { id } });
    if (!existing) return { error: "That staff member no longer exists." };
    if (existing.isAdmin && !user.isAdmin) return { error: "Only a Super Admin can edit a Super Admin." };
    if (!user.isAdmin) data.isAdmin = existing?.isAdmin ?? false;
  }
  const s = id
    ? await db.staff.update({ where: { id }, data: { ...data, ...(password ? await passwordFields(password) : {}) } })
    : await db.staff.create({ data: { ...data, ...(await passwordFields(password!)) } });
  // Setting a password answers any open "forgot password" request.
  if (id && password) await db.passwordReset.updateMany({ where: { staffId: id, usedAt: null }, data: { usedAt: new Date() } });
  // The form edits a single assignment. Someone in several departments is
  // managed on the Departments page, so never overwrite those here.
  if (setOrg && (await db.departmentMember.count({ where: { staffId: s.id } })) <= 1) {
    await db.$transaction([
      db.departmentMember.deleteMany({ where: { staffId: s.id, ...(orgDepartmentId ? { NOT: { departmentId: orgDepartmentId } } : {}) } }),
      ...(orgDepartmentId && isTeamRole(teamRole)
        ? [db.departmentMember.upsert({
            where: { staffId_departmentId: { staffId: s.id, departmentId: orgDepartmentId } },
            update: { teamRole },
            create: { staffId: s.id, departmentId: orgDepartmentId, teamRole },
          })]
        : []),
    ]);
  }
  await logActivity("staff", s.id, `${id ? "updated" : "added"} staff member ${s.firstName} ${s.lastName}`, user.id);
  redirect("/admin/staff");
}

/** Deactivate (or reactivate) a staff member. Inactive staff can't log in;
 *  everything they worked on stays. */
export async function setStaffActive(f: FormData) {
  const user = await requirePerm("staff", "delete");
  const id = Number(f.get("id"));
  const active = f.get("active") === "1";
  if (id === user.id) redirect(`/admin/staff/${id}`);
  const s = await db.staff.findUnique({ where: { id } });
  if (!s) redirect("/admin/staff");
  if (s.isAdmin && !user.isAdmin) redirect("/admin/forbidden");
  await db.staff.update({ where: { id }, data: { active } });
  // An inactive account can't use an old reset link.
  if (!active) await db.passwordReset.updateMany({ where: { staffId: id, usedAt: null }, data: { usedAt: new Date() } });
  await logActivity("staff", id, `${active ? "reactivated" : "deactivated"} staff member ${s.firstName} ${s.lastName}`, user.id);
  revalidatePath("/admin/staff");
  redirect(`/admin/staff/${id}`);
}

/** Permanently removes a staff member from the database. Their time entries,
 *  to-dos, department places and announcement reads go with them; leads,
 *  tasks, tickets, notes, quotations etc. stay, just without their name. */
export async function deleteStaffPermanently(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  const user = await requireAdmin(); // Super Admin only
  const s = await db.staff.findUnique({ where: { id } });
  if (!s) redirect("/admin/staff");
  if (s.id === user.id) return { error: "You can't delete your own account." };
  if (s.isAdmin && (await db.staff.count({ where: { isAdmin: true, active: true, NOT: { id } } })) === 0)
    return { error: "This is the last active Super Admin. Make someone else a Super Admin first." };
  if (String(f.get("confirm") || "").trim().toLowerCase() !== s.email.toLowerCase()) return { error: `Type ${s.email} to confirm.` };
  await db.staff.delete({ where: { id } });
  await logActivity("staff", id, `permanently deleted staff member ${s.firstName} ${s.lastName} (${s.email})`, user.id);
  revalidatePath("/admin/staff");
  redirect("/admin/staff");
}

export async function saveRole(id: number | null, _: ActionState, f: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = reqStr(f, "name");
  if (!name) return { error: "Role name is required." };
  const perms: Record<string, string[]> = {};
  for (const m of MODULES) {
    const acts = ACTIONS.filter((a) => f.get(`${m.key}:${a}`) === "on");
    if (acts.length) perms[m.key] = acts.includes("view") ? acts : ["view", ...acts];
  }
  const data = { name, permissions: JSON.stringify(perms) };
  try {
    if (id) await db.role.update({ where: { id }, data });
    else await db.role.create({ data });
  } catch {
    return { error: "A role with this name already exists." };
  }
  redirect("/admin/staff/roles");
}

export async function deleteRole(f: FormData) {
  await requireAdmin();
  await db.role.delete({ where: { id: Number(f.get("id")) } });
  redirect("/admin/staff/roles");
}

// ─── Departments (Super Admin and HR) ─────────────────────────────────

export async function addDepartmentMember(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requireAdminOrHR();
  const staffId = intOrNull(f, "staffId");
  const departmentId = intOrNull(f, "departmentId");
  const teamRole = str(f, "teamRole");
  if (!staffId || !departmentId) return { error: "Choose a staff member." };
  if (!isTeamRole(teamRole)) return { error: "Choose TL or Executive." };
  const staff = await db.staff.findUnique({ where: { id: staffId } });
  if (!staff || !staff.active) return { error: "That staff member is inactive or no longer exists." };
  if (!user.isAdmin && (staff.isAdmin || staff.id === user.id)) return { error: staff.isAdmin ? "Only a Super Admin can place a Super Admin." : "Ask a Super Admin to change your own department." };
  const check = await checkAssignableDepartment(departmentId);
  if ("error" in check) return { error: check.error };

  await db.departmentMember.upsert({
    where: { staffId_departmentId: { staffId, departmentId } },
    update: { teamRole },
    create: { staffId, departmentId, teamRole },
  });
  await logActivity("staff", staffId, `set ${staff.firstName} ${staff.lastName} as ${teamRoleLabel(teamRole)} in ${check.department.name}`, user.id);
  revalidatePath("/admin/staff");
  return { ok: true };
}

export async function removeDepartmentMember(f: FormData) {
  const user = await requireAdminOrHR();
  const id = Number(f.get("id"));
  const m = await db.departmentMember.findUnique({ where: { id }, include: { staff: true, department: true } });
  // HR can't remove a Super Admin or themselves (that would drop their own HR access).
  if (m && !user.isAdmin && (m.staff.isAdmin || m.staffId === user.id)) redirect("/admin/forbidden");
  if (m) {
    await db.departmentMember.delete({ where: { id } });
    await logActivity("staff", m.staffId, `removed ${m.staff.firstName} ${m.staff.lastName} from ${m.department.name}`, user.id);
  }
  revalidatePath("/admin/staff");
}

// ─── View a staff member's password (Super Admin and HR) ──────────────

/** Fetched on click (not rendered into the page) so every view is logged.
 *  HR can't view a Super Admin's password. */
export async function revealStaffPassword(staffId: number): Promise<{ password?: string; error?: string }> {
  const user = await requireAdminOrHR();
  const s = await db.staff.findUnique({ where: { id: staffId } });
  if (!s) return { error: "That staff member no longer exists." };
  if (s.isAdmin && !user.isAdmin) return { error: "Only a Super Admin can view a Super Admin's password." };
  const password = decryptPassword(s.passwordView);
  if (!password) return { error: "Not available yet. It's saved the next time they log in, or when a new password is set." };
  if (s.id !== user.id) await logActivity("staff", s.id, `viewed the password of ${s.firstName} ${s.lastName}`, user.id);
  return { password };
}
