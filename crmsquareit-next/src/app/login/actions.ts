"use server";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE, signSession } from "@/lib/session";
import { encryptPassword, hashToken, MIN_PASSWORD, newResetToken, passwordFields, RESET_TTL_MINUTES } from "@/lib/passwords";
import { mailConfigured, sendMail } from "@/lib/mail";
import { logActivity } from "@/lib/activity";
import type { ActionState } from "@/lib/forms";

export async function login(_: ActionState, f: FormData): Promise<ActionState> {
  const email = String(f.get("email") || "").trim().toLowerCase();
  const password = String(f.get("password") || "");
  const staff = await db.staff.findUnique({ where: { email } });
  if (!staff || !(await bcrypt.compare(password, staff.password))) return { error: "Invalid email or password." };
  if (!staff.active) return { error: "Your account is inactive. Contact an administrator." };
  // Accounts created before passwords were viewable get their view filled in on next login.
  await db.staff.update({
    where: { id: staff.id },
    data: { lastLogin: new Date(), ...(staff.passwordView ? {} : { passwordView: encryptPassword(password), passwordSetAt: staff.passwordSetAt ?? new Date() }) },
  });
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

async function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type ForgotState = { error?: string; sent?: boolean; email?: string } | undefined;

export async function requestPasswordReset(_: ForgotState, f: FormData): Promise<ForgotState> {
  const email = String(f.get("email") || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { error: "Enter your email address." };
  const staff = await db.staff.findUnique({ where: { email } });
  if (!staff || !staff.active) return { error: staff ? "This account is inactive. Contact HR or a Super Admin." : "No account uses this email. Check the spelling or ask HR." };

  // At most 3 links per 15 minutes per account.
  const recent = await db.passwordReset.count({ where: { staffId: staff.id, createdAt: { gt: new Date(Date.now() - 15 * 60_000) } } });
  if (recent >= 3) return { error: "Too many reset requests. Wait 15 minutes and try again, or ask HR." };

  const token = newResetToken();
  await db.passwordReset.create({ data: { staffId: staff.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000) } });
  const link = `${await baseUrl()}/login/reset?token=${token}`;
  const sent = await sendMail(
    staff.email,
    "Reset your Squareit CRM password",
    `Hi ${staff.firstName},\n\nUse this link to set a new password (valid for ${RESET_TTL_MINUTES} minutes):\n${link}\n\nIf you didn't ask for this, ignore this email.`,
    `<p>Hi ${staff.firstName},</p><p>Use this link to set a new password (valid for ${RESET_TTL_MINUTES} minutes):</p><p><a href="${link}">Reset my password</a></p><p>If you didn't ask for this, ignore this email.</p>`,
  );
  if (!sent) {
    // No SMTP yet: the request still shows on the Staff page for HR / Super Admin.
    if (!mailConfigured()) console.log(`[password reset] SMTP not configured. Link for ${staff.email}: ${link}`);
    return { sent: false, email: staff.email };
  }
  return { sent: true, email: staff.email };
}

export async function resetPassword(token: string, _: ActionState, f: FormData): Promise<ActionState> {
  const reset = await db.passwordReset.findUnique({ where: { tokenHash: hashToken(token) }, include: { staff: true } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date() || !reset.staff.active) return { error: "This reset link is invalid or has expired. Request a new one." };
  const password = String(f.get("password") || "");
  if (password.length < MIN_PASSWORD) return { error: `Password must be at least ${MIN_PASSWORD} characters.` };
  if (password !== f.get("confirm")) return { error: "Passwords don't match." };
  await db.$transaction([
    db.staff.update({ where: { id: reset.staffId }, data: await passwordFields(password) }),
    // Use up this link and any other open ones for the account.
    db.passwordReset.updateMany({ where: { staffId: reset.staffId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  await logActivity("staff", reset.staffId, `${reset.staff.firstName} ${reset.staff.lastName} reset their password`, reset.staffId);
  redirect("/login?reset=1");
}
