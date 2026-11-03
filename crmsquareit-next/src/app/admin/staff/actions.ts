"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePerm, requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ACTIONS, MODULES } from "@/lib/permissions";
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
  if (id) {
    const existing = await db.staff.findUnique({ where: { id } });
    if (existing?.isAdmin && !user.isAdmin) return { error: "Only administrators can edit an administrator." };
    if (!user.isAdmin) data.isAdmin = existing?.isAdmin ?? false;
  }
  const s = id
    ? await db.staff.update({ where: { id }, data: { ...data, ...(password ? { password: await bcrypt.hash(password, 10) } : {}) } })
    : await db.staff.create({ data: { ...data, password: await bcrypt.hash(password!, 10) } });
  await logActivity("staff", s.id, `${id ? "updated" : "added"} staff member ${s.firstName} ${s.lastName}`, user.id);
  redirect("/admin/staff");
}

export async function deleteStaff(f: FormData) {
  const user = await requirePerm("staff", "delete");
  const id = Number(f.get("id"));
  if (id === user.id) redirect("/admin/staff");
  const s = await db.staff.findUnique({ where: { id } });
  if (s?.isAdmin && !user.isAdmin) redirect("/admin/forbidden");
  // Keep history intact: deactivate rather than hard-delete
  await db.staff.update({ where: { id }, data: { active: false } });
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
