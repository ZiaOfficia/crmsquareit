"use server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { passwordFields } from "@/lib/passwords";
import { reqStr, str, type ActionState } from "@/lib/forms";

export async function updateProfile(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requireUser();
  const firstName = reqStr(f, "firstName");
  if (!firstName) return { error: "First name is required." };
  await db.staff.update({ where: { id: user.id }, data: { firstName, lastName: reqStr(f, "lastName"), phone: str(f, "phone") } });
  return { ok: true };
}

export async function changePassword(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requireUser();
  const staff = await db.staff.findUnique({ where: { id: user.id } });
  if (!staff || !(await bcrypt.compare(String(f.get("current") || ""), staff.password))) return { error: "Current password is incorrect." };
  const next = String(f.get("password") || "");
  if (next.length < 6) return { error: "New password must be at least 6 characters." };
  if (next !== f.get("confirm")) return { error: "Passwords don't match." };
  await db.staff.update({ where: { id: user.id }, data: await passwordFields(next) });
  return { ok: true };
}
