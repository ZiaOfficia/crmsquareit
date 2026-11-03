"use server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE, signSession } from "@/lib/session";
import type { ActionState } from "@/lib/forms";

export async function login(_: ActionState, f: FormData): Promise<ActionState> {
  const email = String(f.get("email") || "").trim().toLowerCase();
  const password = String(f.get("password") || "");
  const staff = await db.staff.findUnique({ where: { email } });
  if (!staff || !(await bcrypt.compare(password, staff.password))) return { error: "Invalid email or password." };
  if (!staff.active) return { error: "Your account is inactive. Contact an administrator." };
  await db.staff.update({ where: { id: staff.id }, data: { lastLogin: new Date() } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(staff.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * (f.get("remember") ? 30 : 7),
  });
  const next = String(f.get("next") || "/admin");
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
